import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';
import { supabaseDb } from '@/lib/supabase';
import { redisDb } from '@/lib/redis';
import { mongodbDb } from '@/lib/mongodb';

// 获取存储模式
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
      const notes = await mongodbDb.getNotes();
      const note = notes.find((n: { id: string }) => n.id === id);
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;
    const updates = await request.json();

    if (mode === 'supabase') {
      const updated = await supabaseDb.updateNote(id, updates);
      return NextResponse.json(updated);
    } else if (mode === 'redis') {
      const updated = await redisDb.updateNote(id, updates);
      return NextResponse.json(updated);
    } else if (mode === 'mongodb') {
      const updated = await mongodbDb.updateNote(id, updates);
      return NextResponse.json(updated);
    } else {
      fileStorage.init();
      const notes = fileStorage.getNotes();
      const index = notes.findIndex((n: { id: string }) => n.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }
      notes[index] = {
        ...notes[index],
        ...updates,
        updatedAt: Date.now(),
      };
      fileStorage.saveNotes(notes);
      return NextResponse.json(notes[index]);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const mode = getStorageMode(request);

  try {
    const { id } = await params;

    if (mode === 'supabase') {
      await supabaseDb.deleteNote(id);
      fileStorage.deleteNoteAttachments(id);
      return NextResponse.json({ success: true });
    } else if (mode === 'redis') {
      await redisDb.deleteNote(id);
      fileStorage.deleteNoteAttachments(id);
      return NextResponse.json({ success: true });
    } else if (mode === 'mongodb') {
      await mongodbDb.deleteNote(id);
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
