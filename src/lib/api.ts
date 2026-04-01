import { Note, Category } from '@/types/note';

const API_BASE = '/api';

export const api = {
  getNotes: async (): Promise<Note[]> => {
    const response = await fetch(`${API_BASE}/notes`);
    if (!response.ok) throw new Error('Failed to fetch notes');
    return response.json();
  },

  createNote: async (note: Partial<Note>): Promise<Note> => {
    const response = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (!response.ok) throw new Error('Failed to create note');
    return response.json();
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update note');
    return response.json();
  },

  deleteNote: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete note');
  },

  getCategories: async (): Promise<Category[]> => {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  addCategory: async (name: string, color: string): Promise<Category> => {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  deleteCategory: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
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
    
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  getAttachments: async (noteId: string): Promise<Array<{
    filename: string;
    url: string;
  }>> => {
    const response = await fetch(`${API_BASE}/attachments/${noteId}`);
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return response.json();
  },

  deleteAttachment: async (noteId: string, filename: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/attachments/${noteId}/${filename}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete attachment');
  },
};
