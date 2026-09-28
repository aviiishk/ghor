'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Images,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useCreateListing, useGeocodePreview, usePopularLocalities } from '@/features/listings/hooks';
import { friendlyError } from '@/lib/errors';
import { updateListing } from '@/features/listings/api';
import { useInstitutions } from '@/features/institutions/hooks';
import { useProfile } from '@/features/auth/hooks';
import { suggestLocalities } from '@/features/listings/localities';
import { PhotoUploader, usePhotoUploads } from '@/features/listings/components/PhotoUploader';
import { PhotoGallery } from '@/features/listings/components/PhotoGallery';
import {
  AboutText,
  AmenityList,
  DetailSection,
  KeyFacts,
  ListingHeadline,
  PriceHeading,
} from '@/features/listings/components/ListingDetailView';
import {
  AmenityPicker,
  Field,
  InstitutionPicker,
  RupeeInput,
  TypePicker,
  errorId,
  inputClass,
} from '@/features/listings/components/ListingFormFields';
import { Avatar, Button, cx, formatRent } from '@/components/ui';

const LocationMap = dynamic(() => import('@/features/listings/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" />,
});

// Create listing, redesign v2 (2026-09-27). Same API contract as before: create (always a
// draft) → optional publish (draft → pending). Root CLAUDE.md §11: under 3 minutes — six
// short steps, each validated before moving on. Photos now upload the moment they're
// added (with progress and retry) instead of all at once at submit.
const STEPS = [
  { name: 'Basics', blurb: 'Type, title and rent' },
  { name: 'Location', blurb: 'Locality and nearby' },
  { name: 'Photos', blurb: 'At least 3' },
  { name: 'Amenities', blurb: 'What’s included' },
  { name: 'Description', blurb: 'Optional details' },
  { name: 'Preview', blurb: 'Check and submit' },
] as const;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 20;
const RENT_MIN = 500;
const RENT_MAX = 200000;
const DRAFT_KEY = 'ghor.newListingDraft.v1';

type FieldKey = 'title' | 'rent' | 'deposit' | 'availableFrom' | 'locality';
const STEP_FIELDS: FieldKey[][] = [['title', 'rent', 'deposit', 'availableFrom'], ['locality'], [], [], [], []];
const FIELD_IDS: Record<FieldKey, string> = { title: 'title', rent: 'rent', deposit: 'deposit', availableFrom: 'available', locality: 'locality' };

const PROMPTS = [
  { label: 'Who it suits', start: 'Suits: ' },
  { label: 'What’s nearby', start: 'Nearby: ' },
  { label: 'House rules', start: 'House rules: ' },
  { label: 'Good to know', start: 'Good to know: ' },
];

