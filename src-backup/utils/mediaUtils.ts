
import { supabase } from '@/integrations/supabase/client';

export const uploadFile = async (
  file: File,
  bucket: string,
  folder: string = '',
  userId: string
): Promise<string> => {
  try {
  const fileExt = file.name.split('.').pop();
  // Add a small random suffix to avoid collisions when multiple files are uploaded
  // in the same millisecond. Keep the original file extension.
  const random = Math.random().toString(36).slice(2, 8);
  const fileName = `${userId}/${folder}${Date.now()}-${random}.${fileExt}`;

    console.log('Uploading file:', { fileName, bucket, fileSize: file.size });

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    console.log('Upload successful:', data);

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('Generated public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};

export const getMediaUrl = (url?: string, bucket?: string): string => {
  if (!url) return '';
  
  console.log('Processing media URL:', { originalUrl: url, bucket });
  
  // If it's already a full HTTP URL, return as is
  if (url.startsWith('http')) {
    console.log('URL is already HTTP, returning as is');
    return url;
  }
  
  // If it's a data URL (base64), return as is
  if (url.startsWith('data:')) {
    console.log('URL is data URL, returning as is');
    return url;
  }
  
  // Handle Supabase storage URLs - construct proper public URL
  const bucketName = bucket || 'posts';
  
  // Clean the path - remove leading slashes and bucket prefixes
  let cleanPath = url.replace(/^\/+/, '');
  
  // Remove bucket name from path if it's already included
  if (cleanPath.startsWith(`${bucketName}/`)) {
    cleanPath = cleanPath.substring(`${bucketName}/`.length);
  }
  
  // If path still contains a bucket reference, extract the actual file path
  const pathParts = cleanPath.split('/');
  if (pathParts.length > 1 && pathParts[0] === bucketName) {
    cleanPath = pathParts.slice(1).join('/');
  }
  
  console.log('Constructing Supabase URL for:', { cleanPath, bucketName });
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(cleanPath);
  
  console.log('Generated public URL:', publicUrl);
  return publicUrl;
};

export const deleteFile = async (bucket: string, path: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }
  } catch (error) {
    console.error('File deletion failed:', error);
    throw error;
  }
};
