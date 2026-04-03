export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  category_id?: string | null;
  tags: string[];
  user: string;
  createdAt: number;
  updatedAt: number;
  created_at?: string;
  updated_at?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface AppState {
  notes: Note[];
  categories: Category[];
  currentNoteId: string | null;
  searchQuery: string;
  selectedCategory: string | null;
}
