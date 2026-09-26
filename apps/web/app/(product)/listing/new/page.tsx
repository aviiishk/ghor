'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCreateListing } from '@/features/listings/hooks';
import { updateListing } from '@/features/listings/api';
import { useInstitutions } from '@/features/institutions/hooks';
import { uploadImage } from '@/lib/cloudinary';
import { amenityIcon, amenityLabel } from '@/features/listings/amenities';
import {
  AmenityPicker,
  Field,
  InstitutionPicker,
  RupeeInput,
  TypePicker,
  inputClass,
} from '@/features/listings/components/ListingFormFields';
import { formatRent } from '@/components/ui';

// Create listing as a guided flow (redesign 2026-09-26). Same API calls as before:
// create (always a draft) → optional publish (draft → pending). Root CLAUDE.md §11:
// listing should take under 3 minutes — six short steps, each validated before moving on.
const STEPS = ['Basics', 'Location', 'Photos', 'Amenities', 'Description', 'Preview'] as const;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;

export default function NewListingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<'room' | 'flat'>('room');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [locality, setLocality] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createListing = useCreateListing();
  const { data: institutions } = useInstitutions('');

  const toggle = (setter: typeof setAmenities) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
    setPhotos((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_PHOTOS));
  }
  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i]!.url);
      return prev.filter((_, idx) => idx !== i);
    });
  }
  function makeCover(i: number) {
    setPhotos((prev) => [prev[i]!, ...prev.filter((_, idx) => idx !== i)]);
  }

  // Per-step validation — returns an error message or null.
  const stepError = useMemo(() => {
    return [
      !title.trim() ? 'Give your listing a title.' : !rent || Number(rent) < 1 ? 'Enter the monthly rent.' : null,
      !locality.trim() ? 'Enter the locality, e.g. Jalukbari or Six Mile.' : null,
      null, // photos: the 3-photo minimum applies to publishing, not to saving a draft
      null,
      null,
      null,
    ];
  }, [title, rent, locality]);

  function next() {
    const err = stepError[step];
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(publish: boolean) {
    setError(null);
    const firstInvalid = stepError.findIndex(Boolean);
    if (firstInvalid !== -1) {
      setStep(firstInvalid);
      return setError(stepError[firstInvalid]);
    }
    if (publish && photos.length < MIN_PHOTOS) {
      setStep(2);
      return setError(`Add at least ${MIN_PHOTOS} photos to submit for review — you can save a draft with fewer.`);
    }
    setSaving(publish ? 'publish' : 'draft');
    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        urls.push(await uploadImage(photos[i]!.file));
      }
      setProgress('Saving listing…');
      const listing = await createListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        propertyType,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        availableFrom: availableFrom || undefined,
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        images: urls.map((cloudinaryUrl, position) => ({ cloudinaryUrl, position })),
        institutionIds: institutionIds.length ? institutionIds : undefined,
      });
      if (publish) {
        // Publishing is a distinct transition (draft → pending), matching apps/api and
        // apps/mobile's listing/new.tsx.
        await updateListing(listing.id, { status: 'pending' });
      }
      router.replace(`/listing/${listing.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(null);
      setProgress(null);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/my-listings" className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-body hover:bg-white">
          <X size={17} aria-hidden /> Exit
        </Link>
        <span className="text-sm font-semibold text-muted">Step {step + 1} of {STEPS.length}</span>
      </div>

      {/* Progress */}
      <ol className="mt-4 grid grid-cols-6 gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              className="block w-full text-left"
              aria-current={i === step ? 'step' : undefined}
            >
              <span className={`block h-1.5 rounded-full ${i < step ? 'bg-primary' : i === step ? 'bg-navy' : 'bg-hairline'}`} />
              <span className={`mt-2 hidden text-xs font-semibold sm:block ${i === step ? 'text-ink' : 'text-muted'}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-[28px] bg-white p-6 ring-1 ring-navy/[0.06] sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Let&apos;s start with the basics</h1>
              <p className="mt-1 text-muted">What are you renting out, and for how much?</p>
            </div>
            <TypePicker value={propertyType} onChange={setPropertyType} />
            <Field label="Listing title" htmlFor="title" hint="Short and specific works best, e.g. “Furnished room near Cotton University”.">
              <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bright single room with attached bath" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly rent" htmlFor="rent">
                <RupeeInput id="rent" value={rent} onChange={setRent} placeholder="7000" />
              </Field>
              <Field label="Security deposit" htmlFor="deposit" hint="Optional">
                <RupeeInput id="deposit" value={deposit} onChange={setDeposit} placeholder="14000" />
              </Field>
            </div>
            <Field label="Available from" htmlFor="available" hint="Optional — leave empty if you're not sure yet.">
              <input id="available" type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Where is it?</h1>
              <p className="mt-1 text-muted">Renters search by locality. We show an approximate area on the map — never your exact address.</p>
            </div>
            <Field label="Locality" htmlFor="locality">
              <div className="relative">
                <MapPin size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" aria-hidden />
                <input id="locality" value={locality} maxLength={100} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Jalukbari, Six Mile, Zoo Road" className={`${inputClass} pl-11`} />
              </div>
            </Field>
            <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-body">City: <strong>Guwahati</strong> — GHOR is launching here first.</p>
            <InstitutionPicker institutions={institutions} value={institutionIds} onToggle={toggle(setInstitutionIds)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Add photos</h1>
              <p className="mt-1 text-muted">Listings with clear, bright photos get far more enquiries. You need at least {MIN_PHOTOS} to submit.</p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${dragOver ? 'border-primary bg-primary-light' : 'border-hairline bg-cream'}`}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-card">
                <ImagePlus size={26} aria-hidden />
              </span>
              <p className="mt-3 font-display font-bold text-ink">Drag photos here</p>
              <p className="text-sm text-muted">or</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="press mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy-soft">
                <Camera size={16} aria-hidden /> Choose photos
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className={`font-bold ${photos.length >= MIN_PHOTOS ? 'text-success-deep' : 'text-muted'}`}>
                {photos.length >= MIN_PHOTOS ? <Check size={15} className="mr-1 inline" aria-hidden /> : null}
                {photos.length} of {MIN_PHOTOS} minimum
              </span>
              {photos.length > 0 && <span className="text-muted">First photo is the cover</span>}
            </div>

            {photos.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <li key={p.url} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">Cover</span>}
                    <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                      {i !== 0 && (
                        <button type="button" onClick={() => makeCover(i)} className="glass-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">
                          <Star size={12} aria-hidden /> Cover
                        </button>
                      )}
                      <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`} className="glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full text-destructive-pressed">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">What does it offer?</h1>
              <p className="mt-1 text-muted">Tap everything that&apos;s included. Renters filter on these.</p>
            </div>
            <AmenityPicker value={amenities} onToggle={toggle(setAmenities)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Describe the place</h1>
              <p className="mt-1 text-muted">Optional, but it helps: who it suits, house rules, what&apos;s nearby.</p>
            </div>
            <Field label="Description" htmlFor="desc">
              <textarea id="desc" rows={7} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Quiet room on the first floor, 5 minutes' walk to the bus stop. Suits a student or working professional." className={`${inputClass} resize-y leading-6`} />
            </Field>
            <p className="text-right text-xs text-muted">{description.length}/4000</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Check it looks right</h1>
              <p className="mt-1 text-muted">This is roughly how renters will see your listing.</p>
            </div>
            <div className="overflow-hidden rounded-3xl ring-1 ring-navy/[0.08]">
              <div className="relative aspect-[16/9] bg-surface-sunken">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0].url} alt="Cover preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">No cover photo yet</div>
                )}
                <span className="glass-chip absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold capitalize">{propertyType}</span>
                <span className="glass-chip absolute bottom-3 left-3 rounded-2xl px-3 py-1.5 font-display text-lg font-bold">
                  {rent ? formatRent(Number(rent)) : '₹—'}<span className="text-xs font-medium text-muted">/mo</span>
                </span>
              </div>
              <div className="p-5">
                <p className="font-display text-lg font-bold text-ink">{title || 'Untitled listing'}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin size={14} aria-hidden /> {locality || 'No locality'}, Guwahati</p>
                {amenities.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-body">
                    {amenities.map((k) => {
                      const Icon = amenityIcon(k);
                      return <li key={k} className="inline-flex items-center gap-1"><Icon size={14} className="text-primary" aria-hidden /> {amenityLabel(k)}</li>;
                    })}
                  </ul>
                )}
                {description && <p className="mt-3 line-clamp-3 text-sm text-body">{description}</p>}
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className={`flex items-center gap-2 ${photos.length >= MIN_PHOTOS ? 'text-success-deep' : 'text-warning-deep'}`}>
                <Check size={16} aria-hidden /> {photos.length} photo{photos.length === 1 ? '' : 's'}{photos.length < MIN_PHOTOS ? ` — add ${MIN_PHOTOS - photos.length} more to submit` : ''}
              </li>
              <li className="flex items-center gap-2 text-body"><ShieldCheck size={16} className="text-primary" aria-hidden /> After you submit, GHOR reviews it — usually it&apos;s live within a day.</li>
            </ul>
          </div>
        )}

        {error && <p role="alert" className="mt-6 rounded-2xl bg-destructive-pale px-4 py-3 text-sm text-destructive-pressed">{error}</p>}
      </div>

      {/* Step controls */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/[0.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          {step > 0 ? (
            <button type="button" onClick={back} disabled={!!saving} className="press inline-flex h-12 items-center gap-1.5 rounded-full px-4 font-semibold text-ink hover:bg-surface">
              <ArrowLeft size={18} aria-hidden /> Back
            </button>
          ) : <span />}
          {progress && <span className="hidden text-sm text-muted sm:inline">{progress}</span>}
          <div className="ml-auto flex items-center gap-2">
            {(isLast || step >= 2) && (
              <button type="button" onClick={() => handleSubmit(false)} disabled={!!saving} className="press h-12 rounded-full px-4 text-sm font-semibold text-ink ring-1 ring-hairline hover:ring-ink/30 disabled:opacity-60 sm:px-5">
                {saving === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
            )}
            {isLast ? (
              <button type="button" onClick={() => handleSubmit(true)} disabled={!!saving} className="press inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-white hover:bg-primary-pressed disabled:opacity-70">
                {saving === 'publish' ? 'Submitting…' : 'Submit for review'}
              </button>
            ) : (
              <button type="button" onClick={next} className="press inline-flex h-12 items-center gap-2 rounded-full bg-navy px-6 font-bold text-white hover:bg-navy-soft">
                Continue <ArrowRight size={18} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
