'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { Note, Category } from '@/types/note';
import { api } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import { addPendingChange, scheduleSync } from '@/lib/sync';

interface NoteContextType {
  notes: Note[];
  categories: Category[];
  currentNote: Note | null;
  searchQuery: string;
  selectedCategory: string | null;
  createNote: (note: Partial<Note>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  addCategory: (name: string, color: string) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  uploadFile: (file: File) => Promise<{ url: string; filename: string }>;
  refreshNotes: () => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

function deduplicateNotes<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function NoteProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 使用 useSyncExternalStore 检测组件是否已挂载（React 19 推荐方式）
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const refreshNotes = useCallback(async () => {
    try {
      const [notesData, categoriesData] = await Promise.all([
        api.getNotes(),
        api.getCategories(),
      ]);
      setNotes(deduplicateNotes(notesData));
      setCategories(deduplicateNotes(categoriesData));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  // 使用 useEffect 只用于数据获取，避免直接 setState
  useEffect(() => {
    if (!mounted) return;
    
    let isMounted = true;
    const init = async () => {
      if (isMounted) {
        await refreshNotes();
      }
    };
    init();
    return () => { isMounted = false; };
  }, [refreshNotes, mounted]);

  const createNote = useCallback(async (noteData: Partial<Note>): Promise<Note> => {
    const newNote: Note = {
      id: uuidv4(),
      title: noteData.title || '无标题笔记',
      content: noteData.content || '',
      category: noteData.category || '4',
      tags: noteData.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // 添加到待同步队列
    addPendingChange({ type: 'create', entity: 'note', data: newNote });
    
    try {
      const created = await api.createNote(newNote);
      await refreshNotes();
      // 延迟选中新创建的笔记，确保刷新完成
      setTimeout(() => {
        setCurrentNote(created);
      }, 50);
      // 触发自动同步
      scheduleSync(3000);
      return created;
    } catch (error) {
      // API 失败时，数据已在待同步队列，下次联网时会自动同步
      console.log('Note created locally, will sync when online');
      setNotes(prev => deduplicateNotes([newNote, ...prev]));
      setCurrentNote(newNote);
      return newNote;
    }
  }, [refreshNotes]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const updateData = { ...updates, updatedAt: Date.now() };
    
    // 添加到待同步队列
    addPendingChange({ type: 'update', entity: 'note', data: { id, ...updateData } });
    
    // 乐观更新本地状态
    if (currentNote?.id === id) {
      setCurrentNote(prev => prev ? { ...prev, ...updateData } : null);
    }
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updateData } : n));
    
    try {
      await api.updateNote(id, updates);
      await refreshNotes();
      scheduleSync(3000);
    } catch (error) {
      console.log('Note updated locally, will sync when online');
    }
  }, [currentNote, refreshNotes]);

  const deleteNote = useCallback(async (id: string) => {
    // 添加到待同步队列
    addPendingChange({ type: 'delete', entity: 'note', data: { id } });
    
    // 乐观更新本地状态
    setNotes(prev => prev.filter(n => n.id !== id));
    if (currentNote?.id === id) {
      setCurrentNote(null);
    }
    
    try {
      await api.deleteNote(id);
      await refreshNotes();
      scheduleSync(3000);
    } catch (error) {
      console.log('Note deleted locally, will sync when online');
    }
  }, [currentNote, refreshNotes]);

  const selectNote = useCallback((id: string | null) => {
    if (id) {
      const note = notes.find(n => n.id === id);
      setCurrentNote(note || null);
    } else {
      setCurrentNote(null);
    }
  }, [notes]);

  const addCategory = useCallback(async (name: string, color: string): Promise<Category> => {
    const newCategory = await api.addCategory(name, color);
    await refreshNotes();
    return newCategory;
  }, [refreshNotes]);

  const deleteCategory = useCallback(async (id: string) => {
    await api.deleteCategory(id);
    await refreshNotes();
  }, [refreshNotes]);

  const uploadFile = useCallback(async (file: File): Promise<{ url: string; filename: string }> => {
    if (!currentNote) {
      throw new Error('No note selected');
    }
    const result = await api.uploadFile(currentNote.id, file);
    return { url: result.url, filename: result.filename };
  }, [currentNote]);

  return (
    <NoteContext.Provider
      value={{
        notes,
        categories,
        currentNote,
        searchQuery,
        selectedCategory,
        createNote,
        updateNote,
        deleteNote,
        selectNote,
        setSearchQuery,
        setSelectedCategory,
        addCategory,
        deleteCategory,
        uploadFile,
        refreshNotes,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NoteProvider');
  }
  return context;
}
