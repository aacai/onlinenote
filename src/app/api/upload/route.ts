import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const getStorageMode = (): string => {
  return 'local';
};

export async function POST(request: Request) {
  try {
    const storageMode = request.headers.get('x-storage-mode') || getStorageMode();
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
    
    let url: string;
    
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('@/lib/supabaseFileStorage');
      const { getStorageConfig } = await import('@/lib/storageConfig');
      const config = getStorageConfig();
      url = await supabaseFileStorage.saveAttachment(noteId, filename, buffer, !!config.supabaseServiceKey);
    } else {
      const { fileStorage } = await import('@/lib/fileStorage');
      fileStorage.init();
      url = fileStorage.saveAttachment(noteId, filename, buffer);
    }
    
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
