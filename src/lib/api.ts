import { Note, Category } from '@/types/note';
import { getStorageMode } from './storageConfig';

// 判断是否在 Tauri 环境
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
};

// 调用 Tauri 命令
const invokeTauri = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
};

// 获取 API 基础 URL
const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  return '/api';
};

// 获取请求头
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
    
    try {
      const response = await fetch(`${getApiBase()}/notes`, {
        headers: getHeaders(false),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch notes: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error fetching notes - server may be unreachable');
      }
      throw error;
    }
  },

  createNote: async (note: Partial<Note>): Promise<Note> => {
    if (isTauri()) {
      const tauriNote: Note = {
        id: note.id || crypto.randomUUID(),
        title: note.title || '',
        content: note.content || '',
        category_id: note.category_id || null,
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || new Date().toISOString(),
        is_favorite: note.is_favorite || false,
        is_archived: note.is_archived || false,
      };
      return invokeTauri<Note>('create_note', { note: tauriNote });
    }
    
    const response = await fetch(`${getApiBase()}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(note),
    });
    if (!response.ok) throw new Error('Failed to create note');
    return response.json();
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    if (isTauri()) {
      return invokeTauri<Note>('update_note', { id, updates });
    }
    
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'update', ...updates }),
    });
    if (!response.ok) throw new Error('Failed to update note');
    return response.json();
  },

  deleteNote: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_note', { id });
    }
    
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete note');
  },

  getCategories: async (): Promise<Category[]> => {
    if (isTauri()) {
      return invokeTauri<Category[]>('get_categories');
    }
    
    try {
      const response = await fetch(`${getApiBase()}/categories`, {
        headers: getHeaders(false),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error fetching categories - server may be unreachable');
      }
      throw error;
    }
  },

  addCategory: async (name: string, color: string): Promise<Category> => {
    if (isTauri()) {
      return invokeTauri<Category>('create_category', { name, color });
    }
    
    const response = await fetch(`${getApiBase()}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  deleteCategory: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_category', { id });
    }
    
    const response = await fetch(`${getApiBase()}/categories/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete category');
  },

  uploadFile: async (noteId: string, file: File): Promise<{
    success: boolean;
    filename: string;
    url: string;
    originalName: string;
    size: number;
    type: string;
  }> => {
    // Tauri 模式下暂不支持文件上传
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', noteId);
    
    const response = await fetch(`${getApiBase()}/upload`, {
      method: 'POST',
      headers: { 'x-storage-mode': getStorageMode() },
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  getAttachments: async (noteId: string): Promise<Array<{
    filename: string;
    url: string;
  }>> => {
    const response = await fetch(`${getApiBase()}/attachments/${noteId}`, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return response.json();
  },

  deleteAttachment: async (noteId: string, filename: string): Promise<void> => {
    const response = await fetch(`${getApiBase()}/attachments/${noteId}/${filename}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },
};
