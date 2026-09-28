"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { WaitlistApiResponse, WaitlistLead } from "@/types/waitlist";

// Same /api/waitlist contract as the previous landing page (Google Sheet + confirmation
// email, see app/api/waitlist). Redesign 2026-09-26 dropped the old form's fabricated
// social proof ("37 spots claimed", placeholder avatars) — nothing here claims a number
// we don't have.
export function WaitlistForm() {
  const [form, setForm] = useState<WaitlistLead>({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    if (form.name.trim().length < 2) return "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Please enter a valid email.";
    if (form.phone.replace(/\D/g, "").length < 10) return "Please enter a 10-digit phone number.";
    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() }),
      });
      const data = (await res.json()) as WaitlistApiResponse;
      if (!res.ok || !data.success) return setError(data.message || "Something went wrong. Please try again.");
      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-4 rounded-3xl bg-white/10 p-6 ring-1 ring-white/15">
        <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={28} aria-hidden />
        <div>
          <p className="text-lg font-bold text-white">You&apos;re on the list.</p>
          <p className="mt-1 text-sm leading-6 text-white/70">
            We&apos;ll write to {form.email.trim()} the moment GHOR opens in Guwahati.
          </p>
        </div>
      </div>
    );
  }

  const input =
    "h-14 w-full rounded-2xl bg-white/[0.08] px-5 text-white placeholder:text-white/45 ring-1 ring-white/15 outline-none transition focus:bg-white/[0.12] focus:ring-2 focus:ring-primary";

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="sr-only">Your name</span>
        <input className={input} placeholder="Your name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label>
        <span className="sr-only">Email</span>
        <input className={input} type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label>
        <span className="sr-only">Phone</span>
        <input className={input} type="tel" inputMode="tel" placeholder="Phone" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </label>
      {error && (
        <p role="alert" className="sm:col-span-2 rounded-xl bg-destructive/15 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="press group sm:col-span-2 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white transition hover:bg-primary-pressed disabled:opacity-70"
      >
        {submitting ? "Saving your spot…" : "Join the waitlist"}
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
      </button>
    </form>
  );
}
