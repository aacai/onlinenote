import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';

// 获取存储模式
const getStorageMode = (request: Request): 'local' | 'supabase' | 'redis' => {
  const mode = request.headers.get('x-storage-mode');
  if (mode === 'supabase') return 'supabase';
  if (mode === 'redis') return 'redis';
  return 'local';
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;

    if (mode === 'supabase') {
      await supabaseDb.deleteCategory(id);
      return NextResponse.json({ success: true });
    } else if (mode === 'redis') {
      await redisDb.deleteCategory(id);
      return NextResponse.json({ success: true });
    } else {
      fileStorage.init();
      const categories = fileStorage.getCategories();
      const filteredCategories = categories.filter((c: { id: string }) => c.id !== id);
      fileStorage.saveCategories(filteredCategories);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
