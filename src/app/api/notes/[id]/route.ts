import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { mongoDbApi } from '@/lib/mongodb-api';

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
  const { id } = await params;

  if (id === '_static_placeholder') {
    return NextResponse.json({ error: 'Static placeholder' }, { status: 404 });
  }

  try {
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
      const notes = await mongoDbApi.getNotes();
      const note = notes.find((n: { id: string }) => n.id === id);
      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      return NextResponse.json(note);
    } else {
      const { fileStorage } = await import('@/lib/fileStorage');
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
  const { id } = await params;
  const body = await request.json();
  const { action, ...data } = body;

  try {
    if (action === 'update') {
      if (mode === 'supabase') {
        const updated = await supabaseDb.updateNote(id, data);
        return NextResponse.json(updated);
      } else if (mode === 'redis') {
        const updated = await redisDb.updateNote(id, data);
        return NextResponse.json(updated);
      } else if (mode === 'mongodb') {
        const updated = await mongoDbApi.updateNote(id, data);
        return NextResponse.json(updated);
      } else {
        const { fileStorage } = await import('@/lib/fileStorage');
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
      if (mode === 'supabase') {
        await supabaseDb.deleteNote(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'redis') {
        await redisDb.deleteNote(id);
        return NextResponse.json({ success: true });
      } else if (mode === 'mongodb') {
        await mongoDbApi.deleteNote(id);
        return NextResponse.json({ success: true });
      } else {
        const { fileStorage } = await import('@/lib/fileStorage');
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
