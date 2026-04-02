import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { getStorageConfig } from '@/lib/storageConfig';

const MONGODB_DB_NAME = 'markdown_notes';

const getMongoClient = async () => {
  const config = getStorageConfig();
  const client = new MongoClient(config.mongodbUri);
  await client.connect();
  return client;
};

const getStorageMode = (request: Request): 'local' | 'supabase' | 'redis' | 'mongodb' => {
  const mode = request.headers.get('x-storage-mode');
  if (mode === 'supabase') return 'supabase';
  if (mode === 'redis') return 'redis';
  if (mode === 'mongodb') return 'mongodb';
  return 'local';
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'delete') {
      // 删除分类
      if (mode === 'supabase') {
        await supabaseDb.deleteCategory(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'redis') {
        await redisDb.deleteCategory(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'mongodb') {
        const client = await getMongoClient();
        try {
          await client.db(MONGODB_DB_NAME).collection('categories').deleteOne({ id });
          return NextResponse.json({ success: true });
        } finally {
          await client.close();
        }
      } else {
        fileStorage.init();
        const categories = fileStorage.getCategories();
        const filteredCategories = categories.filter((c: { id: string }) => c.id !== id);
        fileStorage.saveCategories(filteredCategories);
        return NextResponse.json({ success: true });
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process category' }, { status: 500 });
  }
}
