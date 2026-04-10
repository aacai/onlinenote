import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [{ noteId: '_static_placeholder', filename: '_static_placeholder' }];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteId: string; filename: string }> }
) {
  const { noteId, filename } = await params;
  
  if (noteId === '_static_placeholder' || filename === '_static_placeholder') {
    return NextResponse.json({ error: 'Static placeholder' }, { status: 404 });
  }
  
  if (typeof process !== 'undefined') {
    const isStatic = process.env.NEXT_OUTPUT === 'export';
    if (isStatic) {
      return NextResponse.json(
        { error: 'This feature requires Tauri environment or server mode' },
        { status: 501 }
      );
    }
  }
  
  const storageMode = request.headers.get('x-storage-mode') || 'local';
  
  try {
    let fileBuffer: Buffer | null;
    let contentType: string;
    
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('@/lib/supabaseFileStorage');
      const { getStorageConfig } = await import('@/lib/storageConfig');
      const config = getStorageConfig();
      fileBuffer = await supabaseFileStorage.getAttachment(noteId, filename, !!config.supabaseServiceKey);
      contentType = getContentType(filename);
    } else {
      const { fileStorage } = await import('@/lib/fileStorage');
      fileStorage.init();
      fileBuffer = fileStorage.getAttachment(noteId, filename);
      contentType = getContentType(filename);
    }
    
    if (!fileBuffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ noteId: string; filename: string }> }
) {
  const { noteId, filename } = await params;
  
  if (typeof process !== 'undefined') {
    const isStatic = process.env.NEXT_OUTPUT === 'export';
    if (isStatic) {
      return NextResponse.json(
        { error: 'This feature requires Tauri environment or server mode' },
        { status: 501 }
      );
    }
  }
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'delete') {
      const storageMode = request.headers.get('x-storage-mode') || 'local';
      
      if (storageMode === 'supabase') {
        const { supabaseFileStorage } = await import('@/lib/supabaseFileStorage');
        const { getStorageConfig } = await import('@/lib/storageConfig');
        const config = getStorageConfig();
        await supabaseFileStorage.deleteAttachment(noteId, filename, !!config.supabaseServiceKey);
      } else {
        const { fileStorage } = await import('@/lib/fileStorage');
        fileStorage.init();
        fileStorage.deleteAttachment(noteId, filename);
      }
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip': 'application/zip',
    'txt': 'text/plain',
    'md': 'text/markdown',
  };
  
  return contentTypes[ext || ''] || 'application/octet-stream';
}
