import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { getMongoDb } from '@/lib/mongodb';

export const dynamic = 'force-static';

const getStorageMode = (request: Request): 'local' | 'supabase' | 'redis' | 'mongodb' => {
  const mode = request.headers.get('x-storage-mode');
  if (mode === 'supabase') return 'supabase';
  if (mode === 'redis') return 'redis';
  if (mode === 'mongodb') return 'mongodb';
  return 'local';
};

export async function GET(request: Request) {
  const mode = getStorageMode(request);

  try {
    if (mode === 'supabase') {
      const categories = await supabaseDb.getCategories();
      return NextResponse.json(categories);
    } else if (mode === 'redis') {
      const categories = await redisDb.getCategories();
      return NextResponse.json(categories);
    } else if (mode === 'mongodb') {
      const db = await getMongoDb();
      const categories = await db.collection('categories').find({}).sort({ name: 1 }).toArray();
      return NextResponse.json(categories);
    } else {
      fileStorage.init();
      const categories = fileStorage.getCategories();
      return NextResponse.json(categories);
    }
  } catch (error) {
    console.error('API GET /categories error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch categories', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const mode = getStorageMode(request);

  try {
    const categoryData = await request.json();

    const newCategory = {
      id: categoryData.id || Date.now().toString(),
      name: categoryData.name,
      color: categoryData.color || '#3b82f6',
    };

    if (mode === 'supabase') {
      const created = await supabaseDb.createCategory(newCategory);
      return NextResponse.json(created);
    } else if (mode === 'redis') {
      const created = await redisDb.createCategory(newCategory);
      return NextResponse.json(created);
    } else if (mode === 'mongodb') {
      const db = await getMongoDb();
      const result = await db.collection('categories').insertOne(newCategory);
      return NextResponse.json({ ...newCategory, _id: result.insertedId });
    } else {
      fileStorage.init();
      const categories = fileStorage.getCategories();
      categories.push(newCategory);
      fileStorage.saveCategories(categories);
      return NextResponse.json(newCategory);
    }
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
