import { getStorageConfig } from './storageConfig';

const BUCKET_NAME = 'attachments';

const isBrowser = typeof window !== 'undefined';

const getBucket = async (useServiceKey = false): Promise<unknown> => {
  if (!isBrowser) return null;
  
  const { createClient } = await import('@supabase/supabase-js');
  const config = getStorageConfig();
  const key = useServiceKey && config.supabaseServiceKey 
    ? config.supabaseServiceKey 
    : config.supabaseAnonKey;
  
  const supabase = createClient(config.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const { data: bucket, error } = await supabase.storage.getBucket(BUCKET_NAME);
  
  if (error || !bucket) {
    const adminSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey || key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error: createError } = await adminSupabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: '50MB',
    });
    
    if (createError && !createError.message.includes('already exists')) {
      console.error('Failed to create bucket:', createError);
      throw createError;
    }
  }
  
  return supabase.storage.from(BUCKET_NAME);
};

const getContentType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

export const supabaseFileStorage = {
  async uploadFile(
    noteId: string, 
    file: File, 
    onProgress?: (progress: number) => void,
    useServiceKey = false
  ): Promise<{ url: string; filename: string }> {
    if (!isBrowser) {
      throw new Error('Upload only works in browser');
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const config = getStorageConfig();
    const key = useServiceKey && config.supabaseServiceKey 
      ? config.supabaseServiceKey 
      : config.supabaseAnonKey;
    
    const supabase = createClient(config.supabaseUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const path = `${noteId}/${filename}`;
    
    const { data: bucket } = await supabase.storage.getBucket(BUCKET_NAME);
    if (!bucket) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: '50MB',
      });
    }
    
    const bucketRef = supabase.storage.from(BUCKET_NAME);
    
    const { data, error } = await bucketRef.upload(path, file, {
      upsert: true,
      contentType: file.type || getContentType(filename),
    });
    
    if (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
    
    const { data: urlData } = bucketRef.getPublicUrl(path);
    return { url: urlData.publicUrl, filename };
  },

  async getNoteAttachments(noteId: string, useServiceKey = false): Promise<string[]> {
    if (!isBrowser) return [];
    
    const bucket = await getBucket(useServiceKey) as { list: (path: string) => Promise<{ data: { name: string }[]; error: Error | null }> };
    if (!bucket) return [];
    
    const { data: files, error } = await bucket.list(noteId);
    
    if (error) {
      console.error('Failed to list files:', error);
      return [];
    }
    
    return files?.map(f => f.name) || [];
  },

  async deleteAttachment(noteId: string, filename: string, useServiceKey = false): Promise<void> {
    if (!isBrowser) return;
    
    const bucket = await getBucket(useServiceKey) as { remove: (paths: string[]) => Promise<{ error: Error | null }> };
    if (!bucket) return;
    
    const path = `${noteId}/${filename}`;
    const { error } = await bucket.remove([path]);
    
    if (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  },

  getAttachmentUrl(noteId: string, filename: string): string {
    const config = getStorageConfig();
    return `${config.supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${noteId}/${filename}`;
  },
};
