import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [{ noteId: '_static_placeholder' }];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { noteId } = await params;
  
  if (noteId === '_static_placeholder') {
    return NextResponse.json([]);
  }
  
  if (typeof window !== 'undefined' || typeof process !== 'undefined') {
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
    let attachmentList;
    
    if (storageMode === 'supabase') {
      const { supabaseFileStorage } = await import('@/lib/supabaseFileStorage');
      const { getStorageConfig } = await import('@/lib/storageConfig');
      const config = getStorageConfig();
      const attachments = await supabaseFileStorage.getNoteAttachments(noteId, !!config.supabaseServiceKey);
      attachmentList = attachments.map((filename: string) => ({
        filename,
        url: supabaseFileStorage.getAttachmentUrl(noteId, filename),
      }));
    } else {
      const { fileStorage } = await import('@/lib/fileStorage');
      fileStorage.init();
      const attachments = fileStorage.getNoteAttachments(noteId);
      attachmentList = attachments.map((filename: string) => ({
        filename,
        url: `/api/attachments/${noteId}/${filename}`,
      }));
    }
    
    return NextResponse.json(attachmentList);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}
