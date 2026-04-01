// 存储配置管理
// 支持三种模式：
// 1. local - 全部存储在本地（localStorage + 文件系统）
// 2. supabase - 文本存储在 Supabase 数据库，附件存储在本地
// 3. redis - 文本存储在 Upstash Redis，附件存储在本地

export type StorageMode = 'local' | 'supabase' | 'redis';

export interface StorageConfig {
  mode: StorageMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  redisUrl: string;
  redisToken: string;
}

const STORAGE_CONFIG_KEY = 'markdown_notes_storage_config';

// 默认配置
const defaultConfig: StorageConfig = {
  mode: 'local',
  supabaseUrl: 'https://pjpvhsqqbzrwdvzmfztf.supabase.co',
  supabaseAnonKey: 'sb_publishable_U6JkwLk77F5B3NMItf0E0Q_YUbiTwYe',
  redisUrl: 'https://vocal-spaniel-74996.upstash.io',
  redisToken: 'gQAAAAAAAST0AAIncDE2ZGRiYTUxZTAyNWE0ZWZiODdjMGUxZWRmOThjMGUzYXAxNzQ5OTY',
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
  return mode === 'supabase' || mode === 'redis';
};
