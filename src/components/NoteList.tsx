'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useNotes } from '@/contexts/NoteContext';
import { Plus, FileText, Menu, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, X, CheckSquare, Square, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type SortOrder = 'desc' | 'asc';
type SortField = 'updatedAt' | 'createdAt' | 'title';

interface NoteListProps {
  onSelectNote?: () => void;
  onOpenSidebar?: () => void;
}

interface Attachment {
  filename: string;
  url: string;
}

export default function NoteList({ onSelectNote, onOpenSidebar }: NoteListProps) {
  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClosingDialog, setIsClosingDialog] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [attachmentsMap, setAttachmentsMap] = useState<Map<string, Attachment[]>>(new Map());
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const {
    notes,
    currentNote,
    searchQuery,
    selectedCategory,
    selectNote,
    createNote,
    setSearchQuery,
    deleteNote,
    categories,
  } = useNotes();

  // 防抖搜索 - 使用 ref 避免依赖问题
  const localSearchQueryRef = React.useRef(localSearchQuery);
  localSearchQueryRef.current = localSearchQuery;
  
  useEffect(() => {
    setSearchLoading(true);
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQueryRef.current);
      setSearchLoading(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearchQuery, setSearchQuery]);

  // 同步外部搜索词
  useEffect(() => {
    if (searchQuery !== localSearchQuery) {
      setLocalSearchQuery(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 加载所有笔记的附件
  useEffect(() => {
    const loadAllAttachments = async () => {
      const newMap = new Map<string, Attachment[]>();
      await Promise.all(
        notes.map(async (note) => {
          try {
            const attachments = await api.getAttachments(note.id);
            newMap.set(note.id, attachments);
          } catch {
            newMap.set(note.id, []);
          }
        })
      );
      setAttachmentsMap(newMap);
    };
    
    if (notes.length > 0) {
      loadAllAttachments();
    }
  }, [notes]);

  // 过滤和排序笔记
  const filteredAndSortedNotes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = notes.filter(note => {
      const matchesCategory = !selectedCategory || note.category === selectedCategory;
      
      if (!query) return matchesCategory;
      
      // 搜索标题
      const matchesTitle = note.title.toLowerCase().includes(query);
      // 搜索内容
      const matchesContent = note.content.toLowerCase().includes(query);
      // 搜索附件名称
      const attachments = attachmentsMap.get(note.id) || [];
      const matchesAttachment = attachments.some(att => 
        att.filename.toLowerCase().includes(query)
      );
      
      return matchesCategory && (matchesTitle || matchesContent || matchesAttachment);
    });

    // 排序
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
        default:
          comparison = a.updatedAt - b.updatedAt;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [notes, searchQuery, selectedCategory, sortField, sortOrder, attachmentsMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleCreateNote = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      const newNote = await createNote({
        title: '新笔记',
        content: '',
        category: selectedCategory || '4',
      });
      selectNote(newNote.id);
      if (onSelectNote) {
        onSelectNote();
      }
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('创建笔记失败：' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectNote = (noteId: string) => {
    if (isBatchMode) {
      toggleNoteSelection(noteId);
    } else {
      selectNote(noteId);
      if (onSelectNote) {
        onSelectNote();
      }
    }
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedNotes.size === filteredAndSortedNotes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(filteredAndSortedNotes.map(n => n.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedNotes.size === 0) return;
    setShowDeleteConfirm(true);
    setIsClosingDialog(false);
  };

  const closeDeleteDialog = () => {
    setIsClosingDialog(true);
    setTimeout(() => {
      setShowDeleteConfirm(false);
      setIsClosingDialog(false);
    }, 200);
  };

  const confirmBatchDelete = async () => {
    if (selectedNotes.size === 0) return;
    
    setIsClosingDialog(true);
    setIsDeleting(true);
    
    setTimeout(async () => {
      try {
        await Promise.all(
          Array.from(selectedNotes).map(id => deleteNote(id))
        );
        setSelectedNotes(new Set());
        setIsBatchMode(false);
        setShowDeleteConfirm(false);
        setIsClosingDialog(false);
      } catch (error) {
        console.error('Failed to delete notes:', error);
        alert('删除失败：' + (error as Error).message);
      } finally {
        setIsDeleting(false);
      }
    }, 200);
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedNotes(new Set());
  };

  // 键盘快捷键：Ctrl+A / Cmd+A 全选/取消全选，Delete 删除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isSelectAllShortcut = (e.ctrlKey || e.metaKey) && e.key === 'a';
      const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';

      if (isSelectAllShortcut) {
        e.preventDefault();
        if (!isBatchMode) {
          // 首次按 Ctrl+A：进入批量模式并全选
          setIsBatchMode(true);
          setSelectedNotes(new Set(filteredAndSortedNotes.map(n => n.id)));
        } else if (selectedNotes.size === filteredAndSortedNotes.length && filteredAndSortedNotes.length > 0) {
          // 再次按 Ctrl+A 且已全部选中：取消全选
          setSelectedNotes(new Set());
        } else {
          // 再次按 Ctrl+A 但未全部选中：全选
          setSelectedNotes(new Set(filteredAndSortedNotes.map(n => n.id)));
        }
      }

      if (isDeleteKey && isBatchMode && selectedNotes.size > 0) {
        e.preventDefault();
        handleBatchDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBatchMode, selectedNotes, filteredAndSortedNotes]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '其他';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6b7280';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400" />;
    return sortOrder === 'asc' 
      ? <ArrowUp size={14} className="text-blue-500" />
      : <ArrowDown size={14} className="text-blue-500" />;
  };

  // 服务端渲染时的默认内容
  if (!mounted) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="w-10 h-10 bg-blue-500 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full p-4 bg-white dark:bg-gray-700 rounded-lg h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden flex items-center justify-between gap-2 p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <button
          onClick={onOpenSidebar}
          className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="打开侧边栏"
        >
          <Menu size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate flex-1 text-center px-2">
          笔记列表
        </span>
        <button
          onClick={handleCreateNote}
          disabled={isCreating}
          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation"
          title="新建笔记"
        >
          {isCreating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
        </button>
      </div>

      {/* 搜索和工具栏 */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
        {/* 搜索框 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="搜索标题、内容、附件..."
              className="w-full pl-9 pr-9 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[40px]"
            />
            {searchLoading && (
              <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
            )}
            {localSearchQuery && !searchLoading && (
              <button
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={handleCreateNote}
            disabled={isCreating}
            className="hidden lg:flex p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[40px] min-h-[40px] items-center justify-center touch-manipulation flex-shrink-0"
            title="新建笔记"
          >
            {isCreating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
          </button>
        </div>

        {/* 排序和批量操作工具栏 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSort('updatedAt')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortField === 'updatedAt' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              更新时间
              {getSortIcon('updatedAt')}
            </button>
            <button
              onClick={() => handleSort('createdAt')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortField === 'createdAt' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              创建时间
              {getSortIcon('createdAt')}
            </button>
            <button
              onClick={() => handleSort('title')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortField === 'title' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              标题
              {getSortIcon('title')}
            </button>
          </div>

          <button
            onClick={toggleBatchMode}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isBatchMode 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {isBatchMode ? '退出' : '批量'}
          </button>
        </div>

        {/* 批量操作栏 */}
        {isBatchMode && (
          <div className="flex items-center justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {selectedNotes.size === filteredAndSortedNotes.length && filteredAndSortedNotes.length > 0 ? (
                  <CheckSquare size={16} className="text-blue-500" />
                ) : (
                  <Square size={16} className="text-gray-400" />
                )}
                <span>全选</span>
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                已选 {selectedNotes.size} 项
              </span>
            </div>
            <button
              onClick={handleBatchDelete}
              disabled={selectedNotes.size === 0 || isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              删除
            </button>
          </div>
        )}
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
            <FileText size={40} className="mb-3 opacity-50" />
            <p className="text-sm sm:text-base">
              {searchQuery ? '未找到匹配的笔记' : '暂无笔记'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] touch-manipulation text-sm sm:text-base"
              >
                {isCreating ? '创建中...' : '创建第一篇笔记'}
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredAndSortedNotes.map(note => (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note.id)}
                className={`w-full text-left p-3 sm:p-4 rounded-lg transition-all min-h-[64px] sm:min-h-[72px] touch-manipulation cursor-pointer ${
                  currentNote?.id === note.id && !isBatchMode
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                    : selectedNotes.has(note.id) && isBatchMode
                    ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500'
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* 批量选择框 */}
                  {isBatchMode && (
                    <div className="flex-shrink-0 pt-0.5">
                      {selectedNotes.has(note.id) ? (
                        <CheckSquare size={18} className="text-red-500" />
                      ) : (
                        <Square size={18} className="text-gray-400" />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* 第一行：标题 + 分类标签 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">
                        {note.title}
                      </h3>
                      <span
                        className="px-2 py-0.5 text-xs rounded-full text-white flex-shrink-0"
                        style={{ backgroundColor: getCategoryColor(note.category) }}
                      >
                        {getCategoryName(note.category)}
                      </span>
                    </div>
                    {/* 第二行：内容预览 */}
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-1 mb-1.5">
                      {note.content.substring(0, 100) || '无内容'}
                    </p>
                    {/* 第三行：时间 + 附件数量 */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDate(note.updatedAt)}</span>
                      {(attachmentsMap.get(note.id)?.length || 0) > 0 && (
                        <span>· {attachmentsMap.get(note.id)?.length} 个附件</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 批量删除确认对话框 */}
      {showDeleteConfirm && (
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
              确定要删除选中的 {selectedNotes.size} 篇笔记吗？此操作无法撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 active:bg-red-700 transition-all duration-200 font-medium shadow-lg shadow-red-500/30 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
