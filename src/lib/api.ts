import { Note, Category } from '@/types/note';
import { getStorageMode } from './storageConfig';

const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
};

const invokeTauri = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
};

const getStorageClient = async () => {
  const mode = getStorageMode();
  switch (mode) {
    case 'supabase': {
      const { supabaseDb } = await import('./supabase');
      return supabaseDb;
    }
    case 'redis': {
      const { redisDb } = await import('./redis');
      return redisDb;
    }
    case 'mongodb': {
      const { mongoDbApi } = await import('./mongodb-api');
      return mongoDbApi;
    }
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
    
    const client = await getStorageClient();
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
    
    const client = await getStorageClient();
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
    
    const client = await getStorageClient();
    if (client) {
      return client.updateNote(id, updates);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  deleteNote: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_note', { id });
    }
    
    const client = await getStorageClient();
    if (client) {
      return client.deleteNote(id);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  getCategories: async (): Promise<Category[]> => {
    if (isTauri()) {
      return invokeTauri<Category[]>('get_categories');
    }
    
    const client = await getStorageClient();
    if (client) {
      return client.getCategories();
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  addCategory: async (name: string, color: string): Promise<Category> => {
    if (isTauri()) {
      return invokeTauri<Category>('create_category', { name, color });
    }
    
    const client = await getStorageClient();
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
    
    const client = await getStorageClient();
    if (client) {
      return client.deleteCategory(id);
    }
    
    throw new Error('Local storage mode requires Tauri environment');
  },

  uploadFile: async (
    noteId: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<{
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
    
    const storageMode = getStorageMode();
    
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('./supabaseFileStorage');
      const { getStorageConfig } = await import('./storageConfig');
      const config = getStorageConfig();
      
      if (onProgress) {
        onProgress(10);
        await new Promise(r => setTimeout(r, 50));
        onProgress(30);
        await new Promise(r => setTimeout(r, 100));
        onProgress(60);
      }
      
      const result = await supabaseFileStorage.uploadFile(
        noteId, 
        file, 
        onProgress,
        !!config.supabaseServiceKey
      );
      
      if (onProgress) onProgress(100);
      
      return {
        success: true,
        filename: result.filename,
        url: result.url,
        originalName: file.name,
        size: file.size,
        type: file.type,
      };
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', noteId);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-storage-mode': storageMode },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  getAttachments: async (noteId: string): Promise<Array<{
    filename: string;
    url: string;
  }>> => {
    if (isTauri()) {
      return invokeTauri<Array<{ filename: string; url: string }>>('get_attachments', { noteId });
    }
    
    const storageMode = getStorageMode();
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('./supabaseFileStorage');
      const { getStorageConfig } = await import('./storageConfig');
      const config = getStorageConfig();
      const attachments = await supabaseFileStorage.getNoteAttachments(noteId, !!config.supabaseServiceKey);
      return attachments.map((filename: string) => ({
        filename,
        url: supabaseFileStorage.getAttachmentUrl(noteId, filename),
      }));
    }
    
    const response = await fetch(`/api/attachments/${noteId}`, {
      headers: { 'x-storage-mode': getStorageMode() },
    });
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return response.json();
  },

  deleteAttachment: async (noteId: string, filename: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_attachment', { noteId, filename });
    }
    
    const storageMode = getStorageMode();
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('./supabaseFileStorage');
      const { getStorageConfig } = await import('./storageConfig');
      const config = getStorageConfig();
      await supabaseFileStorage.deleteAttachment(noteId, filename, !!config.supabaseServiceKey);
      return;
    }
    
    const response = await fetch(`/api/attachments/${noteId}/${filename}`, {
      method: 'POST',
      headers: { 'x-storage-mode': getStorageMode() },
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },
};
