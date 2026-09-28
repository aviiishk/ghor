'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CloudOff,
  Check,
  ImagePlus,
  Lightbulb,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { UploadError, configProblemMessage, uploadImageWithProgress, type UploadErrorKind } from '@/lib/cloudinary';
import { getUploadSignature } from '../api';
import { useUploadsAvailable } from '../hooks';
import { cx } from '@/components/ui';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';
export type PhotoItem = {
  id: string;
  /** Absent for photos that were already saved on the listing (Edit). */
  file?: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  url?: string;
  error?: string;
  kind?: UploadErrorKind;
};

const CONCURRENCY = 2;

// Owns the photo list for Create and Edit listing. Photos upload as soon as they're added
// (signed direct uploads — see lib/cloudinary.ts) — not all at once at submit, which is
// where "Image upload failed" used to appear with no way to see which photo, why, or to
// retry it. `initial` seeds already-saved photos (Edit), in their saved order.
export function usePhotoUploads(max: number, initial?: { id: string; url: string }[]) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (initial ?? []).map((p) => ({ id: p.id, previewUrl: p.url, url: p.url, status: 'done' as const, progress: 1 })),
  );
  const inFlight = useRef(new Set<string>());
  const aborts = useRef(new Map<string, AbortController>());

  const patch = (id: string, p: Partial<PhotoItem>) =>
    setPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // Simple queue: whenever the list changes, start queued uploads up to CONCURRENCY.
  useEffect(() => {
    const running = photos.filter((p) => p.status === 'uploading').length;
    const next = photos.filter((p) => p.status === 'queued' && !inFlight.current.has(p.id)).slice(0, Math.max(0, CONCURRENCY - running));
    next.forEach((p) => {
      if (!p.file) return;
      const file = p.file;
      inFlight.current.add(p.id);
      const ctrl = new AbortController();
      aborts.current.set(p.id, ctrl);
      patch(p.id, { status: 'uploading', progress: 0, error: undefined });
      uploadImageWithProgress(file, getUploadSignature, (f) => patch(p.id, { progress: f }), ctrl.signal)
        .then((url) => patch(p.id, { status: 'done', progress: 1, url }))
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          patch(p.id, {
            status: 'error',
            error: e instanceof Error ? e.message : 'Upload failed',
            kind: e instanceof UploadError ? e.kind : 'network',
          });
        })
        .finally(() => {
          inFlight.current.delete(p.id);
          aborts.current.delete(p.id);
        });
    });
  }, [photos]);

  // Revoke preview URLs on unmount.
  const latest = useRef(photos);
  latest.current = photos;
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const add = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
      setPhotos((prev) =>
        [
          ...prev,
          ...files.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: 'queued' as const,
            progress: 0,
          })),
        ].slice(0, max),
      );
      return files.length;
    },
    [max],
  );

  const remove = (id: string) =>
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      aborts.current.get(id)?.abort();
      return prev.filter((p) => p.id !== id);
    });
  // Replace the whole list with already-uploaded photos (restoring an autosaved draft).
  const seed = (urls: string[]) =>
    setPhotos(urls.map((url, i) => ({ id: `saved-${i}-${url.slice(-12)}`, previewUrl: url, url, status: 'done' as const, progress: 1 })));
  const retry = (id: string) => patch(id, { status: 'queued', progress: 0, error: undefined });
  const retryAll = () => setPhotos((prev) => prev.map((p) => (p.status === 'error' ? { ...p, status: 'queued', progress: 0, error: undefined } : p)));
  const move = (from: number, to: number) =>
    setPhotos((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });

  return {
    photos,
    add,
    remove,
    retry,
    retryAll,
    seed,
    move,
    makeCover: (i: number) => move(i, 0),
    uploading: photos.filter((p) => p.status === 'queued' || p.status === 'uploading').length,
    failed: photos.filter((p) => p.status === 'error').length,
    configBlocked: photos.some((p) => p.status === 'error' && p.kind === 'config'),
    doneUrls: photos.filter((p) => p.status === 'done' && p.url).map((p) => p.url!),
  };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;

