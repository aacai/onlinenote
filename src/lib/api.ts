import { Note, Category } from '@/types/note';
import { getStorageMode } from './storageConfig';

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
    const response = await fetch(`${getApiBase()}/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(note),
    });
    if (!response.ok) throw new Error('Failed to create note');
    return response.json();
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'update', ...updates }),
    });
    if (!response.ok) throw new Error('Failed to update note');
    return response.json();
  },

  deleteNote: async (id: string): Promise<void> => {
    const response = await fetch(`${getApiBase()}/notes/${id}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action: 'delete' }),
    });
    if (!response.ok) throw new Error('Failed to delete note');
  },

  getCategories: async (): Promise<Category[]> => {
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
    const response = await fetch(`${getApiBase()}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  deleteCategory: async (id: string): Promise<void> => {
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