export default function NewListingPage() {
  const router = useRouter();
  const { data: profile } = useProfile();
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
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<number[]>([]);
  const uploads = usePhotoUploads(MAX_PHOTOS);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loadedRef = useRef(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Autosave on this device — the typed details, the URLs of photos that finished uploading
  // and the current step — so a refresh or an interrupted session never loses work or
  // position. Cleared once the listing is saved.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (d && (d.title || d.rent || d.locality)) {
        setTitle(d.title ?? '');
        setDescription(d.description ?? '');
        setPropertyType(d.propertyType === 'flat' ? 'flat' : 'room');
        setRent(d.rent ?? '');
        setDeposit(d.deposit ?? '');
        setAvailableFrom(d.availableFrom ?? '');
        setLocality(d.locality ?? '');
        setAmenities(Array.isArray(d.amenities) ? d.amenities : []);
        setInstitutionIds(Array.isArray(d.institutionIds) ? d.institutionIds : []);
        // Already-uploaded photos live on Cloudinary, so they survive a refresh too.
        // Photos that were still uploading can't be resumed and need adding again.
        const saved = Array.isArray(d.photos)
          ? d.photos.filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\/res\.cloudinary\.com\//.test(u))
          : [];
        if (saved.length) uploads.seed(saved);
        // Reopen on the step they were on. Submitting re-validates every step regardless.
        if (Number.isInteger(d.step) && d.step > 0) setStep(Math.min(d.step, STEPS.length - 1));
        setRestored(true);
      }
    } catch {
      // storage unavailable — autosave is a convenience only
    }
    loadedRef.current = true;
    // Restore once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      try {
        if (!title && !rent && !locality && !description) return;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, propertyType, rent, deposit, availableFrom, locality, amenities, institutionIds, photos: uploads.doneUrls, step }));
        setSavedAt(Date.now());
      } catch {
        // ignore
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doneUrls is keyed by its joined value below
  }, [title, description, propertyType, rent, deposit, availableFrom, locality, amenities, institutionIds, uploads.doneUrls.join('|'), step]);
  function startOver() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setTitle('');
    setDescription('');
    setPropertyType('room');
    setRent('');
    setDeposit('');
    setAvailableFrom('');
    setLocality('');
    setAmenities([]);
    setInstitutionIds([]);
    uploads.seed([]);
    setRestored(false);
    setSavedAt(null);
    setAttempted([]);
    goTo(0);
  }

  const createListing = useCreateListing();
  const { data: institutions } = useInstitutions('');

  const toggle = (setter: typeof setAmenities) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));

  // Field-level validation. Messages say exactly what's wrong and what's accepted.
  const fieldErrors = useMemo(() => {
    const e: Partial<Record<FieldKey, string>> = {};
    const t = title.trim();
    if (!t) e.title = 'Give your listing a title, e.g. “Furnished room near Cotton University”.';
    else if (t.length < 8) e.title = 'Make the title a little longer — at least 8 characters.';
    const r = Number(rent);
    if (!rent) e.rent = 'Enter the monthly rent.';
    else if (r < RENT_MIN || r > RENT_MAX) e.rent = `Enter a monthly rent between ${formatRent(RENT_MIN)} and ₹2,00,000.`;
    if (deposit && r >= RENT_MIN && Number(deposit) > r * 12) {
      e.deposit = `That’s more than 12 months’ rent (${formatRent(r * 12)}). Check the amount.`;
    }
    if (availableFrom && availableFrom < new Date().toISOString().slice(0, 10)) {
      e.availableFrom = 'Pick today or a later date — or leave it empty.';
    }
    if (locality.trim().length < 2) e.locality = 'Enter the locality, e.g. Jalukbari or Six Mile.';
    return e;
  }, [title, rent, deposit, availableFrom, locality]);

  // Per-step summary (first failing field) — photos' 3-minimum applies only to submitting.
  const stepError = STEP_FIELDS.map((fields) => {
    const bad = fields.filter((f) => fieldErrors[f]);
    return bad.length ? `Fix the highlighted field${bad.length > 1 ? 's' : ''} to continue.` : null;
  });
  const show = (f: FieldKey) => (attempted.includes(STEP_FIELDS.findIndex((fs) => fs.includes(f))) ? fieldErrors[f] ?? null : null);
  const stepDone = (i: number) => {
    if (i === 0) return !stepError[0];
    if (i === 1) return !stepError[1];
    if (i === 2) return uploads.doneUrls.length >= MIN_PHOTOS;
    if (i === 3) return amenities.length > 0;
    if (i === 4) return description.trim().length > 0;
    return false;
  };

  function goTo(i: number) {
    setError(null);
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function flagStep(i: number) {
    setAttempted((a) => (a.includes(i) ? a : [...a, i]));
    const firstBad = STEP_FIELDS[i]!.find((f) => fieldErrors[f]);
    if (firstBad) setTimeout(() => document.getElementById(FIELD_IDS[firstBad])?.focus(), 0);
  }
  function next() {
    const err = stepError[step];
    if (err) {
      flagStep(step);
      return setError(err);
    }
    goTo(Math.min(step + 1, STEPS.length - 1));
  }

  // Submit problems about photos send the owner back to the Photos step. The message renders
  // under the photo grid, so bring it into view — otherwise Submit just looks like it jumped
  // back a few steps for no reason (RC QA 2026-09-28).
  function blockOnPhotos(message: string) {
    setStep(2);
    setError(message);
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  async function handleSubmit(publish: boolean) {
    setError(null);
    const firstInvalid = stepError.findIndex(Boolean);
    if (firstInvalid !== -1) {
      setStep(firstInvalid);
      flagStep(firstInvalid);
      return setError(stepError[firstInvalid]);
    }
    if (uploads.uploading > 0) {
      return setError('Some photos are still uploading. Give them a moment, then try again.');
    }
    if (uploads.failed > 0 && uploads.configBlocked) {
      return blockOnPhotos('This listing can’t be submitted until photo uploads are working — see the notice above.');
    }
    if (uploads.failed > 0) {
      return blockOnPhotos(`${uploads.failed} photo${uploads.failed === 1 ? '' : 's'} didn’t upload. Retry or remove ${uploads.failed === 1 ? 'it' : 'them'} before saving.`);
    }
    if (publish && uploads.doneUrls.length < MIN_PHOTOS) {
      return blockOnPhotos(`Add at least ${MIN_PHOTOS} photos to submit for review — you can save a draft with fewer.`);
    }
    setSaving(publish ? 'publish' : 'draft');
    try {
      const listing = await createListing.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        propertyType,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : undefined,
        locality: locality.trim(),
        availableFrom: availableFrom || undefined,
        amenities: Object.fromEntries(amenities.map((a) => [a, true])),
        images: uploads.doneUrls.map((cloudinaryUrl, position) => ({ cloudinaryUrl, position })),
        institutionIds: institutionIds.length ? institutionIds : undefined,
      });
      if (publish) {
        // Publishing is a distinct transition (draft → pending), matching apps/api and
        // apps/mobile's listing/new.tsx.
        await updateListing(listing.id, { status: 'pending' });
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      router.replace(`/listing/${listing.id}`);
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t save your listing. Your details are still here — please try again.'));
    } finally {
      setSaving(null);
    }
  }

  function addPrompt(start: string) {
    setDescription((d) => (d.trim() ? `${d.replace(/\s+$/, '')}\n${start}` : start));
    setTimeout(() => {
      const el = descRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  const isLast = step === STEPS.length - 1;
  const cover = uploads.photos[0]?.previewUrl;
  const statusLine = uploads.uploading
    ? `Uploading ${uploads.uploading} photo${uploads.uploading === 1 ? '' : 's'}…`
    : uploads.failed
      ? uploads.configBlocked
        ? 'Photo uploads unavailable right now'
        : `${uploads.failed} photo${uploads.failed === 1 ? '' : 's'} failed`
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-36 pt-5 sm:px-6 lg:px-8">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/my-listings" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-body hover:bg-white">
          <X size={17} aria-hidden /> Exit
        </Link>
        <p className="text-sm font-semibold text-muted">
          Step {step + 1} of {STEPS.length} · <span className="text-navy">{STEPS[step].name}</span>
        </p>
      </div>

      {restored && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-light px-4 py-3 text-sm text-navy">
          <p className="flex items-center gap-2">
            <Check size={16} className="text-primary" aria-hidden /> We restored the listing you were working on{uploads.doneUrls.length ? `, including ${uploads.doneUrls.length} uploaded photo${uploads.doneUrls.length === 1 ? '' : 's'}` : ''}. Any photo that was still uploading needs adding again.
          </p>
          <button type="button" onClick={startOver} className="font-bold text-primary underline-offset-4 hover:underline">
            Start over
          </button>
        </div>
      )}

      {/* Mobile progress */}
      <div className="mt-3 flex gap-1.5 lg:hidden" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s.name} className={cx('h-1.5 flex-1 rounded-full transition-colors', i < step ? 'bg-primary' : i === step ? 'bg-navy' : 'bg-navy/10')} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:mt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        {/* ------------------------------------------------ Step rail (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-8">
            <ol aria-label="Steps" className="space-y-1">
              {STEPS.map((s, i) => {
                const done = i !== step && stepDone(i);
                const reachable = i <= step || stepError.slice(0, i).every((e) => !e);
                return (
                  <li key={s.name}>
                    <button
                      type="button"
                      onClick={() => reachable && goTo(i)}
                      disabled={!reachable}
                      aria-current={i === step ? 'step' : undefined}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        i === step ? 'bg-white ring-1 ring-inset ring-navy/10' : reachable ? 'hover:bg-white/70' : 'opacity-50',
                      )}
                    >
                      <span
                        className={cx(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          done ? 'bg-primary text-white' : i === step ? 'bg-navy text-white' : 'bg-navy/[0.07] text-navy',
                        )}
                      >
                        {done ? <Check size={15} strokeWidth={3} aria-hidden /> : i + 1}
                      </span>
                      <span>
                        <span className={cx('block text-sm font-bold', i === step ? 'text-navy' : 'text-body')}>{s.name}</span>
                        <span className="block text-xs text-muted">{s.blurb}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {step < STEPS.length - 1 && (
              <div className="[@media(max-height:820px)]:hidden">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">How it looks in search</p>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-deep">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted">
                      <Images size={20} aria-hidden /> Cover photo
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-md bg-navy px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">{propertyType}</span>
                </div>
                <p className="mt-3 font-display text-xl font-bold text-navy">
                  {rent ? formatRent(Number(rent)) : '₹—'}
                  <span className="text-sm font-medium text-muted">/month</span>
                </p>
                <p className="mt-1 line-clamp-1 font-semibold text-ink">{title || 'Your listing title'}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <MapPin size={13} className="text-primary" aria-hidden /> {locality || 'Locality'}, Guwahati
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ Step content */}
        <div className="min-w-0">
          {step === 0 && (
            <StepShell title="What are you renting out?" lead="Start with the basics. You can change any of this later.">
              <TypePicker value={propertyType} onChange={setPropertyType} />
              <Field label="Listing title" htmlFor="title" error={show('title')} hint="Short and specific works best — the kind of room, and one thing renters care about.">
                <input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Furnished single room with attached bath" aria-invalid={!!show('title') || undefined} aria-describedby={show('title') ? errorId('title') : undefined} className={cx(inputClass, show('title') && '!ring-2 !ring-destructive')} />
                <p className="mt-1.5 text-right text-xs text-muted">{title.length}/120</p>
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Monthly rent" htmlFor="rent" error={show('rent')} hint="Between ₹500 and ₹2,00,000">
                  <RupeeInput id="rent" value={rent} onChange={setRent} placeholder="7,000" invalid={!!show('rent')} />
                </Field>
                <Field label="Security deposit" htmlFor="deposit" optional error={show('deposit')} hint="Usually 1–2 months’ rent">
                  <RupeeInput id="deposit" value={deposit} onChange={setDeposit} placeholder="14,000" invalid={!!show('deposit')} />
                </Field>
              </div>
              <Field label="Available from" htmlFor="available" optional error={show('availableFrom')} hint="Leave empty if you’re not sure yet.">
                <input id="available" type="date" value={availableFrom} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setAvailableFrom(e.target.value)} aria-invalid={!!show('availableFrom') || undefined} aria-describedby={show('availableFrom') ? errorId('available') : undefined} className={cx(inputClass, 'sm:max-w-xs', show('availableFrom') && '!ring-2 !ring-destructive')} />
              </Field>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="Where is it?" lead="Renters search by locality. They’ll see an approximate area on the map — never your exact address.">
              <LocalityInput value={locality} onChange={setLocality} error={show('locality')} />
              <AreaPreview locality={locality} />
              <InstitutionPicker institutions={institutions} value={institutionIds} onToggle={toggle(setInstitutionIds)} />
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Show renters the place" lead={`Clear, bright photos get far more enquiries. Add at least ${MIN_PHOTOS} — the first one is your cover.`}>
              <PhotoUploader uploads={uploads} min={MIN_PHOTOS} max={MAX_PHOTOS} />
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="What’s included?" lead="Tap everything the renter gets. Renters filter by these, so only pick what’s really there.">
              <AmenityPicker value={amenities} onToggle={toggle(setAmenities)} />
              <p className="text-sm text-muted">{amenities.length ? `${amenities.length} selected` : 'Nothing selected yet'}</p>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Tell renters about it" lead="Optional, but listings with a few honest lines get better enquiries. Tap a prompt to start a line.">
              <div className="flex flex-wrap gap-2">
                {PROMPTS.map((p) => (
                  <button key={p.label} type="button" onClick={() => addPrompt(p.start)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-navy ring-1 ring-inset ring-navy/10 hover:ring-navy/30">
                    <Plus size={15} aria-hidden /> {p.label}
                  </button>
                ))}
              </div>
              <Field label="Description" htmlFor="desc" optional>
                <textarea
                  ref={descRef}
                  id="desc"
                  rows={9}
                  maxLength={4000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={'e.g. Quiet first-floor room, 5 minutes’ walk to the bus stop.\nSuits: a student or working professional.\nHouse rules: no smoking inside.'}
                  className={cx(inputClass, 'resize-y leading-7')}
                />
                <p className="mt-1.5 text-right text-xs text-muted">{description.length}/4000</p>
              </Field>
            </StepShell>
          )}

          {step === 5 && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-[clamp(1.9rem,3vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.03em] text-navy">Check it looks right</h1>
                  <p className="mt-2 max-w-xl text-lg text-muted">This is exactly how renters will see your listing once it’s approved.</p>
                </div>
              </div>

              <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Check2 ok={uploads.doneUrls.length >= MIN_PHOTOS} text={uploads.doneUrls.length >= MIN_PHOTOS ? `${uploads.doneUrls.length} photos uploaded` : `${uploads.doneUrls.length} of ${MIN_PHOTOS} photos`} />
                <Check2 ok={amenities.length > 0} soft text={amenities.length ? `${amenities.length} amenities` : 'No amenities picked'} />
                <Check2 ok={!!description.trim()} soft text={description.trim() ? 'Description added' : 'No description'} />
              </ul>

              {/* Renter view — the same components Listing Detail uses */}
              <div className="mt-8 overflow-hidden rounded-3xl bg-cream ring-1 ring-inset ring-navy/10">
                <div className="flex items-center justify-between border-b border-navy/[0.08] bg-white px-5 py-3 text-sm">
                  <span className="font-semibold text-navy">Renter view</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-warning-deep">
                    <Clock size={14} aria-hidden /> Goes to review when you submit
                  </span>
                </div>
                <div className="p-4 sm:p-7">
                  <PhotoGallery
                    images={uploads.photos.map((p) => ({ id: p.id, cloudinaryUrl: p.url ?? p.previewUrl }))}
                    title={title || 'Your listing'}
                  />
                  <div className="mt-8 grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="min-w-0">
                      <ListingHeadline title={title || 'Untitled listing'} propertyType={propertyType} locality={locality || 'Locality'} city="Guwahati" verified={false} />
                      <KeyFacts propertyType={propertyType} rent={Number(rent) || 0} deposit={deposit ? Number(deposit) : null} availableFrom={availableFrom || null} columns={2} />
                      <div className="mt-8 flex items-center gap-4">
                        <Avatar name={profile?.fullName} size="lg" />
                        <p className="font-semibold text-ink">Listed by {profile?.fullName ?? 'you'}</p>
                      </div>
                      {description.trim() && (
                        <DetailSection title="About this place">
                          <AboutText text={description.trim()} />
                        </DetailSection>
                      )}
                      {amenities.length > 0 && (
                        <DetailSection title="What’s included">
                          <AmenityList amenities={amenities} />
                        </DetailSection>
                      )}
                    </div>
                    <div className="hidden xl:block">
                      <div className="rounded-2xl bg-white p-6 shadow-lift ring-1 ring-inset ring-navy/[0.08]">
                        <PriceHeading rent={Number(rent) || 0} deposit={deposit ? Number(deposit) : null} />
                        <div className="mt-6 flex h-14 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">Chat with owner</div>
                        <p className="mt-3 text-center text-xs text-muted">Renters contact you from here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-6 flex items-start gap-2 text-sm text-body">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-success-deep" aria-hidden />
                After you submit, a person at GHOR checks your listing — usually within a day. You’ll get a notification when it’s live.
              </p>
            </div>
          )}

          {error && (
            <p ref={errorRef} role="alert" className="mt-6 flex items-start gap-2 rounded-2xl bg-destructive-pale px-4 py-3 text-sm text-destructive-pressed">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden /> {error}
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/[0.08] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:px-8">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} disabled={!!saving} className="press inline-flex h-12 items-center gap-1.5 rounded-full px-3 font-semibold text-navy underline-offset-4 hover:underline sm:px-4">
              <ArrowLeft size={18} aria-hidden /> Back
            </button>
          ) : (
            <span />
          )}
          {statusLine ? (
            <span className="hidden text-sm font-semibold text-muted md:inline">{statusLine}</span>
          ) : savedAt ? (
            <span className="hidden items-center gap-1.5 text-sm text-muted md:inline-flex" title="Your details are kept on this device until you save the listing. Photos aren’t kept.">
              <Check size={15} className="text-success-deep" aria-hidden /> Details saved on this device
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {step >= 2 && (
              <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={!!saving} className="!h-12">
                {saving === 'draft' ? 'Saving…' : 'Save draft'}
              </Button>
            )}
            {isLast ? (
              <Button size="lg" onClick={() => handleSubmit(true)} disabled={!!saving} className="!h-12 !px-6">
                {saving === 'publish' ? 'Submitting…' : 'Submit for review'}
              </Button>
            ) : (
              <Button variant="navy" size="lg" onClick={next} className="!h-12 !px-6">
                Continue <ArrowRight size={18} aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[clamp(1.9rem,3vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.03em] text-navy">{title}</h1>
      <p className="mt-3 text-lg leading-7 text-muted">{lead}</p>
      <div className="mt-8 space-y-7">{children}</div>
    </div>
  );
}

function Check2({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return (
    <li
      className={cx(
        'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
        ok ? 'bg-success-pale text-success-deep' : soft ? 'bg-white text-muted ring-1 ring-inset ring-navy/[0.08]' : 'bg-warning-pale text-warning-deep',
      )}
    >
      {ok ? <Check size={16} strokeWidth={3} aria-hidden /> : <AlertTriangle size={16} aria-hidden />} {text}
    </li>
  );
}

function LocalityInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  const [open, setOpen] = useState(false);
  const { data: popular } = usePopularLocalities();
  const suggestions = useMemo(() => {
    const fromLive = (popular ?? []).map((p) => p.locality).filter((l) => value.trim() && l.toLowerCase().includes(value.trim().toLowerCase()));
    return Array.from(new Set([...fromLive, ...suggestLocalities(value)])).filter((s) => s.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6);
  }, [value, popular]);

  return (
    <Field label="Locality" htmlFor="locality" error={error} hint="Use the name people in Guwahati actually say, e.g. Six Mile, Jalukbari, Zoo Road.">
      <div className="relative">
        <MapPin size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" aria-hidden />
        <input
          id="locality"
          value={value}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Start typing a locality"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId('locality') : undefined}
          className={cx(inputClass, 'pl-12 text-lg font-semibold', error && '!ring-2 !ring-destructive')}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-xl bg-white p-1.5 shadow-float ring-1 ring-navy/[0.08]">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-semibold text-ink hover:bg-cream"
                >
                  <MapPin size={15} className="text-muted" aria-hidden /> {s}
                  <span className="ml-auto text-xs font-medium text-muted">Guwahati</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-body ring-1 ring-inset ring-navy/10">
        City: <strong className="text-navy">Guwahati</strong> <span className="text-muted">· GHOR is launching here first</span>
      </p>
    </Field>
  );
}

// Asks apps/api's geocoder (the same one saving uses) where this locality lands, and
// shows the ~400m area renters will see. Debounced so it doesn't fire per keystroke.
function AreaPreview({ locality }: { locality: string }) {
  const [debounced, setDebounced] = useState(locality);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(locality), 700);
    return () => clearTimeout(t);
  }, [locality]);
  const { data: point, isFetching, isError } = useGeocodePreview(debounced);
  const ready = debounced.trim().length >= 3;

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-navy/[0.08]">
      <div className="relative isolate h-56 bg-cream-deep sm:h-64">
        {ready && point ? (
          <LocationMap lat={point.latitude} lng={point.longitude} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
            <MapPin size={24} className="text-navy/40" aria-hidden />
            {!ready ? 'Type a locality to preview the area renters will see.' : isFetching ? 'Finding the area…' : isError ? 'Couldn’t check the map just now. You can carry on — this is only a preview.' : 'Checking…'}
          </div>
        )}
      </div>
      <div className="px-5 py-4 text-sm">
        {ready && !isFetching && point === null ? (
          <p className="flex items-start gap-2 text-warning-deep">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            We couldn’t place “{debounced.trim()}” on the map. Your listing will still show in search — try the more common spelling to appear on the map too.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-body">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success-deep" aria-hidden />
            Renters see an approximate area like this, never your exact address. Share the address in chat when you arrange a visit.
          </p>
        )}
      </div>
    </div>
  );
}
