import { Note, Category } from '@/types/note';

const NOTES_KEY = 'markdown_notes';
const CATEGORIES_KEY = 'markdown_categories';
const THEME_KEY = 'markdown_theme';

export const storage = {
  getNotes: (): Note[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(NOTES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveNotes: (notes: Note[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  },

  getCategories: (): Category[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(CATEGORIES_KEY);
    return data ? JSON.parse(data) : getDefaultCategories();
  },

  saveCategories: (categories: Category[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },

  getTheme: (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    const theme = localStorage.getItem(THEME_KEY);
    return (theme as 'light' | 'dark') || 'light';
  },

  saveTheme: (theme: 'light' | 'dark'): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
  },
};

const getDefaultCategories = (): Category[] => {
  return [
    { id: '1', name: '工作', color: '#3b82f6' },
    { id: '2', name: '学习', color: '#10b981' },
    { id: '3', name: '生活', color: '#f59e0b' },
    { id: '4', name: '其他', color: '#6b7280' },
  ];
};
