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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;

    if (mode === 'supabase') {
      const notes = await supabaseDb.getNotes();
      const note = notes.find((n: { id: string }) => n.id === id);
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json(note);
    } else if (mode === 'redis') {
      const notes = await redisDb.getNotes();
      const note = notes.find((n: { id: string }) => n.id === id);
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json(note);
    } else if (mode === 'mongodb') {
      const db = await getMongoDb();
      const note = await db.collection('notes').findOne({ id });
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json(note);
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      const note = notes.find((n: { id: string }) => n.id === id);
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json(note);
    }
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'update') {
      // 更新笔记
      if (mode === 'supabase') {
        const updated = await supabaseDb.updateNote(id, data);
        return NextResponse.json(updated);
      } else if (mode === 'redis') {
        const updated = await redisDb.updateNote(id, data);
        return NextResponse.json(updated);
      } else if (mode === 'mongodb') {
        const db = await getMongoDb();
        const result = await db.collection('notes').findOneAndUpdate(
          { id },
          { $set: { ...data, updatedAt: Date.now() } },
          { returnDocument: 'after' }
        );
        return NextResponse.json(result);
      } else {
        fileStorage.init();
        const notes = fileStorage.getNotes();
        const index = notes.findIndex((n: { id: string }) => n.id === id);
        if (index === -1) {
          return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }
        notes[index] = {
          ...notes[index],
          ...data,
          updatedAt: Date.now(),
        };
        fileStorage.saveNotes(notes);
        return NextResponse.json(notes[index]);
      }
    } else if (action === 'delete') {
      // 删除笔记
      if (mode === 'supabase') {
        await supabaseDb.deleteNote(id);
        fileStorage.deleteNoteAttachments(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'redis') {
        await redisDb.deleteNote(id);
        fileStorage.deleteNoteAttachments(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'mongodb') {
        const db = await getMongoDb();
        await db.collection('notes').deleteOne({ id });
        fileStorage.deleteNoteAttachments(id);
        return NextResponse.json({ success: true });
      } else {
        fileStorage.init();
        const notes = fileStorage.getNotes();
        const filteredNotes = notes.filter((n: { id: string }) => n.id !== id);
        fileStorage.saveNotes(filteredNotes);
        fileStorage.deleteNoteAttachments(id);
        return NextResponse.json({ success: true });
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to process note' }, { status: 500 });
  }
}
