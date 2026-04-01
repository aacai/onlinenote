import { Note, Category } from '@/types/note';
import { getStorageConfig } from './storageConfig';

const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  return '';
};

// 日志类型
export interface MongoDBLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

// 日志存储
let mongodbLogs: MongoDBLog[] = [];

// 添加日志
export const addMongoDBLog = (level: MongoDBLog['level'], message: string, details?: string) => {
  const log: MongoDBLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  mongodbLogs.push(log);
  if (mongodbLogs.length > 100) {
    mongodbLogs = mongodbLogs.slice(-100);
  }
  console.log(`[MONGODB ${level.toUpperCase()}] ${message}`, details || '');
};

// 获取日志
export const getMongoDBLogs = (): MongoDBLog[] => [...mongodbLogs];

// 清空日志
export const clearMongoDBLogs = () => {
  mongodbLogs = [];
};

// 检查 MongoDB 连接（通过 API 调用）
export const checkMongoDBConnection = async (): Promise<boolean> => {
  clearMongoDBLogs();
  addMongoDBLog('info', '开始检查 MongoDB 连接...');

  try {
    const config = getStorageConfig();
    addMongoDBLog('info', '配置信息', `准备测试连接`);

    // 通过 API 测试连接
    addMongoDBLog('info', '发送测试请求...');
    const startTime = Date.now();

    const response = await fetch('/api/mongodb-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uri: config.mongodbUri,
      }),
    });

    const duration = Date.now() - startTime;
    const result = await response.json();

    addMongoDBLog('info', '请求完成', `耗时: ${duration}ms, 状态: ${response.status}`);

    if (response.ok && result.success) {
      addMongoDBLog('success', 'MongoDB 连接成功', result.message);
      return true;
    } else {
      addMongoDBLog('error', 'MongoDB 连接失败', result.error || '未知错误');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    addMongoDBLog('error', '连接异常', errorMessage);
    return false;
  }
};

// MongoDB 数据库操作（通过 API 调用）
export const mongodbDb = {
  // 获取所有笔记
  getNotes: async (): Promise<Note[]> => {
    addMongoDBLog('info', '获取笔记列表...');

    const response = await fetch(`${getApiBaseUrl()}/api/notes`, {
      headers: {
        'x-storage-mode': 'mongodb',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notes');
    }

    const notes = await response.json();
    addMongoDBLog('success', `获取到 ${notes.length} 条笔记`);
    return notes;
  },

  // 创建笔记
  createNote: async (note: Note): Promise<Note> => {
    addMongoDBLog('info', '创建笔记...', `ID: ${note.id}`);

    const response = await fetch(`${getApiBaseUrl()}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-storage-mode': 'mongodb',
      },
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      throw new Error('Failed to create note');
    }

    const created = await response.json();
    addMongoDBLog('success', '笔记创建成功');
    return created;
  },

  // 更新笔记
  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    addMongoDBLog('info', '更新笔记...', `ID: ${id}`);

    const response = await fetch(`${getApiBaseUrl()}/api/notes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-storage-mode': 'mongodb',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update note');
    }

    const updated = await response.json();
    addMongoDBLog('success', '笔记更新成功');
    return updated;
  },

  // 删除笔记
  deleteNote: async (id: string): Promise<void> => {
    addMongoDBLog('info', '删除笔记...', `ID: ${id}`);

    const response = await fetch(`${getApiBaseUrl()}/api/notes/${id}`, {
      method: 'DELETE',
      headers: {
        'x-storage-mode': 'mongodb',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete note');
    }

    addMongoDBLog('success', '笔记删除成功');
  },

  // 获取所有分类
  getCategories: async (): Promise<Category[]> => {
    addMongoDBLog('info', '获取分类列表...');

    const response = await fetch(`${getApiBaseUrl()}/api/categories`, {
      headers: {
        'x-storage-mode': 'mongodb',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const categories = await response.json();
    addMongoDBLog('success', `获取到 ${categories.length} 个分类`);
    return categories;
  },

  // 创建分类
  createCategory: async (category: Category): Promise<Category> => {
    addMongoDBLog('info', '创建分类...', `ID: ${category.id}`);

    const response = await fetch(`${getApiBaseUrl()}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-storage-mode': 'mongodb',
      },
      body: JSON.stringify(category),
    });

    if (!response.ok) {
      throw new Error('Failed to create category');
    }

    const created = await response.json();
    addMongoDBLog('success', '分类创建成功');
    return created;
  },

  // 删除分类
  deleteCategory: async (id: string): Promise<void> => {
    addMongoDBLog('info', '删除分类...', `ID: ${id}`);

    const response = await fetch(`${getApiBaseUrl()}/api/categories/${id}`, {
      method: 'DELETE',
      headers: {
        'x-storage-mode': 'mongodb',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete category');
    }

    addMongoDBLog('success', '分类删除成功');
  },

  // 批量同步笔记
  syncNotes: async (notes: Note[]): Promise<void> => {
    addMongoDBLog('info', '批量同步笔记...', `数量: ${notes.length}`);

    // 通过逐个创建/更新来实现同步
    for (const note of notes) {
      try {
        await mongodbDb.updateNote(note.id, note);
      } catch {
        // 如果不存在则创建
        await mongodbDb.createNote(note);
      }
    }

    addMongoDBLog('success', '笔记同步完成');
  },

  // 批量同步分类
  syncCategories: async (categories: Category[]): Promise<void> => {
    addMongoDBLog('info', '批量同步分类...', `数量: ${categories.length}`);

    // 获取现有分类
    const existingCategories = await mongodbDb.getCategories();
    const existingIds = new Set(existingCategories.map(c => c.id));

    // 创建新分类
    for (const category of categories) {
      if (!existingIds.has(category.id)) {
        await mongodbDb.createCategory(category);
      }
    }

    addMongoDBLog('success', '分类同步完成');
  },
};
