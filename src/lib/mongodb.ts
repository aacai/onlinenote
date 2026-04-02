import { MongoClient, Db } from 'mongodb';
import { getStorageConfig } from './storageConfig';

const MONGODB_DB_NAME = 'markdown_notes';

// 单例连接
let client: MongoClient | null = null;
let db: Db | null = null;

// 获取 MongoDB 数据库（复用连接）
export const getMongoDb = async (): Promise<Db> => {
  if (db) {
    return db;
  }
  
  const config = getStorageConfig();
  
  if (!client) {
    client = new MongoClient(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
    });
    await client.connect();
  }
  
  db = client.db(MONGODB_DB_NAME);
  return db;
};

// 关闭连接（用于清理）
export const closeMongoConnection = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};
