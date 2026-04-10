// 存储配置管理
// 支持四种模式：
// 1. local - 全部存储在本地（localStorage + 文件系统）
// 2. supabase - 文本存储在 Supabase 数据库，附件存储在 Supabase Storage
// 3. redis - 文本存储在 Upstash Redis，附件存储在本地
// 4. mongodb - 文本存储在 MongoDB，附件存储在本地

export type StorageMode = 'local' | 'supabase' | 'redis' | 'mongodb';

export interface StorageConfig {
  mode: StorageMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  redisUrl: string;
  redisToken: string;
  mongodbUri: string;
  mongodbApiKey: string;
}

const STORAGE_CONFIG_KEY = 'markdown_notes_storage_config';

// 默认配置
const defaultConfig: StorageConfig = {
  mode: 'local',
  supabaseUrl: 'https://pjpvhsqqbzrwdvzmfztf.supabase.co',
  supabaseAnonKey: 'sb_publishable_U6JkwLk77F5B3NMItf0E0Q_YUbiTwYe',
  supabaseServiceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcHZoc3FxYnpyd2R2em1menRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA0OTA0NCwiZXhwIjoyMDkwNjI1MDQ0fQ.voYV7FT-w6jxUTMk1FS9inG54FELKWmAOcjF4e4Zu3s',
  redisUrl: 'https://vocal-spaniel-74996.upstash.io',
  redisToken: 'gQAAAAAAAST0AAIncDE2ZGRiYTUxZTAyNWE0ZWZiODdjMGUxZWRmOThjMGUzYXAxNzQ5OTY',
  mongodbUri: 'mongodb+srv://caicaidarenya_db_user:4CpyKH7Y3SyYWQdm@onlinewebnote.2lbnlst.mongodb.net/markdown_notes?retryWrites=true&w=majority&appName=OnlineWebNote',
  mongodbApiKey: 'YOUR_MONGODB_DATA_API_KEY',
};

// 获取存储配置
export const getStorageConfig = (): StorageConfig => {
  if (typeof window === 'undefined') return defaultConfig;
  const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (stored) {
    try {
      return { ...defaultConfig, ...JSON.parse(stored) };
    } catch {
      return defaultConfig;
    }
  }
  return defaultConfig;
};

// 保存存储配置
export const saveStorageConfig = (config: Partial<StorageConfig>): void => {
  if (typeof window === 'undefined') return;
  const current = getStorageConfig();
  const newConfig = { ...current, ...config };
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
};

// 切换存储模式
export const setStorageMode = (mode: StorageMode): void => {
  saveStorageConfig({ mode });
  // 触发存储模式变更事件
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storageModeChange', { detail: { mode } }));
  }
};

// 获取当前存储模式
export const getStorageMode = (): StorageMode => {
  return getStorageConfig().mode;
};

// 是否使用数据库
export const isUsingDatabase = (): boolean => {
  const mode = getStorageMode();
  return mode === 'supabase' || mode === 'redis' || mode === 'mongodb';
};
