import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export async function GET() {
  try {
    fileStorage.init();
    const notes = fileStorage.getNotes();
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    fileStorage.init();
    const noteData = await request.json();
    const notes = fileStorage.getNotes();
    
    const newNote = {
      id: noteData.id || Date.now().toString(),
      title: noteData.title || '无标题笔记',
      content: noteData.content || '',
      category: noteData.category || '4',
      tags: noteData.tags || [],
      createdAt: noteData.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    
    notes.unshift(newNote);
    fileStorage.saveNotes(notes);
    
    return NextResponse.json(newNote);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
