import { Note, Category } from '@/types/note';
import { getStorageConfig } from './storageConfig';

export interface MongoDbLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

let mongoLogs: MongoDbLog[] = [];

const addMongoLog = (level: MongoDbLog['level'], message: string, details?: string) => {
  const log: MongoDbLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  mongoLogs.push(log);
  if (mongoLogs.length > 100) {
    mongoLogs = mongoLogs.slice(-100);
  }
  console.log(`[MONGODB ${level.toUpperCase()}] ${message}`, details || '');
};

export const getMongoLogs = (): MongoDbLog[] => [...mongoLogs];

export const clearMongoLogs = () => {
  mongoLogs = [];
};

const MONGODB_API_BASE = 'https://data.mongodb-api.com/app/onlinewebnote/endpoint/data/v1';
const DATA_SOURCE = 'Cluster0';
const DATABASE = 'markdown_notes';

const getApiKey = (): string => {
  const config = getStorageConfig();
  return config.mongodbApiKey || '';
};

const mongoFetch = async (action: string, collection: string, data?: Record<string, unknown>) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('MongoDB API Key not configured');
  }

  const url = `${MONGODB_API_BASE}/action/${action}`;
  
  const body = {
    dataSource: DATA_SOURCE,
    database: DATABASE,
    collection,
    ...data,
  };

  addMongoLog('info', `API Request: ${action}`, `Collection: ${collection}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    addMongoLog('error', `API Error: ${response.status}`, errorText);
    throw new Error(`MongoDB API error: ${response.status} - ${errorText}`);
  }

  return response.json();
};

export const mongoDbApi = {
  getNotes: async (): Promise<Note[]> => {
    addMongoLog('info', '获取笔记列表...');
    
    try {
      const result = await mongoFetch('find', 'notes', {
        sort: { updatedAt: -1 },
      });
      
      const notes = result.documents || [];
      addMongoLog('success', `获取到 ${notes.length} 条笔记`);
      return notes;
    } catch (error) {
      addMongoLog('error', '获取笔记失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  createNote: async (note: Note): Promise<Note> => {
    addMongoLog('info', '创建笔记...', `ID: ${note.id}`);
    
    try {
      await mongoFetch('insertOne', 'notes', {
        document: note,
      });
      
      addMongoLog('success', '笔记创建成功');
      return note;
    } catch (error) {
      addMongoLog('error', '创建笔记失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    addMongoLog('info', '更新笔记...', `ID: ${id}`);
    
    try {
      const updateData = { ...updates, updatedAt: Date.now() };
      
      await mongoFetch('updateOne', 'notes', {
        filter: { id },
        update: { $set: updateData },
      });
      
      addMongoLog('success', '笔记更新成功');
      return { id, ...updates } as Note;
    } catch (error) {
      addMongoLog('error', '更新笔记失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  deleteNote: async (id: string): Promise<void> => {
    addMongoLog('info', '删除笔记...', `ID: ${id}`);
    
    try {
      await mongoFetch('deleteOne', 'notes', {
        filter: { id },
      });
      
      addMongoLog('success', '笔记删除成功');
    } catch (error) {
      addMongoLog('error', '删除笔记失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  getCategories: async (): Promise<Category[]> => {
    addMongoLog('info', '获取分类列表...');
    
    try {
      const result = await mongoFetch('find', 'categories', {
        sort: { name: 1 },
      });
      
      const categories = result.documents || [];
      addMongoLog('success', `获取到 ${categories.length} 个分类`);
      return categories;
    } catch (error) {
      addMongoLog('error', '获取分类失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  createCategory: async (category: Category): Promise<Category> => {
    addMongoLog('info', '创建分类...', `ID: ${category.id}`);
    
    try {
      await mongoFetch('insertOne', 'categories', {
        document: category,
      });
      
      addMongoLog('success', '分类创建成功');
      return category;
    } catch (error) {
      addMongoLog('error', '创建分类失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },

  deleteCategory: async (id: string): Promise<void> => {
    addMongoLog('info', '删除分类...', `ID: ${id}`);
    
    try {
      await mongoFetch('deleteOne', 'categories', {
        filter: { id },
      });
      
      addMongoLog('success', '分类删除成功');
    } catch (error) {
      addMongoLog('error', '删除分类失败', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  },
};

export const checkMongoDbConnection = async (): Promise<boolean> => {
  clearMongoLogs();
  addMongoLog('info', '开始检查 MongoDB Data API 连接...');

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      addMongoLog('error', 'MongoDB API Key 未配置');
      return false;
    }

    addMongoLog('info', '尝试查询 notes 集合...');
    const startTime = Date.now();
    
    await mongoFetch('find', 'notes', { limit: 1 });
    
    const duration = Date.now() - startTime;
    addMongoLog('success', `MongoDB Data API 连接成功，耗时: ${duration}ms`);
    return true;
  } catch (error) {
    addMongoLog('error', '连接失败', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};
