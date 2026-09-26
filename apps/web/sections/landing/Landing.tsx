"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  GraduationCap,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { WaitlistForm } from "./WaitlistForm";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Landing page, redesign 2026-09-26 (gpt-taste pass — see apps/web/STATUS.md for the
// design plan). Motion rules: GSAP only here, never in product screens; every animation
// is gated on prefers-reduced-motion and uses gsap.from/fromTo so content is VISIBLE by
// default — the previous page hid sections until a reveal fired, which left blank blocks.
//
// Imagery: room renders cropped from the founder's approved mockups (assets/*.png) —
// illustrative only, never presented as a live listing. Replace with real photography
// once owners are onboarded.

const LOCALITIES = [
  "Beltola", "Six Mile", "Jalukbari", "Hatigaon", "Chandmari", "Dispur", "Ganeshguri",
  "Zoo Road", "Panbazar", "Khanapara", "Maligaon", "Lachit Nagar", "Bhangagarh", "Paltan Bazaar",
];

const STORY =
  "A renter in Guwahati asked a broker for help. He charged ₹400 just to open the door, and wanted ₹3,500 more if she took the room. That is ₹3,900 before a single month of rent. GHOR exists so that never happens again.";

const STEPS = [
  {
    icon: Search,
    title: "Search by locality or college",
    body: "Filter by rent, room or flat, and the amenities you actually need. Every result is a live, reviewed listing.",
    image: "/landing/room-bright.jpg",
  },
  {
    icon: ShieldCheck,
    title: "Check what's real",
    body: "Every listing is reviewed by a person before it goes live, with at least three photos. Reported listings go straight back for review.",
    image: "/landing/room-teal.jpg",
  },
  {
    icon: MessageCircle,
    title: "Chat with the owner",
    body: "Ask about parking, water, deposit, visiting hours. In-app, straight to the owner, no middleman reading along.",
    image: "/landing/room-cream.jpg",
  },
  {
    icon: KeyRound,
    title: "Move in. Pay no brokerage.",
    body: "Agree the details directly with the owner. Discovery and contact on GHOR are free for renters.",
    image: "/landing/room-desk.jpg",
  },
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero entrance — one timeline so it can be force-finished (below).
        const intro = gsap.timeline();
        intro
          .from("[data-hero-line]", { yPercent: 110, opacity: 0, duration: 1, ease: "power4.out", stagger: 0.12 }, 0)
          .from("[data-hero-fade]", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }, 0.35)
          .from("[data-hero-visual]", { y: 60, opacity: 0, scale: 0.94, duration: 1.2, ease: "power3.out" }, 0.2)
          .from("[data-float]", { y: 30, opacity: 0, duration: 0.9, ease: "back.out(1.6)", stagger: 0.15 }, 0.8);
        // Safety net: if animation frames are throttled (battery saver, background tab,
        // some embedded browsers), never leave the hero half-invisible — jump to the end.
        // Found 2026-09-26 when a throttled test browser froze the intro at ~70% opacity.
        const safety = window.setTimeout(() => intro.progress(1), 2500);

        // Scrubbing text reveal — the broker story.
        gsap.fromTo(
          "[data-story-word]",
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.05,
            scrollTrigger: { trigger: "[data-story]", start: "top 75%", end: "bottom 45%", scrub: true },
          },
        );

        // Bento cards rise in.
        gsap.from("[data-bento]", {
          y: 50,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: "[data-bento-grid]", start: "top 80%" },
        });

        // Accordion + waitlist.
        gsap.from("[data-rise]", {
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: "[data-rise-group]", start: "top 80%" },
        });

        return () => window.clearTimeout(safety);
      });

      // Pinned "how it works" — desktop only (pinning on phones fights the address bar).
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: "[data-steps]",
          start: "top 96px",
          end: "bottom bottom",
          pin: "[data-steps-title]",
          pinSpacing: false,
        });
        gsap.utils.toArray<HTMLElement>("[data-step-image]").forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 0.82, opacity: 0.4 },
            { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 90%", end: "top 45%", scrub: true } },
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <main ref={root} className="w-full max-w-full overflow-x-hidden bg-cream text-ink">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <nav className="flex w-full max-w-5xl items-center justify-between gap-3 rounded-full bg-white/75 py-2 pl-5 pr-2 shadow-[0_8px_30px_rgba(11,27,63,0.08)] ring-1 ring-navy/5 backdrop-blur-md">
          <Link href="/" aria-label="GHOR home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-semibold text-body md:flex">
            <a href="#how" className="hover:text-primary">How it works</a>
            <a href="#owners" className="hover:text-primary">For owners</a>
            <Link href="/sign-in" className="hover:text-primary">Sign in</Link>
          </div>
          <a href="#waitlist" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy-soft">
            Join waitlist
          </a>
        </nav>
      </header>

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate px-5 pt-32 sm:px-8 md:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-[-10%] top-40 h-[420px] w-[420px] rounded-full bg-[#F4D9B8]/40 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl">
          <p data-hero-fade className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-navy/70">
            <MapPin size={16} className="text-primary" aria-hidden /> Launching first in Guwahati
          </p>
          <h1 className="max-w-6xl font-display text-[clamp(2.25rem,6.2vw,6rem)] font-bold leading-[0.98] tracking-[-0.04em] text-navy">
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block">
                Find your{" "}
                <span
                  aria-hidden
                  className="mx-1 hidden h-[0.72em] w-[1.6em] translate-y-[0.06em] rounded-full bg-cover bg-center align-baseline ring-4 ring-white sm:inline-block"
                  style={{ backgroundImage: "url(/landing/room-bright.jpg)" }}
                />{" "}
                place.
              </span>
            </span>
            <span className="block overflow-hidden pb-2">
              <span data-hero-line className="block text-primary">Directly from the owner.</span>
            </span>
          </h1>
          <p data-hero-fade className="mt-7 max-w-2xl text-lg leading-8 text-body/80 sm:text-xl">
            No ₹400 viewing fees. No ₹3,500 brokerage. Verified rooms and flats in Guwahati, and a
            direct line to the person who owns them.
          </p>
          <div data-hero-fade className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#waitlist" className="press group inline-flex h-14 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] hover:bg-primary-pressed">
              Join the waitlist
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
            <a href="#how" className="press inline-flex h-14 items-center rounded-full bg-white px-7 text-base font-bold text-navy ring-1 ring-navy/10 hover:ring-navy/25">
              See how it works
            </a>
          </div>
        </div>

        {/* Asymmetric visual: a large room image offset right, product UI floating over it. */}
        <div className="relative mx-auto mt-16 max-w-6xl md:mt-20">
          <div data-hero-visual className="relative ml-auto aspect-[4/3] w-full overflow-hidden rounded-[32px] sm:aspect-[16/10] shadow-[0_40px_80px_-20px_rgba(11,27,63,0.35)] md:w-[82%] lg:aspect-[16/8]">
            <Image src="/landing/room-hero.jpg" alt="A bright furnished room with a study desk" fill priority sizes="(min-width: 768px) 80vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/50 via-transparent to-transparent" />
          </div>

          {/* Floating listing card — a product preview, labelled as such. */}
          <div data-float className="absolute -bottom-28 left-3 w-[215px] overflow-hidden rounded-3xl bg-white shadow-[0_24px_50px_-12px_rgba(11,27,63,0.35)] ring-1 ring-navy/5 sm:-bottom-10 sm:left-4 sm:w-[290px] md:bottom-10">
            <div className="relative aspect-[4/3]">
              <Image src="/landing/room-teal.jpg" alt="" fill sizes="290px" className="object-cover" />
              <span className="glass-chip absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-success-deep">
                <ShieldCheck size={13} aria-hidden /> Verified by GHOR
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-navy/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">Preview</span>
            </div>
            <div className="p-4">
              <p className="font-display text-base font-bold text-ink">Single room, twin beds</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin size={13} aria-hidden /> Near your college</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-display text-lg font-bold text-ink">₹5,000<span className="text-xs font-medium text-muted">/month</span></span>
                <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-bold text-primary">Wi-Fi</span>
              </div>
            </div>
          </div>

          {/* Floating chat bubble. */}
          <div data-float className="absolute -right-2 top-6 hidden w-[260px] rounded-3xl bg-white p-4 shadow-[0_24px_50px_-12px_rgba(11,27,63,0.35)] ring-1 ring-navy/5 sm:block md:right-6 md:top-10">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy font-display text-xs font-bold text-white">OW</span>
              <div>
                <p className="text-sm font-bold text-ink">Owner</p>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-success-deep"><BadgeCheck size={12} aria-hidden /> Phone verified</p>
              </div>
            </div>
            <p className="mt-3 rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2.5 text-sm text-ink">Yes, it&apos;s available. You can visit on Saturday.</p>
            <p className="ml-auto mt-2 w-fit rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm text-white">Perfect, see you at 11!</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Marquee */}
      <section aria-label="Guwahati localities" className="mt-40 border-y border-navy/10 bg-white py-6 sm:mt-28 md:mt-24">
        <div className="flex w-max animate-[ghor-marquee_45s_linear_infinite] gap-10 motion-reduce:animate-none">
          {[...LOCALITIES, ...LOCALITIES].map((name, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl font-bold tracking-tight text-navy/80 sm:text-3xl" aria-hidden={i >= LOCALITIES.length}>
              {name}
              <Home size={18} className="text-primary/60" aria-hidden />
            </span>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- Story */}
      <section className="px-5 py-32 sm:px-8 md:py-48">
        <div data-story className="mx-auto max-w-5xl">
          <p className="mb-8 text-sm font-semibold text-primary">Why GHOR exists</p>
          <p className="font-display text-[clamp(1.75rem,3.6vw,3.25rem)] font-bold leading-[1.15] tracking-[-0.03em] text-navy">
            {STORY.split(" ").map((w, i) => (
              <span key={i} data-story-word className="inline">{w} </span>
            ))}
          </p>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-7 ring-1 ring-navy/10">
              <p className="text-sm font-semibold text-muted">The broker way</p>
              <p className="mt-2 font-display text-5xl font-bold tracking-tight text-destructive-pressed line-through decoration-[3px]">₹3,900</p>
              <p className="mt-2 text-sm text-muted">₹400 to view + ₹3,500 commission, on a ₹7,000 room.</p>
            </div>
            <div className="rounded-3xl bg-navy p-7 text-white">
              <p className="text-sm font-semibold text-white/60">The GHOR way</p>
              <p className="mt-2 font-display text-5xl font-bold tracking-tight">₹0</p>
              <p className="mt-2 text-sm text-white/70">Searching, checking and contacting owners is free for renters.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Bento */}
      <section className="bg-white px-5 py-32 sm:px-8 md:py-44">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl font-display text-[clamp(2rem,4.4vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.035em] text-navy">
            Built to be more believable than a Facebook group.
          </h2>
          <div data-bento-grid className="mt-14 grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-[repeat(2,minmax(260px,auto))]">
            {/* 2x2 — moderation */}
            <article data-bento className="group relative overflow-hidden rounded-[28px] bg-navy text-white md:col-span-2 md:row-span-2">
              <Image src="/landing/room-cream.jpg" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover opacity-55 transition-transform duration-700 ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/10" />
              <div className="relative flex h-full min-h-[360px] flex-col justify-end p-8">
                <ShieldCheck size={36} className="text-success" aria-hidden />
                <h3 className="mt-4 font-display text-3xl font-bold tracking-tight">A real person reviews every listing.</h3>
                <p className="mt-3 max-w-md text-white/75">Nothing goes live until it&apos;s approved. Three photos minimum. Edit a live listing and it goes back for review. Enough reports and it comes down.</p>
              </div>
            </article>
            {/* 2x1 — chat */}
            <article data-bento className="group relative overflow-hidden rounded-[28px] bg-primary p-8 text-white md:col-span-2">
              <MessageCircle size={30} aria-hidden />
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">Chat straight to the owner.</h3>
              <p className="mt-2 max-w-sm text-white/80">In-app messages and a call button. No numbers passed around a WhatsApp group.</p>
              <div className="pointer-events-none absolute bottom-6 right-6 hidden w-56 space-y-2 transition-transform duration-700 group-hover:-translate-y-1 xl:block">
                <p className="rounded-2xl rounded-bl-md bg-white/15 px-3 py-2 text-sm backdrop-blur">Is parking available?</p>
                <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-white px-3 py-2 text-sm text-navy">Yes, one bike spot.</p>
              </div>
            </article>
            {/* 1x1 — college */}
            <article data-bento className="rounded-[28px] bg-cream-deep p-7">
              <GraduationCap size={28} className="text-navy" aria-hidden />
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-navy">Near your college.</h3>
              <p className="mt-2 text-sm leading-6 text-body/75">Owners tag nearby campuses, so you can filter by the place you actually commute to.</p>
            </article>
            {/* 1x1 — map */}
            <article data-bento className="relative overflow-hidden rounded-[28px] bg-primary-light p-7">
              <MapPin size={28} className="text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-navy">See it on the map.</h3>
              <p className="mt-2 text-sm leading-6 text-body/75">Rent on every pin, so you can compare areas at a glance.</p>
              <div aria-hidden className="absolute bottom-5 right-5 flex gap-1.5">
                <span className="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">₹5k</span>
                <span className="translate-y-3 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">₹7.5k</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- How it works (pinned) */}
      <section id="how" className="scroll-mt-24 px-5 py-32 sm:px-8 md:py-44">
        <div data-steps className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div data-steps-title className="lg:h-fit">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.4vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.035em] text-navy">
              From search to keys, without a middleman.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-body/75">Four steps. No viewing fee, no commission, no forwarding your number to strangers.</p>
          </div>
          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-navy/10 sm:flex-row">
                {/* Compact photo: the illustrative renders are small, so they stay sharp. */}
                <div data-step-image className="relative aspect-[16/9] shrink-0 origin-left overflow-hidden sm:aspect-auto sm:w-56">
                  <Image src={s.image} alt="" fill sizes="(min-width: 640px) 224px, 100vw" className="object-cover" />
                  <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white font-display text-sm font-bold text-navy">{i + 1}</span>
                </div>
                <div className="flex gap-4 p-6 sm:py-8">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                    <s.icon size={20} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-navy">{s.title}</h3>
                    <p className="mt-1.5 leading-7 text-body/75">{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Seekers / Owners accordion */}
      <section id="owners" className="scroll-mt-24 bg-white px-5 py-32 sm:px-8 md:py-44">
        <div data-rise-group className="mx-auto max-w-6xl">
          <h2 data-rise className="max-w-3xl font-display text-[clamp(2rem,4.4vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.035em] text-navy">
            Two sides. One honest place.
          </h2>
          <div data-rise className="mt-14 flex flex-col gap-4 lg:h-[460px] lg:flex-row">
            {[
              {
                icon: Search,
                who: "For renters",
                title: "Find a room without the broker tax.",
                points: ["Browse verified rooms and flats", "Filter by rent, area and college", "Read reviews from people who actually enquired", "Chat or call the owner directly"],
                image: "/landing/room-bright.jpg",
                tone: "bg-navy text-white",
              },
              {
                icon: Building2,
                who: "For owners",
                title: "List in minutes. Pay nothing to list.",
                points: ["Post a room or flat with photos", "Get enquiries in-app, with notifications", "See views and enquiries per listing", "No agent between you and your tenant"],
                image: "/landing/room-green.jpg",
                tone: "bg-cream-deep text-navy",
              },
            ].map((side) => (
              <article
                key={side.who}
                className={`group relative flex min-h-[380px] flex-col justify-end overflow-hidden rounded-[28px] p-8 transition-[flex-grow] duration-700 ease-out lg:flex-1 lg:hover:flex-[1.6] ${side.tone}`}
              >
                <Image src={side.image} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover opacity-25 transition-transform duration-700 group-hover:scale-105" />
                <div className="relative">
                  <p className="inline-flex items-center gap-2 text-sm font-bold opacity-80">
                    <side.icon size={16} aria-hidden /> {side.who}
                  </p>
                  <h3 className="mt-3 max-w-md font-display text-3xl font-bold tracking-tight">{side.title}</h3>
                  <ul className="mt-5 space-y-2">
                    {side.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 text-sm font-medium opacity-90">
                        <BadgeCheck size={16} className="shrink-0" aria-hidden /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div data-rise className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            {[
              { icon: Camera, text: "At least 3 photos on every listing" },
              { icon: Star, text: "Only people who messaged the owner can review" },
              { icon: ShieldCheck, text: "Listings reviewed before they go live" },
            ].map((f) => (
              <p key={f.text} className="flex items-center gap-3 rounded-2xl bg-cream px-5 py-4 font-semibold text-navy">
                <f.icon size={18} className="shrink-0 text-primary" aria-hidden /> {f.text}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Waitlist / CTA */}
      <section id="waitlist" className="scroll-mt-24 px-3 py-24 sm:px-6 md:py-32">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-navy px-6 py-16 sm:px-12 md:py-24">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-[#F4D9B8]/15 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h2 className="font-display text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[1] tracking-[-0.04em] text-white">
                Be first in when GHOR opens.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">
                We&apos;re opening in Guwahati first. Join the list and we&apos;ll let you know the day
                verified listings go live.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="px-5 pb-12 pt-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 border-t border-navy/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted">Rooms and flats in Guwahati, directly from owners.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-body">
            <Link href="/sign-in" className="hover:text-primary">Sign in</Link>
            <Link href="/privacy" className="hover:text-primary">Privacy</Link>
            <Link href="/terms" className="hover:text-primary">Terms</Link>
            <span className="text-muted-soft">© {new Date().getFullYear()} GHOR</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
