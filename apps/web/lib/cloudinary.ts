const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// No client-side compression here, unlike apps/mobile's lib/cloudinary.ts
// (expo-image-manipulator) — there's no equivalent already in this app's dependency
// tree, and desktop uploads are less bandwidth-constrained than mobile data. Uploads go
// up at their original size; revisit if that turns out to matter (see STATUS.md).
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Image upload failed');

  const json = await res.json();
  return json.secure_url as string;
}
