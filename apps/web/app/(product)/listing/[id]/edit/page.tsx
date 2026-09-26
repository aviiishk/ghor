'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useInstitutions } from '@/features/institutions/hooks';
import { AMENITIES, amenityLabel } from '@/features/listings/amenities';


// Editing an existing listing's content — apps/api's PATCH /listings/:id already accepts
// all of these fields (see UpdateListingInput in features/listings/api.ts), it just never
// had client UI beyond status transitions until now. Photos are deliberately excluded:
// the backend's update() doesn't touch `images` at all (only settable at create time, see
// apps/api/STATUS.md) — shown read-only here rather than offered as editable. Mirrors
// apps/mobile/app/listing/[id]/edit.tsx.
export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError } = useListing(id);
  const updateListing = useUpdateListing(id);
  const { data: institutions } = useInstitutions('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [locality, setLocality] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!listing || hydrated) return;
    setTitle(listing.title);
    setDescription(listing.description ?? '');
    setRent(String(listing.rent));
    setDeposit(listing.deposit != null ? String(listing.deposit) : '');
    setLocality(listing.locality);
    setAmenities(Object.entries(listing.amenities ?? {}).filter(([, on]) => on).map(([k]) => k));
    setInstitutionIds(listing.institutions.map((tag) => tag.institution.id));
    setHydrated(true);
  }, [listing, hydrated]);

  function toggleAmenity(key: string) {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }
  function toggleInstitution(instId: string) {
    setInstitutionIds((prev) =>
      prev.includes(instId) ? prev.filter((i) => i !== instId) : [...prev, instId],
    );
  }

  async function handleSave() {
    setError(null);
    if (!title.trim() || !locality.trim() || !rent) {
      setError('Title, locality, and rent are required.');
      return;
    }
    setSaving(true);
    try {
      await updateListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        institutionIds,
      });
      router.push(`/listing/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !hydrated) return <p className="text-muted text-center py-24">Loading…</p>;
  if (isError || !listing) {
    return <p className="text-muted text-center py-24">Couldn&apos;t load this listing.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-ink mb-6">Edit Listing</h1>

      {error && (
        <div className="bg-destructive-pale text-destructive-pressed rounded-2xl px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <label className="block text-sm font-semibold text-muted mb-2" htmlFor="title">
        Title
      </label>
      <input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-5"
      />

      <label className="block text-sm font-semibold text-muted mb-2" htmlFor="locality">
        Locality
      </label>
      <input
        id="locality"
        value={locality}
        onChange={(e) => setLocality(e.target.value)}
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

      {listing.images.length > 0 && (
        <>
          <label className="block text-sm font-semibold text-muted mb-2">Photos</label>
          <p className="text-xs text-muted-soft mb-3">
            Photos can&apos;t be changed here yet — delete and recreate the listing if you need
            different ones.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {listing.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.cloudinaryUrl}
                alt=""
                className="w-20 h-20 rounded-xl object-cover"
              />
            ))}
          </div>
        </>
      )}

      {/* apps/api sends a live listing back to moderation when its content changes. */}
      {(listing?.status === 'approved' || listing?.status === 'rented') && (
        <p className="bg-surface text-muted text-sm rounded-xl px-4 py-3 mb-4">
          Saving changes sends this listing back for a quick review. It&apos;ll be hidden
          from search until it&apos;s approved again.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary text-white font-semibold rounded-full py-4 disabled:opacity-70"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
