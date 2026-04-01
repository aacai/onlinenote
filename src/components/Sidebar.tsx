'use client';

import React, { useState, useEffect } from 'react';
import { useNotes } from '@/contexts/NoteContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Folder, Plus, X, Sun, Moon, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    addCategory,
    deleteCategory,
    notes,
  } = useNotes();
  const { theme, toggleTheme } = useTheme();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const predefinedColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  ];

  const getNoteCountByCategory = (categoryId: string) => {
    return notes.filter(note => note.category === categoryId).length;
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      await addCategory(newCategoryName.trim(), newCategoryColor);
      setNewCategoryName('');
      setNewCategoryColor('#3b82f6');
      setIsAddingCategory(false);
    }
  };

  const handleAddCategoryClick = () => {
    if (isCollapsed && !isMobile) {
      setIsCollapsed(false);
    }
    setIsAddingCategory(true);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('确定要删除这个分类吗？')) {
      await deleteCategory(id);
    }
  };

  if (!mounted) {
    return (
      <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-64">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📝</span>
              <span className="hidden sm:inline">Markdown 笔记</span>
              <span className="sm:hidden">笔记</span>
            </h1>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                分类
              </h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className={`text-base sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
            <span className="text-xl sm:text-2xl">📝</span>
            {!isCollapsed && (
              <>
                <span className="hidden sm:inline">Markdown 笔记</span>
                <span className="sm:hidden">笔记</span>
              </>
            )}
          </h1>
        </div>
        <div className={`flex items-center justify-between mt-3 ${isCollapsed && !isMobile ? 'flex-col gap-2' : ''}`}>
          <button
            onClick={toggleTheme}
            className="p-2.5 sm:p-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-colors min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] touch-manipulation"
            title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
          >
            {theme === 'light' ? (
              <Moon size={22} className="text-gray-700" />
            ) : (
              <Sun size={22} className="text-yellow-400" />
            )}
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2.5 sm:p-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-colors min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] touch-manipulation"
              title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {isCollapsed ? (
                <ChevronRight size={22} className="text-gray-700 dark:text-gray-300" />
              ) : (
                <ChevronLeft size={22} className="text-gray-700 dark:text-gray-300" />
              )}
            </button>
          )}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-2.5 sm:p-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-colors min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] touch-manipulation"
              title="关闭侧边栏"
            >
              <X size={22} className="text-gray-700 dark:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                分类
              </h2>
              <button
              onClick={handleAddCategoryClick}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors min-w-[40px] min-h-[40px] touch-manipulation"
              title="添加分类"
            >
              <Plus size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
            </div>

            {isAddingCategory && (
              <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="分类名称"
                  className="w-full px-3 py-2 mb-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2 mb-2">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        newCategoryColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCategory}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors min-h-[40px]"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded text-sm hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors min-h-[40px]"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <button
                onClick={() => handleCategorySelect(null)}
                className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-3 rounded-lg transition-colors min-h-[44px] sm:min-h-[48px] touch-manipulation ${
                  selectedCategory === null
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Tag size={16} />
                  <span className="text-sm">全部笔记</span>
                </span>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                  {notes.length}
                </span>
              </button>

              {categories.map(category => (
                <div
                  key={category.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <button
                    onClick={() => handleCategorySelect(category.id)}
                    className="flex items-center gap-2 flex-1"
                  >
                    <Folder size={16} style={{ color: category.color }} />
                    <span className="text-sm">{category.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                      {getNoteCountByCategory(category.id)}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-all min-w-[36px] min-h-[36px]"
                      title="删除分类"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col items-center gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`p-3 rounded-lg transition-colors min-w-[44px] min-h-[44px] touch-manipulation ${
              selectedCategory === null
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
            title="全部笔记"
          >
            <Tag size={20} className={selectedCategory === null ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'} />
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-3 rounded-lg transition-colors min-w-[44px] min-h-[44px] touch-manipulation ${
                selectedCategory === category.id
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              title={category.name}
            >
              <Folder size={20} style={{ color: category.color }} />
            </button>
          ))}
          <button
            onClick={handleAddCategoryClick}
            className="p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] touch-manipulation mt-2"
            title="添加分类"
          >
            <Plus size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>文件存储 · 数据可移植</p>
            <p className="mt-1">共 {notes.length} 篇笔记</p>
            <p className="mt-1 text-blue-500 dark:text-blue-400">data/ 目录</p>
          </div>
        </div>
      )}
    </div>
  );
}
