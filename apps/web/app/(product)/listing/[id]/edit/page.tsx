'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, ImageIcon } from 'lucide-react';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useInstitutions } from '@/features/institutions/hooks';
import { useProfile } from '@/features/auth/hooks';
import type { Listing } from '@/features/listings/api';
import { PhotoUploader, usePhotoUploads } from '@/features/listings/components/PhotoUploader';
import {
  AmenityPicker,
  Field,
  InstitutionPicker,
  RupeeInput,
  errorId,
  inputClass,
} from '@/features/listings/components/ListingFormFields';
import { Button, EmptyState, Skeleton, buttonClass, cx, formatRent } from '@/components/ui';
import { useToast } from '@/components/ui/overlay';
import { friendlyError } from '@/lib/errors';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;
const RENT_MIN = 500;
const RENT_MAX = 200000;

// Edit an existing listing — content AND photos (2026-09-27: photos became editable; the
// API's PATCH now accepts the full ordered photo list). A draft saved with fewer than 3
// photos is recoverable here: add photos, then "Save & submit for review".
export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: listing, isLoading, isError } = useListing(id);
  const { data: profile, isLoading: profileLoading } = useProfile();

  if (isLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }
  // Anyone can open an approved listing, so the edit URL alone would render this form for
  // someone else's home; the API refuses the save (403), so don't offer it at all.
  const canEdit = !!listing && !!profile && (listing.ownerId === profile.id || profile.role === 'admin');
  if (isError || !listing || !canEdit) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="This listing can’t be edited"
        body="It may have been deleted, or it belongs to another account."
        action={{ label: 'Back to my listings', href: '/my-listings' }}
      />
    );
  }
  return <EditForm listing={listing} />;
}

