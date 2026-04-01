'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useNotes } from '@/contexts/NoteContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Save, Trash2, X, Upload, FileText, Download, Paperclip, Check } from 'lucide-react';
import { api } from '@/lib/api';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface NoteEditorProps {
  onClose?: () => void;
}

interface Attachment {
  filename: string;
  url: string;
}

export default function NoteEditor({ onClose }: NoteEditorProps) {
  const { currentNote, updateNote, deleteNote, categories, uploadFile } = useNotes();
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
      setCategory(currentNote.category);
      setHasChanges(false);
      loadAttachments(currentNote.id);
    }
  }, [currentNote]);

  const loadAttachments = async (noteId: string) => {
    try {
      const atts = await api.getAttachments(noteId);
      setAttachments(atts);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const handleSave = async () => {
    if (currentNote) {
      await updateNote(currentNote.id, { title, content, category });
      setHasChanges(false);
    }
  };

  const handleDelete = async () => {
    if (currentNote && confirm('确定要删除这篇笔记吗？')) {
      await deleteNote(currentNote.id);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasChanges(true);
  };

  const handleContentChange = (value: string | undefined) => {
    setContent(value || '');
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
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            选择一篇笔记开始编辑，或创建新笔记
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="笔记标题"
            className="text-2xl font-bold bg-transparent border-none outline-none flex-1 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {hasChanges && (
            <span className="text-sm text-orange-500">未保存</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px] touch-manipulation"
          >
            <Save size={20} />
            <span className="hidden sm:inline">保存笔记</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors min-h-[48px] touch-manipulation"
          >
            <Trash2 size={20} />
            <span className="hidden sm:inline">删除</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden flex items-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 active:bg-gray-700 transition-colors min-h-[48px] touch-manipulation"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <select
          value={category}
          onChange={handleCategoryChange}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-hidden" data-color-mode={theme}>
        <MDEditor
          value={content}
          onChange={handleContentChange}
          height="100%"
          preview="live"
          hideToolbar={false}
          enableScroll={true}
          visibleDragbar={false}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Paperclip size={18} />
              附件管理 ({attachments.length})
              {uploadSuccess && (
                <span className="text-sm text-green-500 flex items-center gap-1 ml-2">
                  <Check size={14} />
                  已自动保存
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                multiple
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm min-h-[48px] touch-manipulation"
              >
                <Upload size={18} />
                {isUploading ? '上传中...' : '上传文件'}
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            💡 提示：附件上传后会立即自动保存，无需点击"保存笔记"按钮。图片会自动插入到编辑器中。
          </div>

          {attachments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Paperclip size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无附件，点击上方按钮上传文件</p>
              <p className="text-xs mt-1">支持任意类型文件，无大小限制</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {attachments.map(att => (
                <div
                  key={att.filename}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {getFileIcon(att.filename)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate font-medium">
                        {att.filename.replace(/^\d+-/, '')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {att.filename}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={att.url}
                      download={att.filename}
                      className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="下载"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att.filename)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
