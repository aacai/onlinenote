// MongoDB 客户端类型定义和日志类型（用于客户端）

export interface MongoDBLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

// 日志存储（客户端用）
let mongoDBLogs: MongoDBLog[] = [];

// 添加日志
export const addMongoDBLog = (level: MongoDBLog['level'], message: string, details?: string) => {
  const log: MongoDBLog = {
    timestamp: Date.now(),
    level,
    message,
    details,
  };
  mongoDBLogs.push(log);
  if (mongoDBLogs.length > 100) {
    mongoDBLogs = mongoDBLogs.slice(-100);
  }
  console.log(`[MONGODB ${level.toUpperCase()}] ${message}`, details || '');
};

// 获取日志
export const getMongoDBLogs = (): MongoDBLog[] => [...mongoDBLogs];

// 清空日志
export const clearMongoDBLogs = () => {
  mongoDBLogs = [];
};

// 检查 MongoDB 连接（通过 API）
export const checkMongoDBConnection = async (): Promise<boolean> => {
  clearMongoDBLogs();
  addMongoDBLog('info', '开始检查 MongoDB 连接...');

  try {
    addMongoDBLog('info', '发送测试请求...');
    const startTime = Date.now();

    const response = await fetch('/api/mongodb-test');
    const duration = Date.now() - startTime;

    if (response.ok) {
      addMongoDBLog('success', 'MongoDB 连接成功', `耗时: ${duration}ms`);
      return true;
    } else {
      const error = await response.text();
      addMongoDBLog('error', 'MongoDB 连接失败', error);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    addMongoDBLog('error', '连接异常', errorMessage);
    return false;
  }
};
