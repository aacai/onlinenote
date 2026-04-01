import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    fileStorage.init();
    const { id } = await params;
    const notes = fileStorage.getNotes();
    const note = notes.find((n: any) => n.id === id);
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    fileStorage.init();
    const { id } = await params;
    const updates = await request.json();
    const notes = fileStorage.getNotes();
    
    const index = notes.findIndex((n: any) => n.id === id);
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    fileStorage.init();
    const { id } = await params;
    const notes = fileStorage.getNotes();
    
    const filteredNotes = notes.filter((n: any) => n.id !== id);
    fileStorage.saveNotes(filteredNotes);
    
    fileStorage.deleteNoteAttachments(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
