'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useNotes } from '@/contexts/NoteContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Save, Trash2, X, Upload, Download, Paperclip, Check, Maximize2, Minimize2, ChevronUp, ChevronDown, Database, HardDrive, Server, Leaf } from 'lucide-react';
import { getStorageMode, StorageMode } from '@/lib/storageConfig';
import { api } from '@/lib/api';

const BlockNoteEditor = dynamic(
  () => import('./BlockNoteEditor').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    ),
  }
);

interface NoteEditorProps {
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface Attachment {
  filename: string;
  url: string;
}

const getStorageModeInfo = (mode: StorageMode) => {
  switch (mode) {
    case 'local':
      return { icon: HardDrive, label: '本地', color: 'text-gray-500' };
    case 'supabase':
      return { icon: Database, label: 'Supabase', color: 'text-green-500' };
    case 'redis':
      return { icon: Server, label: 'Redis', color: 'text-red-500' };
    case 'mongodb':
      return { icon: Leaf, label: 'MongoDB', color: 'text-green-600' };
  }
};

export default function NoteEditor({ onClose, isFullscreen = false, onToggleFullscreen }: NoteEditorProps) {
  const { currentNote, updateNote, deleteNote, categories, uploadFile } = useNotes();
  useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isClosingDialog, setIsClosingDialog] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevNoteRef = useRef<{ id: string; title: string; content: string } | null>(null);
  // 使用 ref 保存最新值，避免闭包问题
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const categoryRef = useRef(category);
  // 保存定时器创建时的内容哈希，用于对比
  const contentHashRef = useRef<string>('');

  // 计算内容哈希
  const computeHash = (title: string, content: string, category: string): string => {
    return `${title}:${content.length}:${category}`;
  };

