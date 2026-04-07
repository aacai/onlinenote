import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    fileStorage.init();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const noteId = formData.get('noteId') as string;
    
    if (!file || !noteId) {
      return NextResponse.json({ error: 'Missing file or noteId' }, { status: 400 });
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const timestamp = Date.now();
    const originalName = file.name;
    const filename = `${timestamp}-${originalName}`;
    
    const url = fileStorage.saveAttachment(noteId, filename, buffer);
    
    return NextResponse.json({
      success: true,
      filename,
      url,
      originalName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
