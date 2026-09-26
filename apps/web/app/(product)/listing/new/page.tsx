'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateListing } from '@/features/listings/hooks';
import { updateListing } from '@/features/listings/api';
import { useInstitutions } from '@/features/institutions/hooks';
import { uploadImage } from '@/lib/cloudinary';
import { AMENITIES, amenityLabel } from '@/features/listings/amenities';


export default function NewListingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<'room' | 'flat'>('room');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [locality, setLocality] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createListing = useCreateListing();
  const { data: institutions } = useInstitutions('');

  function toggleAmenity(key: string) {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }
  function toggleInstitution(id: string) {
    setInstitutionIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }
  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(publish: boolean) {
    setError(null);
    if (!title.trim() || !locality.trim() || !rent) {
      setError('Title, locality, and rent are required.');
      return;
    }
    if (publish && photoFiles.length < 3) {
      setError('At least 3 photos are required to publish a listing.');
      return;
    }

    setSaving(true);
    try {
      const uploadedUrls = await Promise.all(photoFiles.map((file) => uploadImage(file)));
      const listing = await createListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        propertyType,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        images: uploadedUrls.map((cloudinaryUrl, position) => ({ cloudinaryUrl, position })),
        institutionIds: institutionIds.length ? institutionIds : undefined,
      });

      if (publish) {
        // Publishing is a distinct state transition (draft -> pending), not part of
        // create — matches apps/api/src/listings/listings.service.ts and apps/mobile's
        // listing/new.tsx exactly.
        await updateListing(listing.id, { status: 'pending' });
      }

      router.replace(`/listing/${listing.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-ink mb-6">Create Listing</h1>

      {error && (
        <div className="bg-destructive-pale text-destructive-pressed rounded-2xl px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <label className="block text-sm font-semibold text-muted mb-2">Property type</label>
      <div className="flex gap-2 mb-5">
        {(['room', 'flat'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setPropertyType(type)}
            className={`flex-1 py-3 rounded-2xl border-2 font-semibold capitalize ${
              propertyType === type
                ? 'border-primary bg-primary-light text-primary'
                : 'border-hairline bg-surface text-ink'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <label className="block text-sm font-semibold text-muted mb-2" htmlFor="title">
        Title
      </label>
      <input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 2BHK near GS Road"
        className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
      />

      <label className="block text-sm font-semibold text-muted mb-2" htmlFor="locality">
        Locality
      </label>
      <input
        id="locality"
        value={locality}
        onChange={(e) => setLocality(e.target.value)}
        placeholder="e.g. Zoo Road, Guwahati"
        className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
      />

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-muted mb-2" htmlFor="rent">
            Rent (₹/mo)
          </label>
          <input
            id="rent"
            value={rent}
            onChange={(e) => setRent(e.target.value.replace(/\D/g, ''))}
            placeholder="7000"
            inputMode="numeric"
            className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-muted mb-2" htmlFor="deposit">
            Deposit (optional)
          </label>
          <input
            id="deposit"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))}
            placeholder="14000"
            inputMode="numeric"
            className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink"
          />
        </div>
      </div>

      <label className="block text-sm font-semibold text-muted mb-2" htmlFor="description">
        Description (optional)
      </label>
      <textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        placeholder="A few lines about the place..."
        className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
      />

      <label className="block text-sm font-semibold text-muted mb-2">Amenities</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {AMENITIES.map((key) => {
          const active = amenities.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleAmenity(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                active ? 'bg-primary text-white' : 'bg-surface text-ink'
              }`}
            >
              {amenityLabel(key)}
            </button>
          );
        })}
      </div>

      {institutions !== undefined && institutions.length > 0 && (
        <>
          <label className="block text-sm font-semibold text-muted mb-2">
            Nearby institutions (optional)
          </label>
          <div className="flex flex-wrap gap-2 mb-5">
            {institutions.map((inst) => {
              const active = institutionIds.includes(inst.id);
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => toggleInstitution(inst.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    active ? 'bg-primary text-white' : 'bg-surface text-ink'
                  }`}
                >
                  {inst.name}
                </button>
              );
            })}
          </div>
        </>
      )}

      <label className="block text-sm font-semibold text-muted mb-2">
        Photos {photoFiles.length > 0 ? `(${photoFiles.length})` : ''}
      </label>
      <p className="text-xs text-muted-soft mb-3">At least 3 photos are required to publish.</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {photoPreviews.map((src, i) => (
          <div key={src} className="relative w-20 h-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-hairline flex items-center justify-center text-muted"
        >
          +
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFiles}
        />
      </div>

      <button
        type="button"
        onClick={() => handleSubmit(true)}
        disabled={saving}
        className="w-full bg-primary text-white font-semibold rounded-full py-4 mb-3 disabled:opacity-70"
      >
        {saving ? 'Submitting…' : 'Submit for Review'}
      </button>
      <button
        type="button"
        onClick={() => handleSubmit(false)}
        disabled={saving}
        className="w-full border border-hairline text-ink font-semibold rounded-full py-4 disabled:opacity-70"
      >
        Save as Draft
      </button>
    </div>
  );
}
