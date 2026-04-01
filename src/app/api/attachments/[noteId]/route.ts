import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    fileStorage.init();
    const { noteId } = await params;
    
    const attachments = fileStorage.getNoteAttachments(noteId);
    
    const attachmentList = attachments.map(filename => ({
      filename,
      url: `/api/attachments/${noteId}/${filename}`,
    }));
    
    return NextResponse.json(attachmentList);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}
