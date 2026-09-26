const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

// Downscale + re-encode before upload (added 2026-09-26, mirroring apps/mobile's
// expo-image-manipulator step, root CLAUDE.md §14.7). A 12MP phone photo is ~4–6MB; this
// makes it ~300–500KB, which matters most for owners uploading from a phone browser on
// mobile data. Falls back to the original file if the browser can't decode it.
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

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', await compressImage(file));
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Image upload failed');

  const json = await res.json();
  return json.secure_url as string;
}
