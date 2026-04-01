import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');

export const fileStorage = {
  init: () => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ATTACHMENTS_DIR)) {
      fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(NOTES_FILE)) {
      fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(CATEGORIES_FILE)) {
      const defaultCategories = [
        { id: '1', name: '工作', color: '#3b82f6' },
        { id: '2', name: '学习', color: '#10b981' },
        { id: '3', name: '生活', color: '#f59e0b' },
        { id: '4', name: '其他', color: '#6b7280' },
      ];
      fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(defaultCategories, null, 2));
    }
  },

  getNotes: () => {
    try {
      const data = fs.readFileSync(NOTES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveNotes: (notes: any[]) => {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  },

  getCategories: () => {
    try {
      const data = fs.readFileSync(CATEGORIES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [
        { id: '1', name: '工作', color: '#3b82f6' },
        { id: '2', name: '学习', color: '#10b981' },
        { id: '3', name: '生活', color: '#f59e0b' },
        { id: '4', name: '其他', color: '#6b7280' },
      ];
    }
  },

  saveCategories: (categories: any[]) => {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
  },

  saveAttachment: (noteId: string, filename: string, buffer: Buffer) => {
    const noteAttachmentDir = path.join(ATTACHMENTS_DIR, noteId);
    if (!fs.existsSync(noteAttachmentDir)) {
      fs.mkdirSync(noteAttachmentDir, { recursive: true });
    }
    const filePath = path.join(noteAttachmentDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/api/attachments/${noteId}/${filename}`;
  },

  getAttachment: (noteId: string, filename: string) => {
    const filePath = path.join(ATTACHMENTS_DIR, noteId, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  },

  deleteAttachment: (noteId: string, filename: string) => {
    const filePath = path.join(ATTACHMENTS_DIR, noteId, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },

  deleteNoteAttachments: (noteId: string) => {
    const noteAttachmentDir = path.join(ATTACHMENTS_DIR, noteId);
    if (fs.existsSync(noteAttachmentDir)) {
      fs.rmSync(noteAttachmentDir, { recursive: true, force: true });
    }
  },

  getNoteAttachments: (noteId: string) => {
    const noteAttachmentDir = path.join(ATTACHMENTS_DIR, noteId);
    if (!fs.existsSync(noteAttachmentDir)) {
      return [];
    }
    return fs.readdirSync(noteAttachmentDir);
  },
};