function EditForm({ listing }: { listing: Listing }) {
  const router = useRouter();
  const toast = useToast();
  const updateListing = useUpdateListing(listing.id);
  const { data: institutions } = useInstitutions('');
  const uploads = usePhotoUploads(
    MAX_PHOTOS,
    listing.images.map((img) => ({ id: img.id, url: img.cloudinaryUrl })),
  );

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? '');
  const [rent, setRent] = useState(String(listing.rent));
  const [deposit, setDeposit] = useState(listing.deposit != null ? String(listing.deposit) : '');
  const [availableFrom, setAvailableFrom] = useState(listing.availableFrom ? listing.availableFrom.slice(0, 10) : '');
  const [locality, setLocality] = useState(listing.locality);
  const [amenities, setAmenities] = useState(Object.entries(listing.amenities ?? {}).filter(([, on]) => on).map(([k]) => k));
  const [institutionIds, setInstitutionIds] = useState(listing.institutions.map((tag) => tag.institution.id));
  const [saving, setSaving] = useState<null | 'save' | 'submit'>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const t = title.trim();
    if (!t) e.title = 'Give your listing a title.';
    else if (t.length < 8) e.title = 'Make the title a little longer — at least 8 characters.';
    const r = Number(rent);
    if (!rent) e.rent = 'Enter the monthly rent.';
    else if (r < RENT_MIN || r > RENT_MAX) e.rent = `Enter a monthly rent between ${formatRent(RENT_MIN)} and ₹2,00,000.`;
    if (deposit && r >= RENT_MIN && Number(deposit) > r * 12) e.deposit = `That’s more than 12 months’ rent (${formatRent(r * 12)}). Check the amount.`;
    if (locality.trim().length < 2) e.locality = 'Enter the locality, e.g. Jalukbari or Six Mile.';
    return e;
  }, [title, rent, deposit, locality]);
  const err = (k: string) => (showErrors ? fieldErrors[k] ?? null : null);

  const toggle = (setter: typeof setAmenities) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));

  const liveListing = listing.status === 'approved' || listing.status === 'rented';
  const canSubmit = listing.status === 'draft' || listing.status === 'rejected';
  const originalUrls = listing.images.map((i) => i.cloudinaryUrl).join('|');
  const photosChanged = uploads.doneUrls.join('|') !== originalUrls || uploads.photos.length !== uploads.doneUrls.length;
  const photosReady = uploads.doneUrls.length >= MIN_PHOTOS;

  async function save(submit: boolean) {
    setError(null);
    setShowErrors(true);
    const firstBad = ['title', 'rent', 'deposit', 'locality'].find((k) => fieldErrors[k]);
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return setError('Fix the highlighted fields before saving.');
    }
    if (uploads.uploading > 0) return setError('Some photos are still uploading. Give them a moment, then save.');
    if (uploads.failed > 0) {
      return setError(
        uploads.configBlocked
          ? 'Photo uploads aren’t available right now. Remove the photos that didn’t upload to save your other changes.'
          : 'Some photos didn’t upload. Retry or remove them before saving.',
      );
    }
    if (submit && !photosReady) {
      return setError(`Add at least ${MIN_PHOTOS} photos to submit for review — this listing has ${uploads.doneUrls.length}.`);
    }
    setSaving(submit ? 'submit' : 'save');
    try {
      await updateListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        availableFrom: availableFrom || undefined,
        locality: locality.trim(),
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        institutionIds,
        ...(photosChanged ? { images: uploads.doneUrls.map((cloudinaryUrl, position) => ({ cloudinaryUrl, position })) } : {}),
        ...(submit ? { status: 'pending' as const } : {}),
      });
      toast(submit ? 'Submitted for review — we’ll notify you when it’s live.' : liveListing ? 'Saved — sent back for a quick review.' : 'Changes saved');
      router.push(`/listing/${listing.id}`);
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t save your changes. Your edits are still here — please try again.'));
    } finally {
      setSaving(null);
    }
  }

  const section = 'border-t border-navy/[0.08] py-9 first:border-t-0 first:pt-2';
  const h2 = 'font-display text-[1.4rem] font-bold tracking-tight text-navy';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-36 pt-6 sm:px-6">
      <Link href={`/listing/${listing.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-body hover:bg-white">
        <ArrowLeft size={17} aria-hidden /> Back to listing
      </Link>
      <h1 className="mt-4 font-display text-[clamp(2rem,3.4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-navy">Edit listing</h1>
      <p className="mt-2 text-lg text-muted">{listing.title}</p>

      {liveListing && (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-warning-pale p-4 text-warning-deep">
          <Clock size={20} className="mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm">
            <strong>Heads up:</strong> changing details or photos sends this listing back for a quick review. It’s hidden from search until it’s approved again.
          </p>
        </div>
      )}
      {canSubmit && !photosReady && (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-primary-light p-4 text-navy">
          <ImageIcon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm">
            Add {MIN_PHOTOS - uploads.doneUrls.length} more photo{MIN_PHOTOS - uploads.doneUrls.length === 1 ? '' : 's'} to submit this listing for review.
          </p>
        </div>
      )}

      <div className="mt-6">
        <section className={section}>
          <h2 className={h2}>Photos</h2>
          <p className="mb-6 mt-1 text-muted">Add, remove or reorder. The first photo is the cover renters see in search.</p>
          <PhotoUploader uploads={uploads} min={MIN_PHOTOS} max={MAX_PHOTOS} />
        </section>

        <section className={cx(section, 'space-y-6')}>
          <h2 className={h2}>Basics</h2>
          <Field label="Listing title" htmlFor="title" error={err('title')}>
            <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!err('title') || undefined} aria-describedby={err('title') ? errorId('title') : undefined} className={cx(inputClass, err('title') && '!ring-2 !ring-destructive')} />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Monthly rent" htmlFor="rent" error={err('rent')} hint="Between ₹500 and ₹2,00,000">
              <RupeeInput id="rent" value={rent} onChange={setRent} invalid={!!err('rent')} />
            </Field>
            <Field label="Security deposit" htmlFor="deposit" optional error={err('deposit')}>
              <RupeeInput id="deposit" value={deposit} onChange={setDeposit} invalid={!!err('deposit')} />
            </Field>
          </div>
          <Field label="Available from" htmlFor="available" optional hint="Leave empty if you’re not sure yet.">
            <input id="available" type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={cx(inputClass, 'sm:max-w-xs')} />
          </Field>
        </section>

        <section className={cx(section, 'space-y-6')}>
          <h2 className={h2}>Location</h2>
          <Field label="Locality" htmlFor="locality" error={err('locality')} hint="Renters see an approximate area, never your exact address.">
            <input id="locality" value={locality} maxLength={100} onChange={(e) => setLocality(e.target.value)} aria-invalid={!!err('locality') || undefined} aria-describedby={err('locality') ? errorId('locality') : undefined} className={cx(inputClass, err('locality') && '!ring-2 !ring-destructive')} />
          </Field>
          <InstitutionPicker institutions={institutions} value={institutionIds} onToggle={toggle(setInstitutionIds)} />
        </section>

        <section className={section}>
          <h2 className={cx(h2, 'mb-5')}>What’s included</h2>
          <AmenityPicker value={amenities} onToggle={toggle(setAmenities)} />
        </section>

        <section className={section}>
          <Field label="Description" htmlFor="desc" optional>
            <textarea id="desc" rows={7} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={cx(inputClass, 'resize-y leading-7')} />
          </Field>
          <p className="mt-1.5 text-right text-xs text-muted">{description.length}/4000</p>
        </section>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive-pale px-4 py-3 text-sm text-destructive-pressed">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link href={`/listing/${listing.id}`} className={cx(buttonClass('ghost'), 'mr-auto sm:mr-0')}>Cancel</Link>
          <Button variant={canSubmit ? 'secondary' : 'primary'} onClick={() => save(false)} disabled={!!saving}>
            {saving === 'save' ? 'Saving…' : liveListing ? 'Save & send for review' : 'Save changes'}
          </Button>
          {canSubmit && (
            <Button onClick={() => save(true)} disabled={!!saving || !photosReady} title={photosReady ? undefined : `Add at least ${MIN_PHOTOS} photos first`}>
              {saving === 'submit' ? 'Submitting…' : 'Save & submit'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
