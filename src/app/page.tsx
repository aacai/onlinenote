'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import NoteList from '@/components/NoteList';
import NoteEditor from '@/components/NoteEditor';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNoteList, setShowNoteList] = useState(true);

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden ${
          showSidebar ? 'block' : 'hidden'
        }`}
        onClick={() => setShowSidebar(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </aside>

      <div
        className={`fixed inset-y-0 left-64 z-20 w-80 transform transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-700 lg:relative lg:z-auto lg:left-0 lg:translate-x-0 ${
          showNoteList ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <NoteList onSelectNote={() => setShowNoteList(false)} />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="lg:hidden flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Menu size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setShowNoteList(!showNoteList)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {showNoteList ? (
              <X size={20} className="text-gray-700 dark:text-gray-300" />
            ) : (
              <Menu size={20} className="text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>

        <NoteEditor onClose={() => setShowNoteList(true)} />
      </main>
    </div>
  );
}
