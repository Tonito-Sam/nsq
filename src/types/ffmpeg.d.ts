// Type definitions for dynamic import of @ffmpeg/ffmpeg
// This file is correct and enables type import for ffmpeg usage in Studio.tsx
import { FFmpeg } from '@ffmpeg/ffmpeg/dist/esm/classes';

export interface FFmpegModule {
  createFFmpeg: (options?: any) => FFmpeg;
  fetchFile: (url: string | File | Blob) => Promise<Uint8Array>;
  FFmpeg: typeof FFmpeg;
}

declare module '@ffmpeg/ffmpeg' {
  export const createFFmpeg: (options?: any) => FFmpeg;
  export const fetchFile: (url: string | File | Blob) => Promise<Uint8Array>;
  export { FFmpeg };
}
