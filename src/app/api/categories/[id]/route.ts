import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { getMongoDb } from '@/lib/mongodb';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [{ id: '_static_placeholder' }];
}

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
        const db = await getMongoDb();
        await db.collection('categories').deleteOne({ id });
        return NextResponse.json({ success: true });
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
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to process category' }, { status: 500 });
  }
}
