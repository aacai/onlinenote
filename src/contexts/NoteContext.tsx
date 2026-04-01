'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Note, Category } from '@/types/note';
import { api } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

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

export function NoteProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const refreshNotes = useCallback(async () => {
    try {
      const [notesData, categoriesData] = await Promise.all([
        api.getNotes(),
        api.getCategories(),
      ]);
      setNotes(notesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  // 使用 useEffect 只用于数据获取，避免直接 setState
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (isMounted) {
        await refreshNotes();
      }
    };
    init();
    return () => { isMounted = false; };
  }, [refreshNotes]);

  const createNote = useCallback(async (noteData: Partial<Note>): Promise<Note> => {
    const newNote = await api.createNote({
      id: uuidv4(),
      title: noteData.title || '无标题笔记',
      content: noteData.content || '',
      category: noteData.category || '4',
      tags: noteData.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await refreshNotes();
    // 延迟选中新创建的笔记，确保刷新完成
    setTimeout(() => {
      setCurrentNote(newNote);
    }, 50);
    return newNote;
  }, [refreshNotes]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    await api.updateNote(id, updates);
    await refreshNotes();
    if (currentNote?.id === id) {
      setCurrentNote(prev => prev ? { ...prev, ...updates, updatedAt: Date.now() } : null);
    }
  }, [currentNote, refreshNotes]);

  const deleteNote = useCallback(async (id: string) => {
    await api.deleteNote(id);
    await refreshNotes();
    if (currentNote?.id === id) {
      setCurrentNote(null);
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
