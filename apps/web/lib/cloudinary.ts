const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// Signed direct uploads (2026-09-27). apps/api mints a short-lived signature
// (POST /uploads/signature) with the Cloudinary secret it holds; the browser sends the
// file straight to Cloudinary with it. The web app needs no Cloudinary env vars and the
// account needs no unsigned upload preset. History: uploads used an unsigned preset read
// from NEXT_PUBLIC_* vars, which were left as template placeholders — "Image upload
// failed" — and the preset named there never existed on the account.
// Mirrors apps/api UploadsService: every field below is covered by the signature, so the
// browser can't change where or how the file is stored (Cloudinary rejects extras).
export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  allowedFormats: string;
  overwrite: 'false';
  transformation: string;
  signature: string;
};

export type UploadErrorKind = 'config' | 'file' | 'network' | 'server';

export class UploadError extends Error {
  constructor(
    message: string,
    readonly kind: UploadErrorKind,
  ) {
    super(message);
    this.name = 'UploadError';
  }
  /** Retrying helps for transient failures, never for configuration or a bad file. */
  get retryable() {
    return this.kind === 'network' || this.kind === 'server';
  }
}

// Shown when the API reports it has no Cloudinary credentials. Development names exactly
// what to fix; production stays calm and never blames the user's photo.
export function configProblemMessage(): string {
  if (process.env.NODE_ENV !== 'production') {
    return 'Developer setup: photo uploads are disabled because apps/api has no Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in apps/api/.env, then restart the API.';
  }
  return 'Photo uploads are temporarily unavailable on GHOR — this isn’t a problem with your photos. Your listing details are saved on this device, so you can come back and finish later.';
}

// Downscale + re-encode before upload (mirrors apps/mobile's expo-image-manipulator step,
// root CLAUDE.md §14.7). A 12MP phone photo is ~4–6MB; this makes it ~300–500KB, which
// matters most for owners uploading from a phone browser on mobile data. Falls back to
// the original file if the browser can't decode it (e.g. HEIC outside Safari).
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 350_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function describeCloudinaryError(status: number, body: string): UploadError {
  let detail = '';
  try {
    detail = JSON.parse(body)?.error?.message ?? '';
  } catch {
    // non-JSON body
  }
  if (/format|file|image|invalid/i.test(detail) && status === 400) {
    return new UploadError('This file couldn’t be used as a photo. Try a JPG, PNG or WebP image.', 'file');
  }
  if (/signature|api key|api_key|stale|timestamp/i.test(detail)) {
    // Signature/credential problems are server configuration, not the user's photo.
    return new UploadError(
      process.env.NODE_ENV !== 'production'
        ? `Developer setup: Cloudinary rejected the upload signature (“${detail.trim()}”). Check CLOUDINARY_* in apps/api/.env and the server clock.`
        : configProblemMessage(),
      status === 401 && /stale|timestamp/i.test(detail) ? 'server' : 'config',
    );
  }
  return new UploadError(
    status >= 500 || status === 0 || status === 429
      ? 'Cloudinary is having trouble right now. Retry in a moment.'
      : detail
        ? `Upload failed: ${detail.trim()}`
        : `Upload failed (error ${status}). Check your connection and retry.`,
    status >= 500 || status === 0 || status === 429 ? 'server' : 'file',
  );
}

// Uploads one photo, reporting progress 0–1. Resolves with the Cloudinary secure_url.
export async function uploadImageWithProgress(
  file: File,
  sign: () => Promise<UploadSignature>,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new UploadError('This photo is larger than 20 MB. Choose a smaller one.', 'file');
  }
  const [sig, blob] = await Promise.all([sign(), compressImage(file)]);
  if (signal?.aborted) throw new UploadError('Upload cancelled.', 'network');

  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', blob);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('public_id', sig.publicId);
    form.append('allowed_formats', sig.allowedFormats);
    form.append('overwrite', sig.overwrite);
    form.append('transformation', sig.transformation);
    form.append('signature', sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const url = JSON.parse(xhr.responseText).secure_url as string;
          if (url) return resolve(url);
        } catch {
          // fall through
        }
        return reject(new UploadError('Upload finished but Cloudinary returned no image URL. Retry.', 'server'));
      }
      reject(describeCloudinaryError(xhr.status, xhr.responseText));
    };
    xhr.onerror = () => reject(new UploadError('Connection lost while uploading. Check your internet and retry.', 'network'));
    xhr.onabort = () => reject(new UploadError('Upload cancelled.', 'network'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
