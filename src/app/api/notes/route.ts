import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { mongodbDb } from '@/lib/mongodb';

// 获取存储模式（从请求头或环境变量）
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
      const notes = await supabaseDb.getNotes();
      return NextResponse.json(notes);
    } else if (mode === 'redis') {
      const notes = await redisDb.getNotes();
      return NextResponse.json(notes);
    } else if (mode === 'mongodb') {
      const notes = await mongodbDb.getNotes();
      return NextResponse.json(notes);
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      return NextResponse.json(notes);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const mode = getStorageMode(request);

  try {
    const noteData = await request.json();

    const newNote = {
      id: noteData.id || Date.now().toString(),
      title: noteData.title || '无标题笔记',
      content: noteData.content || '',
      category: noteData.category || '4',
      tags: noteData.tags || [],
      createdAt: noteData.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (mode === 'supabase') {
      const created = await supabaseDb.createNote(newNote);
      return NextResponse.json(created);
    } else if (mode === 'redis') {
      const created = await redisDb.createNote(newNote);
      return NextResponse.json(created);
    } else if (mode === 'mongodb') {
      const created = await mongodbDb.createNote(newNote);
      return NextResponse.json(created);
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      notes.unshift(newNote);
      fileStorage.saveNotes(notes);
      return NextResponse.json(newNote);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
