import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export async function GET() {
  try {
    fileStorage.init();
    const categories = fileStorage.getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    fileStorage.init();
    const categoryData = await request.json();
    const categories = fileStorage.getCategories();
    
    const newCategory = {
      id: categoryData.id || Date.now().toString(),
      name: categoryData.name,
      color: categoryData.color || '#3b82f6',
    };
    
    categories.push(newCategory);
    fileStorage.saveCategories(categories);
    
    return NextResponse.json(newCategory);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
