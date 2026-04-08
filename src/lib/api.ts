import { Note, Category } from '@/types/note';
import { getStorageMode } from './storageConfig';
import { supabaseDb } from './supabase';
import { redisDb } from './redis';
import { mongoDbApi } from './mongodb-api';

const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
};

const invokeTauri = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
};

const getStorageClient = () => {
  const mode = getStorageMode();
  switch (mode) {
    case 'supabase':
      return supabaseDb;
    case 'redis':
      return redisDb;
    case 'mongodb':
      return mongoDbApi;
    default:
      return null;
  }
};

const getHeaders = (contentType = true): HeadersInit => {
  const headers: HeadersInit = {};
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  headers['x-storage-mode'] = getStorageMode();
  return headers;
};

export const api = {
  getNotes: async (): Promise<Note[]> => {
    if (isTauri()) {
      return invokeTauri<Note[]>('get_notes');
    }
    
    const client = getStorageClient();
    if (client) {
      return client.getNotes();
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  createNote: async (note: Partial<Note>): Promise<Note> => {
    if (isTauri()) {
      const tauriNote: Note = {
        id: note.id || crypto.randomUUID(),
        title: note.title || '',
        content: note.content || '',
        category: note.category || '',
        tags: note.tags || [],
        user: note.user || '',
        createdAt: note.createdAt || Date.now(),
        updatedAt: note.updatedAt || Date.now(),
        category_id: note.category_id || null,
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || new Date().toISOString(),
        is_favorite: note.is_favorite || false,
        is_archived: note.is_archived || false,
      };
      return invokeTauri<Note>('create_note', { note: tauriNote });
    }
    
    const client = getStorageClient();
    if (client) {
      const newNote: Note = {
        id: note.id || crypto.randomUUID(),
        title: note.title || '',
        content: note.content || '',
        category: note.category || '',
        tags: note.tags || [],
        user: note.user || '',
        createdAt: note.createdAt || Date.now(),
        updatedAt: note.updatedAt || Date.now(),
        category_id: note.category_id || null,
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || new Date().toISOString(),
        is_favorite: note.is_favorite || false,
        is_archived: note.is_archived || false,
      };
      return client.createNote(newNote);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    if (isTauri()) {
      return invokeTauri<Note>('update_note', { id, updates });
    }
    
    const client = getStorageClient();
    if (client) {
      return client.updateNote(id, updates);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  deleteNote: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_note', { id });
    }
    
    const client = getStorageClient();
    if (client) {
      return client.deleteNote(id);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  getCategories: async (): Promise<Category[]> => {
    if (isTauri()) {
      return invokeTauri<Category[]>('get_categories');
    }
    
    const client = getStorageClient();
    if (client) {
      return client.getCategories();
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  addCategory: async (name: string, color: string): Promise<Category> => {
    if (isTauri()) {
      return invokeTauri<Category>('create_category', { name, color });
    }
    
    const client = getStorageClient();
    if (client) {
      const newCategory: Category = {
        id: crypto.randomUUID(),
        name,
        color,
      };
      return client.createCategory(newCategory);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  deleteCategory: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_category', { id });
    }
    
    const client = getStorageClient();
    if (client) {
      return client.deleteCategory(id);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  uploadFile: async (noteId: string, file: File): Promise<{
    success: boolean;
    filename: string;
    url: string;
    originalName: string;
    size: number;
    type: string;
  }> => {
    if (isTauri()) {
      throw new Error('File upload not supported in Tauri mode yet');
    }
    
    throw new Error('File upload requires server environment. Use Supabase Storage for file attachments in static export mode.');
  },

  getAttachments: async (noteId: string): Promise<Array<{
    filename: string;
    url: string;
  }>> => {
    if (isTauri()) {
      return invokeTauri<Array<{ filename: string; url: string }>>('get_attachments', { noteId });
    }
    
    return [];
  },

  deleteAttachment: async (noteId: string, filename: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_attachment', { noteId, filename });
    }
    
    throw new Error('File operations require Tauri environment');
  },
};