export function PhotoUploader({ uploads, min, max }: { uploads: PhotoUploads; min: number; max: number }) {
  const { photos, add, remove, retry, retryAll, move, makeCover, uploading, failed } = uploads;
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Checked before any upload (a signature request uploads nothing), and also inferred
  // from a failed upload — either way the notice names configuration, not the photo.
  const { unavailable } = useUploadsAvailable();
  const configProblem = unavailable || uploads.configBlocked ? configProblemMessage() : null;
  const done = photos.length - uploading - failed;
  const retryableFailures = photos.filter((p) => p.status === 'error' && (p.kind === 'network' || p.kind === 'server')).length;
  // One copy of each distinct error, under the grid — the tiles themselves stay short.
  const errorMessages = Array.from(new Set(photos.filter((p) => p.status === 'error' && p.error).map((p) => p.error!))).filter((m) => m !== configProblem);
  const ready = done >= min;

  return (
    <div className="space-y-6">
      {configProblem && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-warning-pale p-4 text-warning-deep">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm leading-6">{configProblem}</p>
        </div>
      )}

      {/* Drop zone — big when empty, a compact bar once photos exist */}
      <div
        onDragOver={(e) => {
          if (dragIndex != null) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (dragIndex != null) return;
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        className={cx(
          'rounded-2xl border-2 border-dashed text-center transition-colors',
          photos.length ? 'flex flex-wrap items-center justify-between gap-3 p-4 text-left' : 'px-6 py-14',
          dragOver ? 'border-primary bg-primary-light' : 'border-navy/15 bg-cream',
        )}
      >
        {photos.length ? (
          <>
            <p className="text-sm text-body">
              <strong className="text-navy">Drop more photos here</strong> or add them from your device.
            </p>
            <button type="button" onClick={() => input.current?.click()} disabled={photos.length >= max} className="press inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-sm font-bold text-white hover:bg-navy-soft disabled:opacity-50">
              <ImagePlus size={16} aria-hidden /> Add photos
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-lift">
              <Camera size={28} aria-hidden />
            </span>
            <p className="mt-5 font-display text-xl font-bold text-navy">Drag your photos here</p>
            <p className="mt-1 text-muted">JPG or PNG, up to 20 MB each. Add at least {min}.</p>
            <button type="button" onClick={() => input.current?.click()} className="press mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-white hover:bg-primary-pressed">
              <ImagePlus size={18} aria-hidden /> Choose photos
            </button>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {photos.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className={cx('flex flex-wrap items-center gap-x-1.5 font-bold', ready ? 'text-success-deep' : 'text-navy')}>
              {ready && <Check size={16} aria-hidden />}
              <span className="whitespace-nowrap">{ready ? `${done} photo${done === 1 ? '' : 's'} uploaded` : `${done} uploaded · ${min - done} more needed`}</span>
              {(uploading > 0 || failed > 0) && (
                <span className="font-medium text-muted">
                  {' '}· {uploading ? `${uploading} uploading` : ''}{uploading && failed ? ', ' : ''}{failed ? (configProblem ? `${failed} waiting` : `${failed} failed`) : ''}
                </span>
              )}
            </p>
            {retryableFailures > 0 && (
              <button type="button" onClick={retryAll} className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
                <RotateCcw size={15} aria-hidden /> Retry failed
              </button>
            )}
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex != null && dragIndex !== i) {
                    move(dragIndex, i);
                    setDragIndex(i);
                  }
                }}
                className={cx(
                  'group relative overflow-hidden rounded-xl bg-cream-deep',
                  i === 0 ? 'col-span-2 row-span-2 aspect-[4/3] sm:aspect-auto' : 'aspect-[4/3]',
                  dragIndex === i && 'opacity-60 ring-2 ring-primary',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={`Photo ${i + 1}`} className={cx('h-full w-full object-cover', p.status === 'error' && 'opacity-40 grayscale')} draggable={false} />

                {i === 0 && <span className="absolute left-2.5 top-2.5 rounded-md bg-navy px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Cover</span>}

                {/* Upload state */}
                {(p.status === 'uploading' || p.status === 'queued') && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/70 to-transparent p-2.5 pt-8">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      {p.status === 'queued' ? 'Waiting…' : `Uploading ${Math.round(p.progress * 100)}%`}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/30">
                      <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                    </div>
                  </div>
                )}
                {p.status === 'done' && (
                  <span className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-white" title="Uploaded">
                    <Check size={14} strokeWidth={3} aria-label="Uploaded" />
                  </span>
                )}
                {p.status === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                    {p.kind === 'config' ? <CloudOff size={20} className="text-navy/60" aria-hidden /> : <AlertTriangle size={20} className="text-destructive-pressed" aria-hidden />}
                    <p className="text-xs font-bold text-ink" title={p.error}>{p.kind === 'config' ? 'Not uploaded yet' : p.kind === 'file' ? 'Can’t use this file' : 'Upload failed'}</p>
                    {(p.kind === 'network' || p.kind === 'server') && (
                      <button type="button" onClick={() => retry(p.id)} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-navy shadow-sm">
                        <RotateCcw size={12} aria-hidden /> Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="absolute inset-x-2 top-2 flex justify-end gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {i !== 0 && p.status !== 'error' && (
                    <button type="button" onClick={() => makeCover(i)} className="glass-chip inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold">
                      <Star size={12} aria-hidden /> Make cover
                    </button>
                  )}
                  <button type="button" onClick={() => remove(p.id)} aria-label={`Remove photo ${i + 1}`} className="glass-chip inline-flex h-8 w-8 items-center justify-center rounded-full text-destructive-pressed">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier" className="glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40">
                    <ArrowLeft size={13} />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === photos.length - 1} aria-label="Move later" className="glass-chip inline-flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40">
                    <ArrowRight size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {errorMessages.map((m) => (
            <p key={m} role="alert" className="flex items-start gap-2 rounded-xl bg-destructive-pale px-4 py-3 text-sm text-destructive-pressed">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {m}
            </p>
          ))}
          <p className="text-xs text-muted">Drag to reorder. The first photo is the cover renters see in search.</p>
        </>
      )}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-inset ring-navy/[0.08]">
        <p className="flex items-center gap-2 font-semibold text-navy">
          <Lightbulb size={17} className="text-primary" aria-hidden /> Photos that get more enquiries
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-body sm:grid-cols-2">
          <li>Shoot in daylight with the lights on</li>
          <li>Hold the phone level, from a corner of the room</li>
          <li>Show the bed, bathroom and kitchen if included</li>
          <li>Tidy up first — no people or personal documents</li>
        </ul>
      </div>
    </div>
  );
}
