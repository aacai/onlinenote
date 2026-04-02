import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { getStorageConfig } from '@/lib/storageConfig';

const MONGODB_DB_NAME = 'markdown_notes';

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? 'Unknown error');
};

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
      const client = await getMongoClient();
      try {
        const notes = await client.db(MONGODB_DB_NAME).collection('notes').find({}).sort({ updatedAt: -1 }).toArray();
        return NextResponse.json(notes);
      } finally {
        await client.close();
      }
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      return NextResponse.json(notes);
    }
  } catch (error) {
    console.error('API GET /notes error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes', details: formatError(error) }, { status: 500 });
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
      user: noteData.user || 'anonymous',
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
      const client = await getMongoClient();
      try {
        const result = await client.db(MONGODB_DB_NAME).collection('notes').insertOne(newNote);
        return NextResponse.json({ ...newNote, _id: result.insertedId });
      } finally {
        await client.close();
      }
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      notes.unshift(newNote);
      fileStorage.saveNotes(notes);
      return NextResponse.json(newNote);
    }
  } catch (error) {
    console.error('API POST /notes error:', error);
    return NextResponse.json({ error: 'Failed to create note', details: formatError(error) }, { status: 500 });
  }
}
