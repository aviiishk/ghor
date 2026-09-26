'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useInstitutions } from '@/features/institutions/hooks';
import Link from 'next/link';
import { ArrowLeft, Clock, ImageIcon } from 'lucide-react';
import {
  AmenityPicker,
  Field,
  InstitutionPicker,
  RupeeInput,
  inputClass,
} from '@/features/listings/components/ListingFormFields';
import { EmptyState, Skeleton } from '@/components/ui';


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

  if (isLoading || !hydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-72 rounded-[28px]" />
        <Skeleton className="h-56 rounded-[28px]" />
      </div>
    );
  }
  if (isError || !listing) {
    return <EmptyState icon={ImageIcon} title="Couldn’t load this listing" action={{ label: 'Back to my listings', href: '/my-listings' }} />;
  }

  const liveListing = listing.status === 'approved' || listing.status === 'rented';
  const section = 'rounded-[28px] bg-white p-6 ring-1 ring-navy/[0.06] sm:p-8 space-y-6';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <Link href={`/listing/${id}`} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-body hover:bg-white">
        <ArrowLeft size={17} aria-hidden /> Back to listing
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">Edit listing</h1>
      <p className="mt-1 text-muted">{listing.title}</p>

      {/* apps/api sends a live listing back to moderation when its content changes. */}
      {liveListing && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-warning-pale p-4 text-warning-deep">
          <Clock size={20} className="mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm">
            <strong>Heads up:</strong> saving changes sends this listing back for a quick review. It&apos;ll be hidden from search until it&apos;s approved again.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-5">
        <section className={section}>
          <h2 className="text-lg font-bold text-ink">Basics</h2>
          <Field label="Listing title" htmlFor="title">
            <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly rent" htmlFor="rent">
              <RupeeInput id="rent" value={rent} onChange={setRent} />
            </Field>
            <Field label="Security deposit" htmlFor="deposit" hint="Optional">
              <RupeeInput id="deposit" value={deposit} onChange={setDeposit} />
            </Field>
          </div>
        </section>

        <section className={section}>
          <h2 className="text-lg font-bold text-ink">Location</h2>
          <Field label="Locality" htmlFor="locality">
            <input id="locality" value={locality} maxLength={100} onChange={(e) => setLocality(e.target.value)} className={inputClass} />
          </Field>
          <InstitutionPicker institutions={institutions} value={institutionIds} onToggle={toggleInstitution} />
        </section>

        <section className={section}>
          <h2 className="text-lg font-bold text-ink">Amenities</h2>
          <AmenityPicker value={amenities} onToggle={toggleAmenity} />
        </section>

        <section className={section}>
          <h2 className="text-lg font-bold text-ink">Description</h2>
          <textarea id="desc" rows={6} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-y leading-6`} aria-label="Description" />
        </section>

        {listing.images.length > 0 && (
          <section className={section}>
            <div>
              <h2 className="text-lg font-bold text-ink">Photos</h2>
              <p className="mt-1 text-sm text-muted">Photos can&apos;t be changed after creating a listing yet.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {listing.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.cloudinaryUrl} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              ))}
            </div>
          </section>
        )}

        {error && <p role="alert" className="rounded-2xl bg-destructive-pale px-4 py-3 text-sm text-destructive-pressed">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Link href={`/listing/${id}`} className="press h-12 rounded-full px-5 text-sm font-semibold leading-[3rem] text-ink ring-1 ring-hairline">Cancel</Link>
          <button type="button" onClick={handleSave} disabled={saving} className="press h-12 rounded-full bg-primary px-6 font-bold text-white hover:bg-primary-pressed disabled:opacity-70">
            {saving ? 'Saving…' : liveListing ? 'Save & send for review' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
