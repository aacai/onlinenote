import { Redis } from '@upstash/redis';
import { Note, Category } from '@/types/note';
import { getStorageConfig } from './storageConfig';

// 日志类型
export interface RedisLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

// 日志存储
let redisLogs: RedisLog[] = [];

// 添加日志
export const addRedisLog = (level: RedisLog['level'], message: string, details?: string) => {
  const log: RedisLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  redisLogs.push(log);
  if (redisLogs.length > 100) {
    redisLogs = redisLogs.slice(-100);
  }
  console.log(`[REDIS ${level.toUpperCase()}] ${message}`, details || '');
};

// 获取日志
export const getRedisLogs = (): RedisLog[] => [...redisLogs];

// 清空日志
export const clearRedisLogs = () => {
  redisLogs = [];
};

// 创建 Redis 客户端
const createRedisClient = () => {
  const config = getStorageConfig();
  addRedisLog('info', '创建 Redis 客户端', `URL: ${config.redisUrl}`);
  return new Redis({
    url: config.redisUrl,
    token: config.redisToken,
  });
};

// 检查 Redis 连接
export const checkRedisConnection = async (): Promise<boolean> => {
  clearRedisLogs();
  addRedisLog('info', '开始检查 Redis 连接...');

  try {
    const config = getStorageConfig();
    addRedisLog('info', '配置信息', `URL: ${config.redisUrl}`);

    const redis = createRedisClient();
    addRedisLog('info', '客户端创建成功');

    // 测试连接
    addRedisLog('info', '尝试 ping 测试...');
    const startTime = Date.now();
    const result = await redis.ping();
    const duration = Date.now() - startTime;

    addRedisLog('info', 'Ping 完成', `结果: ${result}, 耗时: ${duration}ms`);

    if (result === 'PONG') {
      addRedisLog('success', 'Redis 连接成功');
      return true;
    } else {
      addRedisLog('error', 'Redis 连接失败', `返回: ${result}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorStack = error instanceof Error ? error.stack : '';
    addRedisLog('error', '连接异常', errorMessage);
    if (errorStack) {
      addRedisLog('error', '错误堆栈', errorStack);
    }
    return false;
  }
};

// Redis 数据键名
const KEYS = {
  notes: 'markdown_notes:data:notes',
  categories: 'markdown_notes:data:categories',
};

// Redis 数据库操作
export const redisDb = {
  // 获取所有笔记
  getNotes: async (): Promise<Note[]> => {
    addRedisLog('info', '获取笔记列表...');
    const redis = createRedisClient();
    const notes = await redis.get<Note[]>(KEYS.notes);

    if (notes === null) {
      addRedisLog('info', '笔记列表为空，返回空数组');
      return [];
    }

    addRedisLog('success', `获取到 ${notes.length} 条笔记`);
    return notes;
  },

  // 创建笔记
  createNote: async (note: Note): Promise<Note> => {
    addRedisLog('info', '创建笔记...', `ID: ${note.id}`);
    const redis = createRedisClient();

    const notes = await redisDb.getNotes();
    notes.unshift(note);

    await redis.set(KEYS.notes, notes);
    addRedisLog('success', '笔记创建成功');
    return note;
  },

  // 更新笔记
  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    addRedisLog('info', '更新笔记...', `ID: ${id}`);
    const redis = createRedisClient();

    const notes = await redisDb.getNotes();
    const index = notes.findIndex(n => n.id === id);

    if (index === -1) {
      addRedisLog('error', '笔记不存在', `ID: ${id}`);
      throw new Error('Note not found');
    }

    notes[index] = {
      ...notes[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await redis.set(KEYS.notes, notes);
    addRedisLog('success', '笔记更新成功');
    return notes[index];
  },

  // 删除笔记
  deleteNote: async (id: string): Promise<void> => {
    addRedisLog('info', '删除笔记...', `ID: ${id}`);
    const redis = createRedisClient();

    const notes = await redisDb.getNotes();
    const filteredNotes = notes.filter(n => n.id !== id);

    await redis.set(KEYS.notes, filteredNotes);
    addRedisLog('success', '笔记删除成功');
  },

  // 获取所有分类
  getCategories: async (): Promise<Category[]> => {
    addRedisLog('info', '获取分类列表...');
    const redis = createRedisClient();
    const categories = await redis.get<Category[]>(KEYS.categories);

    if (categories === null) {
      addRedisLog('info', '分类列表为空，返回默认分类');
      const defaultCategories = [
        { id: '1', name: '工作', color: '#3b82f6' },
        { id: '2', name: '学习', color: '#10b981' },
        { id: '3', name: '生活', color: '#f59e0b' },
        { id: '4', name: '其他', color: '#6b7280' },
      ];
      await redis.set(KEYS.categories, defaultCategories);
      return defaultCategories;
    }

    addRedisLog('success', `获取到 ${categories.length} 个分类`);
    return categories;
  },

  // 创建分类
  createCategory: async (category: Category): Promise<Category> => {
    addRedisLog('info', '创建分类...', `ID: ${category.id}`);
    const redis = createRedisClient();

    const categories = await redisDb.getCategories();
    categories.push(category);

    await redis.set(KEYS.categories, categories);
    addRedisLog('success', '分类创建成功');
    return category;
  },

  // 删除分类
  deleteCategory: async (id: string): Promise<void> => {
    addRedisLog('info', '删除分类...', `ID: ${id}`);
    const redis = createRedisClient();

    const categories = await redisDb.getCategories();
    const filteredCategories = categories.filter(c => c.id !== id);

    await redis.set(KEYS.categories, filteredCategories);
    addRedisLog('success', '分类删除成功');
  },

  // 批量同步笔记
  syncNotes: async (notes: Note[]): Promise<void> => {
    addRedisLog('info', '批量同步笔记...', `数量: ${notes.length}`);
    const redis = createRedisClient();
    await redis.set(KEYS.notes, notes);
    addRedisLog('success', '笔记同步完成');
  },

  // 批量同步分类
  syncCategories: async (categories: Category[]): Promise<void> => {
    addRedisLog('info', '批量同步分类...', `数量: ${categories.length}`);
    const redis = createRedisClient();
    await redis.set(KEYS.categories, categories);
    addRedisLog('success', '分类同步完成');
  },
};