  // 监听笔记切换，检查并删除空笔记
  useEffect(() => {
    const checkAndDeleteEmptyNote = async () => {
      const prevNote = prevNoteRef.current;
      if (prevNote) {
        // 检查上一个笔记是否为空（标题是默认的"新笔记"且内容为空）
        // 使用保存的 title 和 content，而不是从 currentNote 引用获取
        const isEmptyNote = prevNote.title === '新笔记' && !prevNote.content.trim();
        
        if (isEmptyNote && prevNote.id !== currentNote?.id) {
          try {
            await deleteNote(prevNote.id);
          } catch (error) {
            console.error('Failed to delete empty note:', error);
          }
        }
      }
      // 保存当前笔记的状态（用于下次切换时检查）
      prevNoteRef.current = currentNote ? {
        id: currentNote.id,
        title: title,
        content: content
      } : null;
    };
    
    checkAndDeleteEmptyNote();
  }, [currentNote, deleteNote, title, content]);

  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
      setCategory(currentNote.category);
      setHasChanges(false);
      loadAttachments(currentNote.id);
    }
  }, [currentNote]);

  // 监听存储模式变化
  useEffect(() => {
    const updateStorageMode = () => {
      setStorageMode(getStorageMode());
    };
    updateStorageMode();
    window.addEventListener('storageModeChange', updateStorageMode);
    return () => window.removeEventListener('storageModeChange', updateStorageMode);
  }, []);

  // 同步 ref 与 state
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { categoryRef.current = category; }, [category]);

  // 自动保存函数 - 使用 ref 获取最新值
  const handleAutoSave = async () => {
    if (!currentNote || isSaving) return;

    try {
      setIsSaving(true);
      // 使用 ref 获取最新值，避免闭包问题
      await updateNote(currentNote.id, {
        title: titleRef.current,
        content: contentRef.current,
        category: categoryRef.current
      });
      setHasChanges(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (error) {
      console.error('Auto save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // 自动保存 - 使用 ref 避免依赖问题
  const handleAutoSaveRef = useRef(handleAutoSave);
  handleAutoSaveRef.current = handleAutoSave;

  useEffect(() => {
    if (currentNote && hasChanges) {
      // 清除之前的定时器
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // 记录当前内容哈希
      const currentHash = computeHash(title, content, category);
      contentHashRef.current = currentHash;

      // 3秒后自动保存（如果内容非空且未变化）
      autoSaveTimerRef.current = setTimeout(() => {
        const trimmedContent = contentRef.current.trim();
        const trimmedTitle = titleRef.current.trim();

        // 如果标题和内容都为空，或者标题为默认值且内容为空，不保存
        const isDefaultTitle = trimmedTitle === '新笔记' || trimmedTitle === '无标题笔记';
        if ((!trimmedContent && !trimmedTitle) || (isDefaultTitle && !trimmedContent)) {
          return;
        }

        // 对比哈希，如果内容已变化则跳过（会重新触发定时器）
        const newHash = computeHash(titleRef.current, contentRef.current, categoryRef.current);
        if (newHash !== contentHashRef.current) {
          console.log('Content changed during debounce, skipping auto-save');
          return;
        }

        // 执行保存
        handleAutoSaveRef.current();
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, content, category, hasChanges, currentNote]);

  const loadAttachments = async (noteId: string) => {
    try {
      const atts = await api.getAttachments(noteId);
      setAttachments(atts);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const handleSave = useCallback(async () => {
    if (!currentNote || isSaving) return;

    // 检查是否为空笔记（使用 ref 获取最新值）
    const trimmedContent = contentRef.current.trim();
    const trimmedTitle = titleRef.current.trim();

    if (!trimmedContent && !trimmedTitle) {
      // 空笔记不保存
      return;
    }

    setIsSaving(true);
    try {
      // 使用 ref 获取最新值，避免闭包问题
      await updateNote(currentNote.id, {
        title: titleRef.current,
        content: contentRef.current,
        category: categoryRef.current
      });
      setHasChanges(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [currentNote, isSaving, updateNote]);

  // 键盘快捷键：Ctrl+S / Cmd+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSaveShortcut = (e.ctrlKey || e.metaKey) && e.key === 's';
      if (isSaveShortcut) {
        e.preventDefault();
        if (currentNote && hasChanges) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNote, hasChanges, title, content, category, handleSave]);

  const handleDelete = async () => {
    if (!currentNote) return;
    setShowDeleteDialog(true);
    setIsClosingDialog(false);
  };

  const closeDeleteDialog = () => {
    setIsClosingDialog(true);
    setTimeout(() => {
      setShowDeleteDialog(false);
      setIsClosingDialog(false);
    }, 200);
  };

  const confirmDelete = async () => {
    if (!currentNote) return;
    
    // 先播放关闭动画
    setIsClosingDialog(true);
    
    // 等待动画完成后再删除
    setTimeout(async () => {
      try {
        await deleteNote(currentNote.id);
        setShowDeleteDialog(false);
        setIsClosingDialog(false);
      } catch (error) {
        console.error('Failed to delete:', error);
        alert('删除失败');
        setIsClosingDialog(false);
      }
    }, 200);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasChanges(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setHasChanges(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentNote) return;

    setIsUploading(true);
    setUploadSuccess(false);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          const imageMarkdown = `![${file.name}](${result.url})\n`;
          setContent(prev => prev + imageMarkdown);
          setHasChanges(true);
        }
      }
      
      await loadAttachments(currentNote.id);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('文件上传失败');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (filename: string) => {
    if (!currentNote) return;
    
    if (confirm('确定要删除这个附件吗？')) {
      try {
        await api.deleteAttachment(currentNote.id, filename);
        await loadAttachments(currentNote.id);
      } catch (error) {
        console.error('Failed to delete attachment:', error);
        alert('删除附件失败');
      }
    }
  };

  const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
      'pdf': '📄', 'doc': '📝', 'docx': '📝', 'xls': '📊', 'xlsx': '📊',
      'zip': '📦', 'rar': '📦', '7z': '📦',
      'mp3': '🎵', 'wav': '🎵', 'mp4': '🎬', 'avi': '🎬',
      'txt': '📃', 'md': '📝',
    };
    return icons[ext || ''] || '📎';
  };

  if (!currentNote) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            选择一篇笔记开始编辑，或创建新笔记
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={editorContainerRef}
      className={`flex-1 flex flex-col bg-white dark:bg-gray-900 h-full transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'relative'
      } overflow-y-auto`}
    >
      <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-900">
        <div className="p-2 sm:p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="笔记标题"
              className="text-base sm:text-xl font-bold bg-transparent border-none outline-none flex-1 text-gray-900 dark:text-white placeholder-gray-400 w-full"
            />
            {hasChanges && (
              <span className="text-xs text-orange-500 flex-shrink-0">未保存</span>
            )}
            {/* 存储模式指示器 */}
            {(() => {
              const { icon: Icon, label, color } = getStorageModeInfo(storageMode);
              return (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 ${color} text-xs`} title={`存储: ${label}`}>
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </div>
              );
            })()}
            <div className="flex items-center gap-1 flex-shrink-0">
              <select
                value={category}
                onChange={handleCategoryChange}
                className="px-2 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm max-w-[100px] sm:max-w-[140px]"
                title="选择分类"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="flex items-center justify-center p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[36px] min-h-[36px] touch-manipulation"
                title={isSaving ? '保存中...' : '保存'}
              >
                <Save size={16} className={isSaving ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center justify-center p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors min-w-[36px] min-h-[36px] touch-manipulation"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="flex items-center justify-center p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:bg-gray-800 transition-colors min-w-[36px] min-h-[36px] touch-manipulation"
                  title={isFullscreen ? '退出全屏' : '全屏模式'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="lg:hidden flex items-center justify-center p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 active:bg-gray-700 transition-colors min-w-[36px] min-h-[36px] touch-manipulation"
                  title="关闭"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <BlockNoteEditor
            content={content}
            onChange={handleContentChange}
          />
        </div>
        <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            支持 <a href="https://markdownguide.org/basic-syntax/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Markdown 语法</a> · 输入 <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-[10px]">/</kbd> 打开命令菜单
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          multiple
        />

        <div
          onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              附件 ({attachments.length})
            </span>
            {uploadSuccess && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Check size={12} />
                已保存
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <Upload size={12} />
              {isUploading ? '上传中...' : '上传'}
            </button>
            {isAttachmentsExpanded ? (
              <ChevronDown size={16} className="text-gray-500" />
            ) : (
              <ChevronUp size={16} className="text-gray-500" />
            )}
          </div>
        </div>

        {isAttachmentsExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                💡 图片会自动插入到编辑器中
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">暂无附件</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {attachments.map(att => (
                    <div
                      key={att.filename}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">
                          {getFileIcon(att.filename)}
                        </span>
                        <p className="text-xs text-gray-900 dark:text-white truncate">
                          {att.filename.replace(/^\d+-/, '')}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <a
                          href={att.url}
                          download={att.filename}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="下载"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.filename)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      {showDeleteDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: isClosingDialog ? 'dialogFadeOut 0.2s ease-out forwards' : 'dialogFadeIn 0.2s ease-out'
          }}
          onClick={closeDeleteDialog}
        >
          <div 
            className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-white/20 dark:border-gray-700/50 transition-all duration-200 ease-out"
            style={{ 
              animation: isClosingDialog ? 'dialogScaleOut 0.2s ease-out forwards' : 'dialogScaleIn 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                确认删除
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              确定要删除这篇笔记吗？此操作无法撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteDialog}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 active:bg-red-700 transition-all duration-200 font-medium shadow-lg shadow-red-500/30"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
