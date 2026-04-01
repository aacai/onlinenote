'use client';

import React from 'react';
import { useNotes } from '@/contexts/NoteContext';
import { Plus, FileText } from 'lucide-react';

interface NoteListProps {
  onSelectNote?: () => void;
}

export default function NoteList({ onSelectNote }: NoteListProps) {
  const {
    notes,
    currentNote,
    searchQuery,
    selectedCategory,
    selectNote,
    createNote,
    setSearchQuery,
    categories,
  } = useNotes();

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateNote = async () => {
    try {
      console.log('Creating note...');
      const newNote = await createNote({
        title: '新笔记',
        content: '',
        category: selectedCategory || '4',
      });
      console.log('Note created:', newNote);
      selectNote(newNote.id);
      if (onSelectNote) {
        onSelectNote();
      }
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('创建笔记失败：' + (error as Error).message);
    }
  };

  const handleSelectNote = (noteId: string) => {
    selectNote(noteId);
    if (onSelectNote) {
      onSelectNote();
    }
  };

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
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索笔记..."
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreateNote}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation"
            title="新建笔记"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <FileText size={48} className="mb-4 opacity-50" />
            <p>暂无笔记</p>
            <button
              onClick={handleCreateNote}
              className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors min-h-[48px] touch-manipulation"
            >
              创建第一篇笔记
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredNotes.map(note => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note.id)}
                className={`w-full text-left p-4 rounded-lg transition-all min-h-[72px] touch-manipulation ${
                  currentNote?.id === note.id
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
                    {note.title}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                  {note.content.substring(0, 100) || '无内容'}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-1 text-xs rounded-full text-white"
                    style={{ backgroundColor: getCategoryColor(note.category) }}
                  >
                    {getCategoryName(note.category)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
