import { Note, Category } from '@/types/note';
import { getStorageConfig } from './storageConfig';

export interface ConnectionLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

let connectionLogs: ConnectionLog[] = [];

export const addConnectionLog = (level: ConnectionLog['level'], message: string, details?: string) => {
  const log: ConnectionLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  connectionLogs.push(log);
  if (connectionLogs.length > 100) {
    connectionLogs = connectionLogs.slice(-100);
  }
  console.log(`[${level.toUpperCase()}] ${message}`, details || '');
};

export const getConnectionLogs = (): ConnectionLog[] => [...connectionLogs];

export const clearConnectionLogs = () => {
  connectionLogs = [];
};

const createSupabaseClient = async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const config = getStorageConfig();
  addConnectionLog('info', '创建 Supabase 客户端', `URL: ${config.supabaseUrl}`);
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const checkSupabaseConnection = async (): Promise<boolean> => {
  clearConnectionLogs();
  addConnectionLog('info', '开始检查数据库连接...');
  
  try {
    const config = getStorageConfig();
    addConnectionLog('info', '配置信息', `URL: ${config.supabaseUrl}`);
    
    const supabase = await createSupabaseClient();
    addConnectionLog('info', '客户端创建成功');
    
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
    
    addConnectionLog('success', '数据库连接成功');
    return true;
  } catch (error) {
    addConnectionLog('error', '连接异常', error instanceof Error ? error.message : String(error));
    return false;
  }
};

export const supabaseDb = {
  getNotes: async (): Promise<Note[]> => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updatedAt', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getNote: async (id: string): Promise<Note | null> => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  createNote: async (note: Note): Promise<Note> => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateNote: async (id: string, updates: Partial<Note>): Promise<void> => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  deleteNote: async (id: string): Promise<void> => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  getCategories: async (): Promise<Category[]> => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  addCategory: async (category: Category): Promise<Category> => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
