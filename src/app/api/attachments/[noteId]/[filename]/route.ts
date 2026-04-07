import { NextResponse } from 'next/server';
import { fileStorage } from '@/lib/fileStorage';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [{ noteId: '_static_placeholder', filename: '_static_placeholder' }];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteId: string; filename: string }> }
) {
  try {
    fileStorage.init();
    const { noteId, filename } = await params;
    
    const fileBuffer = fileStorage.getAttachment(noteId, filename);
    
    if (!fileBuffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const contentType = getContentType(filename);
    
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
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'delete') {
      fileStorage.init();
      const { noteId, filename } = await params;

      fileStorage.deleteAttachment(noteId, filename);

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
