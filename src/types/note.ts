export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface AppState {
  notes: Note[];
  categories: Category[];
  currentNoteId: string | null;
  searchQuery: string;
  selectedCategory: string | null;
}
