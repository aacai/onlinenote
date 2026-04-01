'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Sidebar from '@/components/Sidebar';
import NoteList from '@/components/NoteList';
import NoteEditor from '@/components/NoteEditor';
import { ArrowLeft } from 'lucide-react';
import { useNotes } from '@/contexts/NoteContext';

// 使用 useSyncExternalStore 监听窗口大小
const getIsMobile = () => typeof window !== 'undefined' ? window.innerWidth < 1024 : false;

const subscribeToResize = (callback: () => void) => {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
};

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNoteList, setShowNoteList] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useSyncExternalStore(
    subscribeToResize,
    getIsMobile,
    () => false // 服务端默认值
  );
  const { currentNote, selectNote } = useNotes();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // 移动端：当有当前笔记时，显示编辑器；否则显示笔记列表
  const showEditorOnMobile = isMobile && currentNote !== null;
  const showNoteListOnMobile = isMobile && currentNote === null;

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      {/* 遮罩层 - 只在侧边栏打开且非全屏时显示 */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden ${
          showSidebar && !isFullscreen ? 'block' : 'hidden'
        }`}
        onClick={() => setShowSidebar(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0 ${
          isFullscreen ? '-translate-x-full lg:translate-x-0' : (showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }`}
      >
        <Sidebar onClose={() => setShowSidebar(false)} />
      </aside>

      {/* NoteList - 桌面端始终显示，移动端只在无选中笔记时显示 */}
      <div
        className={`fixed inset-y-0 left-0 lg:left-auto z-20 w-full lg:w-80 transform transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-700 lg:relative lg:z-auto lg:translate-x-0 ${
          isFullscreen 
            ? '-translate-x-full lg:translate-x-0' 
            : (isMobile 
                ? (showNoteListOnMobile ? 'translate-x-0' : '-translate-x-full')
                : (showNoteList ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
              )
        }`}
      >
        <NoteList 
          onSelectNote={() => isMobile && setShowNoteList(false)} 
          onOpenSidebar={() => setShowSidebar(true)}
        />
      </div>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* 移动端顶部导航 - 只在编辑页显示 */}
        {mounted && (
          <div className="lg:hidden flex items-center justify-between gap-2 p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm min-h-[56px]">
            {showEditorOnMobile ? (
              <>
                <button
                  onClick={() => {
                    selectNote(null);
                    setShowNoteList(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  <ArrowLeft size={18} />
                  <span>笔记</span>
                </button>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate absolute left-1/2 -translate-x-1/2 max-w-[50%]">
                  {currentNote?.title || '编辑笔记'}
                </span>
                <div className="w-20" />
              </>
            ) : (
              <div className="w-full" />
            )}
          </div>
        )}

        {/* 编辑器 - 桌面端始终显示，移动端只在有选中笔记时显示 */}
        <div className={`flex-1 h-full ${isMobile ? (currentNote ? 'block' : 'hidden') : 'block'}`}>
          <NoteEditor 
            onClose={() => {
              setShowNoteList(true);
              if (isMobile) {
                selectNote(null);
              }
            }} 
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          />
        </div>
      </main>
    </div>
  );
}
