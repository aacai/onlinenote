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

// 获取 API 基础 URL，支持客户端和服务器端
const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    // 服务器端：使用环境变量或默认值
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api`;
  }
  // 客户端：使用相对路径
  return '/api';
};

// 获取请求头，包含存储模式
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

    // 非 Tauri 环境：使用 HTTP API 路由
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

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(note),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create note' }));
      throw new Error(error.error || 'Failed to create note');
    }
    return response.json();
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    if (isTauri()) {
      return invokeTauri<Note>('update_note', { id, updates });
    }

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'update', ...updates }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update note' }));
      throw new Error(error.error || 'Failed to update note');
    }
    return response.json();
  },

  deleteNote: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_note', { id });
    }

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete note' }));
      throw new Error(error.error || 'Failed to delete note');
    }
  },

  getCategories: async (): Promise<Category[]> => {
    if (isTauri()) {
      return invokeTauri<Category[]>('get_categories');
    }

    // 非 Tauri 环境：使用 HTTP API 路由
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

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create category' }));
      throw new Error(error.error || 'Failed to create category');
    }
    return response.json();
  },

  deleteCategory: async (id: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_category', { id });
    }

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/categories/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete category' }));
      throw new Error(error.error || 'Failed to delete category');
    }
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

    // 非 Tauri 环境：使用 HTTP API 路由
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
    if (isTauri()) {
      return invokeTauri<Array<{ filename: string; url: string }>>('get_attachments', { noteId });
    }

    // 非 Tauri 环境：使用 HTTP API 路由
    try {
      const response = await fetch(`${getApiBase()}/attachments/${noteId}`, {
        headers: getHeaders(false),
      });
      if (!response.ok) {
        // 静态导出模式下附件功能不可用，返回空数组
        return [];
      }
      return response.json();
    } catch {
      // 请求失败时返回空数组
      return [];
    }
  },

  deleteAttachment: async (noteId: string, filename: string): Promise<void> => {
    if (isTauri()) {
      return invokeTauri<void>('delete_attachment', { noteId, filename });
    }

    // 非 Tauri 环境：使用 HTTP API 路由
    const response = await fetch(`${getApiBase()}/attachments/${noteId}/${filename}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },
};
