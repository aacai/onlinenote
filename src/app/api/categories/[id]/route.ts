import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    fileStorage.init();
    const { id } = await params;
    const categories = fileStorage.getCategories();
    
    const filteredCategories = categories.filter((c: any) => c.id !== id);
    fileStorage.saveCategories(filteredCategories);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
