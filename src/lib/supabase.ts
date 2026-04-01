import { createClient } from '@supabase/supabase-js';
import { Note, Category } from '@/types/note';
import { getStorageConfig } from './storageConfig';

// 日志类型
export interface ConnectionLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

// 日志存储
let connectionLogs: ConnectionLog[] = [];

// 添加日志
export const addConnectionLog = (level: ConnectionLog['level'], message: string, details?: string) => {
  const log: ConnectionLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  connectionLogs.push(log);
  // 只保留最近 100 条日志
  if (connectionLogs.length > 100) {
    connectionLogs = connectionLogs.slice(-100);
  }
  console.log(`[${level.toUpperCase()}] ${message}`, details || '');
};

// 获取日志
export const getConnectionLogs = (): ConnectionLog[] => [...connectionLogs];

// 清空日志
export const clearConnectionLogs = () => {
  connectionLogs = [];
};

// 创建 Supabase 客户端
const createSupabaseClient = () => {
  const config = getStorageConfig();
  addConnectionLog('info', '创建 Supabase 客户端', `URL: ${config.supabaseUrl}`);
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// 检查 Supabase 连接
export const checkSupabaseConnection = async (): Promise<boolean> => {
  clearConnectionLogs();
  addConnectionLog('info', '开始检查数据库连接...');
  
  try {
    const config = getStorageConfig();
    addConnectionLog('info', '配置信息', `URL: ${config.supabaseUrl}`);
    
    const supabase = createSupabaseClient();
    addConnectionLog('info', '客户端创建成功');
    
    // 测试连接 - 尝试查询 notes 表
    addConnectionLog('info', '尝试查询 notes 表...');
    const startTime = Date.now();
    const { data, error, status, statusText } = await supabase
      .from('notes')
      .select('id')
      .limit(1);
    
    const duration = Date.now() - startTime;
    addConnectionLog('info', '查询完成', `状态: ${status} ${statusText}, 耗时: ${duration}ms`);
    
    if (error) {
      addConnectionLog('error', '数据库查询失败', `错误代码: ${error.code}, 消息: ${error.message}`);
      addConnectionLog('error', '错误详情', JSON.stringify(error, null, 2));
      return false;
    }
    
    addConnectionLog('success', '数据库连接成功', `返回数据: ${JSON.stringify(data)}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorStack = error instanceof Error ? error.stack : '';
    addConnectionLog('error', '连接异常', errorMessage);
    if (errorStack) {
      addConnectionLog('error', '错误堆栈', errorStack);
    }
    return false;
  }
};

// 数据库操作
export const supabaseDb = {
  // 获取所有笔记
  getNotes: async (): Promise<Note[]> => {
    addConnectionLog('info', '获取笔记列表...');
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updatedAt', { ascending: false });
    
    if (error) {
      addConnectionLog('error', '获取笔记失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', `获取到 ${data?.length || 0} 条笔记`);
    return data || [];
  },

  // 创建笔记
  createNote: async (note: Note): Promise<Note> => {
    addConnectionLog('info', '创建笔记...', `ID: ${note.id}`);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single();
    
    if (error) {
      addConnectionLog('error', '创建笔记失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', '笔记创建成功');
    return data;
  },

  // 更新笔记
  updateNote: async (id: string, updates: Partial<Note>): Promise<Note> => {
    addConnectionLog('info', '更新笔记...', `ID: ${id}`);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updatedAt: Date.now() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      addConnectionLog('error', '更新笔记失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', '笔记更新成功');
    return data;
  },

  // 删除笔记
  deleteNote: async (id: string): Promise<void> => {
    addConnectionLog('info', '删除笔记...', `ID: ${id}`);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    
    if (error) {
      addConnectionLog('error', '删除笔记失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', '笔记删除成功');
  },

  // 获取所有分类
  getCategories: async (): Promise<Category[]> => {
    addConnectionLog('info', '获取分类列表...');
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      addConnectionLog('error', '获取分类失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', `获取到 ${data?.length || 0} 个分类`);
    return data || [];
  },

  // 创建分类
  createCategory: async (category: Category): Promise<Category> => {
    addConnectionLog('info', '创建分类...', `ID: ${category.id}`);
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    
    if (error) {
      addConnectionLog('error', '创建分类失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', '分类创建成功');
    return data;
  },

  // 删除分类
  deleteCategory: async (id: string): Promise<void> => {
    addConnectionLog('info', '删除分类...', `ID: ${id}`);
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      addConnectionLog('error', '删除分类失败', error.message);
      throw error;
    }
    
    addConnectionLog('success', '分类删除成功');
  },

  // 批量同步笔记（用于双向同步）
  syncNotes: async (notes: Note[]): Promise<void> => {
    addConnectionLog('info', '批量同步笔记...', `数量: ${notes.length}`);
    const supabase = createSupabaseClient();
    
    // 先删除所有现有笔记
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .neq('id', 'placeholder');
    
    if (deleteError) {
      addConnectionLog('error', '清空笔记失败', deleteError.message);
      throw deleteError;
    }
    
    // 插入新笔记
    if (notes.length > 0) {
      const { error: insertError } = await supabase
        .from('notes')
        .insert(notes);
      
      if (insertError) {
        addConnectionLog('error', '插入笔记失败', insertError.message);
        throw insertError;
      }
    }
    
    addConnectionLog('success', '笔记同步完成');
  },

  // 批量同步分类
  syncCategories: async (categories: Category[]): Promise<void> => {
    addConnectionLog('info', '批量同步分类...', `数量: ${categories.length}`);
    const supabase = createSupabaseClient();
    
    // 先删除所有现有分类
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', 'placeholder');
    
    if (deleteError) {
      addConnectionLog('error', '清空分类失败', deleteError.message);
      throw deleteError;
    }
    
    // 插入新分类
    if (categories.length > 0) {
      const { error: insertError } = await supabase
        .from('categories')
        .insert(categories);
      
      if (insertError) {
        addConnectionLog('error', '插入分类失败', insertError.message);
        throw insertError;
      }
    }
    
    addConnectionLog('success', '分类同步完成');
  },
};
