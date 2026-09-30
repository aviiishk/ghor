"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  Camera,
  Check,
  Flag,
  GraduationCap,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserCheck,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { WaitlistForm } from "./WaitlistForm";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Landing page, redesign v2 (2026-09-27). Evolves the v1 page (same brand, headline and
// trust-first positioning) toward "a property discovery product": photography dominates,
// the hero reads like a real listing, and the page shows the product rather than
// describing it.
//
// Honesty rules (DESIGN.md "Redesign Amendments"): every listing shown here is labelled as
// an EXAMPLE. The photos are licensed stock interiors (Unsplash licence, see
// public/landing/photos/README.md) — replace them with real Guwahati homes once owners
// are onboarded. No invented counts, ratings, testimonials or partner logos.
//
// Motion rules: GSAP only on this page; every animation sits behind
// prefers-reduced-motion and uses from/fromTo so content is visible by default, plus a
// force-finish safety net for throttled browsers.

const MARQUEE_A = ["Beltola", "Six Mile", "Jalukbari", "Hatigaon", "Chandmari", "Dispur", "Ganeshguri", "Zoo Road"];
const MARQUEE_B = ["Panbazar", "Khanapara", "Maligaon", "Lachit Nagar", "Bhangagarh", "Paltan Bazaar", "Narengi", "Ulubari"];

const STORY =
  "A renter in Guwahati asked a broker for help. He charged ₹400 just to open the door, and wanted ₹3,500 more if she took the room. That is ₹3,900 before a single month of rent.";

type Example = {
  id: string;
  img: string;
  rent: number;
  title: string;
  locality: string;
  type: "room" | "flat";
  furnished: boolean;
  tags: string[];
  avail: string;
};
// Illustrative examples for the discovery demo — clearly labelled on the page.
const EXAMPLES: Example[] = [
  { id: "a", img: "/landing/photos/room-bright-bed.jpg", rent: 6500, title: "Single room, attached bath", locality: "Six Mile", type: "room", furnished: true, tags: ["Wi-Fi", "Attached bath"], avail: "Available now" },
  { id: "b", img: "/landing/photos/flat-living-blue.jpg", rent: 14000, title: "1BHK flat with balcony", locality: "Beltola", type: "flat", furnished: false, tags: ["Parking", "24×7 water"], avail: "From 1 Nov" },
  { id: "c", img: "/landing/photos/room-simple.jpg", rent: 5000, title: "Quiet room near the campus", locality: "Jalukbari", type: "room", furnished: true, tags: ["Wi-Fi", "Furnished"], avail: "Available now" },
  { id: "d", img: "/landing/photos/studio-kitchen.jpg", rent: 9500, title: "Studio with kitchen", locality: "Zoo Road", type: "flat", furnished: true, tags: ["Furnished", "Lift"], avail: "From 15 Oct" },
];

// Illustrative map of Guwahati: rough relative positions of well-known localities, the
// Brahmaputra along the north. Not to scale and says so — no listing data is implied.
const MAP_POINTS: { name: string; x: number; y: number; big?: boolean }[] = [
  { name: "Jalukbari", x: 200, y: 262, big: true },
  { name: "Maligaon", x: 310, y: 228 },
  { name: "Panbazar", x: 505, y: 150 },
  { name: "Paltan Bazaar", x: 548, y: 196, big: true },
  { name: "Chandmari", x: 660, y: 150 },
  { name: "Zoo Road", x: 648, y: 222, big: true },
  { name: "Bhangagarh", x: 575, y: 262 },
  { name: "Ganeshguri", x: 676, y: 300, big: true },
  { name: "Dispur", x: 712, y: 344 },
  { name: "Hatigaon", x: 660, y: 392 },
  { name: "Six Mile", x: 790, y: 360, big: true },
  { name: "Beltola", x: 740, y: 440, big: true },
  { name: "Khanapara", x: 872, y: 430 },
  { name: "Narengi", x: 885, y: 180 },
  { name: "Lokhra", x: 488, y: 470 },
];

const STEPS = [
  { icon: Search, title: "Search the way you talk", body: "Type a locality, a landmark or your college. Filter by rent, room or flat, and what you actually need.", image: "/landing/photos/flat-living-plants.jpg" },
  { icon: ShieldCheck, title: "Every home is checked first", body: "A person reviews each listing before it goes live, with at least three real photos. Reported listings go straight back for review.", image: "/landing/photos/room-bedroom-art.jpg" },
  { icon: MessageCircle, title: "Talk to the owner, not a middleman", body: "Ask about water, parking, deposit or visiting hours in the app, or call. Nobody takes a cut of the conversation.", image: "/landing/photos/studio-kitchen.jpg" },
  { icon: KeyRound, title: "Move in. Pay no brokerage.", body: "Agree the details directly. Searching and contacting owners on GHOR is free for renters.", image: "/landing/photos/room-bright-bed.jpg" },
];

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const intro = gsap.timeline();
        intro
          .from("[data-hero-line]", { yPercent: 110, opacity: 0, duration: 1, ease: "power4.out", stagger: 0.12 }, 0)
          .from("[data-hero-fade]", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }, 0.3)
          .from("[data-hero-photo]", { clipPath: "inset(12% 10% 12% 10% round 28px)", duration: 1.4, ease: "power3.inOut" }, 0.1)
          .from("[data-hero-photo] img", { scale: 1.18, duration: 1.8, ease: "power3.out" }, 0.1)
          .from("[data-float]", { y: 36, opacity: 0, duration: 0.9, ease: "back.out(1.5)", stagger: 0.14 }, 0.9);
        // Safety net: throttled animation frames (battery saver, background tab) must never
        // leave the hero half-drawn.
        const safety = window.setTimeout(() => intro.progress(1), 2600);

        gsap.to("[data-bob]", { y: -8, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.7, delay: 2 });

        // Broker story: words scrub in; the fee is struck through; GHOR's number counts down.
        gsap.fromTo(
          "[data-story-word]",
          { opacity: 0.14 },
          { opacity: 1, ease: "none", stagger: 0.05, scrollTrigger: { trigger: "[data-story]", start: "top 78%", end: "bottom 55%", scrub: true } },
        );
        gsap.from("[data-strike]", { scaleX: 0, duration: 0.8, ease: "power3.inOut", scrollTrigger: { trigger: "[data-fees]", start: "top 72%" } });
        const counter = document.querySelector<HTMLElement>("[data-count]");
        if (counter) {
          const state = { v: 3900 };
          const tween = gsap.to(state, {
            v: 0,
            duration: 1.6,
            ease: "power2.inOut",
            immediateRender: false,
            scrollTrigger: { trigger: "[data-fees]", start: "top 70%" },
            onStart: () => {
              counter.textContent = rupees(3900);
              // Never leave a wrong figure on screen if frames are throttled mid-count.
              window.setTimeout(() => {
                tween.progress(1);
                counter.textContent = rupees(0);
              }, 3000);
            },
            onUpdate: () => (counter.textContent = rupees(Math.round(state.v))),
          });
        }

        gsap.from("[data-demo-card]", { y: 60, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, scrollTrigger: { trigger: "[data-demo]", start: "top 70%" } });
        gsap.from("[data-map-dot]", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(2)", stagger: 0.05, scrollTrigger: { trigger: "[data-map]", start: "top 70%" } });
        gsap.from("[data-river]", { strokeDashoffset: 1600, duration: 2, ease: "power2.out", scrollTrigger: { trigger: "[data-map]", start: "top 75%" } });
        gsap.fromTo("[data-trust-photo] img", { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: "[data-trust-photo]", start: "top bottom", end: "bottom top", scrub: true } });
        gsap.from("[data-rise]", { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: "[data-rise-group]", start: "top 80%" } });
        gsap.fromTo("[data-cta-photo] img", { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: "[data-cta]", start: "top bottom", end: "bottom top", scrub: true } });

        return () => window.clearTimeout(safety);
      });

      // Pinned "how it works" — desktop only (pinning on phones fights the address bar).
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({ trigger: "[data-steps]", start: "top 110px", end: "bottom bottom", pin: "[data-steps-title]", pinSpacing: false });
        gsap.utils.toArray<HTMLElement>("[data-step-image]").forEach((el) => {
          gsap.fromTo(el, { scale: 0.86, opacity: 0.5 }, { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 92%", end: "top 50%", scrub: true } });
        });
      });
    },
    { scope: root },
  );

  return (
    <main ref={root} className="w-full max-w-full overflow-x-hidden bg-cream text-ink">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <nav className="flex w-full max-w-6xl items-center justify-between gap-3 rounded-full bg-white/80 py-2 pl-5 pr-2 shadow-[0_8px_30px_rgba(11,27,63,0.08)] ring-1 ring-navy/5 backdrop-blur-md">
          <Link href="/" aria-label="GHOR home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-semibold text-body md:flex">
            <a href="#discover" className="hover:text-primary">Find a home</a>
            <a href="#how" className="hover:text-primary">How it works</a>
            <a href="#owners" className="hover:text-primary">For owners</a>
            <Link href="/sign-in" className="hover:text-primary">Sign in</Link>
          </div>
          <div className="flex items-center gap-1">
            {/* Phones get no link row above — keep sign-in one tap away for returning users. */}
            <Link href="/sign-in" className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-body hover:text-primary md:hidden">
              Sign in
            </Link>
            <a href="#waitlist" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy-soft">
              Join waitlist
            </a>
          </div>
        </nav>
      </header>

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative px-5 pb-20 pt-28 sm:px-8 md:pt-36 lg:pb-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-10">
          <div className="relative z-10">
            <p data-hero-fade className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-navy ring-1 ring-navy/10">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Launching first in Guwahati
            </p>
            <h1 className="mt-7 font-display text-[clamp(2.9rem,5.1vw,5.1rem)] font-bold leading-[0.96] tracking-[-0.045em] text-navy">
              <span className="block overflow-hidden pb-2">
                <span data-hero-line className="block">Find your place.</span>
              </span>
              <span className="block overflow-hidden pb-3">
                <span data-hero-line className="block text-primary">Directly from the owner.</span>
              </span>
            </h1>
            <p data-hero-fade className="mt-6 max-w-xl text-lg leading-8 text-body/80 sm:text-xl">
              Rooms and flats across Guwahati, checked by a person before they go live. No ₹400 viewing fee. No ₹3,500 brokerage.
            </p>

            {/* A search bar that leads into the product */}
            <div data-hero-fade className="mt-9 max-w-xl">
              <Link
                href="/browse"
                className="group flex h-16 items-center gap-3 rounded-2xl bg-white pl-5 pr-2 shadow-float ring-1 ring-navy/[0.08] transition-shadow hover:ring-navy/20"
              >
                <MapPin size={21} className="shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-muted">Where are you looking?</span>
                  <span className="block truncate font-semibold text-navy">Six Mile, Beltola, near Cotton University…</span>
                </span>
                <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors group-hover:bg-primary-pressed">
                  <Search size={17} aria-hidden /> <span className="hidden sm:inline">Search</span>
                </span>
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-navy/80">
                <a href="#waitlist" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  Join the waitlist <ArrowRight size={15} aria-hidden />
                </a>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-success-deep" aria-hidden /> Free for renters</span>
              </div>
            </div>
          </div>

          {/* Discovery composition: a listing that feels real, labelled as an example */}
          <div data-hero-fade className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <figure className="m-0">
            <div data-hero-photo className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-float sm:aspect-[5/5.4]">
              <Image src="/landing/photos/flat-living-plants.jpg" alt="A bright, plant-filled living room" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/5 to-navy/20" />
              <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-success-deep shadow-sm">
                  <ShieldCheck size={14} aria-hidden /> Approved by GHOR
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-navy">Flat</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11px] font-bold backdrop-blur-sm">
                    <CalendarCheck size={12} aria-hidden /> Available now
                  </span>
                </div>
                <p className="mt-3 font-display text-[2.6rem] font-bold leading-none tracking-[-0.03em]">
                  ₹12,000<span className="text-base font-medium text-white/70">/month</span>
                </p>
                <p className="mt-2 text-lg font-semibold">1BHK with a sunny living room</p>
                <p className="mt-1 flex items-center gap-1.5 text-white/80">
                  <MapPin size={15} aria-hidden /> Ganeshguri, Guwahati · Wi-Fi · Furnished
                </p>
              </div>
            </div>
            <figcaption className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-navy/30" aria-hidden /> How a listing looks on GHOR — example details, illustrative photo.
            </figcaption>
            </figure>

            {/* Floating product UI */}
            <div data-float className="absolute -left-4 top-[18%] hidden sm:block lg:-left-14">
              <div data-bob className="w-56 rounded-2xl bg-white p-3.5 shadow-float ring-1 ring-navy/5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-navy"><SlidersHorizontal size={13} aria-hidden /> Filters</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {["Flat", "Under ₹15k", "Furnished", "Wi-Fi"].map((c, i) => (
                    <span key={c} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${i === 1 ? "bg-navy text-white" : "bg-cream-deep text-navy"}`}>{c}</span>
                  ))}
                </div>
              </div>
            </div>
            <div data-float className="absolute -right-3 top-[40%] hidden sm:block lg:-right-8">
              <div data-bob className="w-64 rounded-2xl bg-white p-4 shadow-float ring-1 ring-navy/5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white"><UserCheck size={16} aria-hidden /></span>
                  <div>
                    <p className="text-sm font-bold text-ink">Owner</p>
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-success-deep"><BadgeCheck size={12} aria-hidden /> Phone verified</p>
                  </div>
                </div>
                <p className="mt-3 rounded-2xl rounded-tl-md bg-cream px-3.5 py-2.5 text-sm text-ink">Yes, it&apos;s available. Come see it on Saturday?</p>
                <p className="ml-auto mt-2 w-fit rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm text-white">Perfect — 11 am works!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Marquee */}
      <nav aria-label="Browse by locality" className="group overflow-hidden border-y border-navy/10 bg-navy py-7 text-white">
        <p className="mx-auto mb-4 max-w-7xl px-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/50 sm:px-8">Browse by locality</p>
        {[MARQUEE_A, MARQUEE_B].map((row, r) => (
          <div
            key={r}
            className={`flex w-max gap-10 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none ${r === 0 ? "animate-[ghor-marquee_55s_linear_infinite]" : "mt-3 animate-[ghor-marquee_65s_linear_infinite_reverse]"}`}
          >
            {[...row, ...row].map((name, i) => (
              <Link
                key={i}
                href={`/browse?locality=${encodeURIComponent(name)}`}
                aria-hidden={i >= row.length}
                tabIndex={i >= row.length ? -1 : undefined}
                className={`flex items-center gap-10 whitespace-nowrap rounded-lg font-display font-bold tracking-[-0.03em] transition-colors ${r === 0 ? "text-[clamp(2rem,4.5vw,3.75rem)] text-white hover:text-primary-tint" : "text-[clamp(1.4rem,3vw,2.4rem)] text-white/35 hover:text-white"}`}
              >
                {name}
                <Home size={r === 0 ? 26 : 18} className={r === 0 ? "text-primary" : "text-white/25"} aria-hidden />
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* ---------------------------------------------------------------- The broker tax */}
      <section className="px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
          <div data-story>
            <p className="mb-6 text-sm font-semibold text-primary">Why GHOR exists</p>
            <p className="font-display text-[clamp(1.8rem,3.4vw,3.2rem)] font-bold leading-[1.12] tracking-[-0.03em] text-navy">
              {STORY.split(" ").map((w, i) => (
                <span key={i} data-story-word className="inline">{w} </span>
              ))}
            </p>
          </div>
          <div data-fees className="space-y-5">
            <div className="rounded-3xl bg-white p-8 ring-1 ring-navy/10">
              <p className="text-sm font-semibold text-muted">The broker way</p>
              <p className="relative mt-2 inline-block font-display text-[clamp(3.5rem,8vw,6.5rem)] font-bold leading-none tracking-[-0.04em] text-destructive-pressed/80">
                ₹3,900
                <span data-strike aria-hidden className="absolute left-[-4%] top-1/2 h-[6px] w-[108%] origin-left -rotate-6 rounded-full bg-destructive-pressed" />
              </p>
              <p className="mt-3 text-muted">₹400 to view + ₹3,500 commission, on a ₹7,000 room.</p>
            </div>
            <div className="rounded-3xl bg-navy p-8 text-white">
              <p className="text-sm font-semibold text-white/60">The GHOR way</p>
              <p data-count className="mt-2 font-display text-[clamp(3.5rem,8vw,6.5rem)] font-bold leading-none tracking-[-0.04em] tabular-nums">₹0</p>
              <p className="mt-3 text-lg text-white/80">Talk directly to the owner. Searching and contacting is free.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Discovery demo */}
      <DiscoverySection />

      {/* ---------------------------------------------------------------- City map */}
      <section data-map className="relative overflow-hidden bg-navy px-5 py-20 text-white sm:px-8 md:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary-tint">Made for one city first</p>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.035em]">
              Built around the Guwahati you actually live in.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
              Search by the names people say — Six Mile, Zoo Road, Jalukbari. Every listing shows an approximate area on the map, never an owner&apos;s exact address.
            </p>
            <ul className="mt-8 space-y-3 text-white/85">
              <li className="flex items-center gap-3"><MapPin size={18} className="text-primary-tint" aria-hidden /> Locality-first search and filters</li>
              <li className="flex items-center gap-3"><GraduationCap size={18} className="text-primary-tint" aria-hidden /> Filter by the college you commute to</li>
              <li className="flex items-center gap-3"><ShieldCheck size={18} className="text-primary-tint" aria-hidden /> Exact addresses shared only in chat</li>
            </ul>
          </div>
          <figure className="relative">
            <svg viewBox="0 0 1000 540" className="w-full" role="img" aria-label="Illustrative map of Guwahati localities along the Brahmaputra">
              <defs>
                <pattern id="ghor-dots" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.4" fill="rgba(255,255,255,0.09)" />
                </pattern>
              </defs>
              <rect width="1000" height="540" rx="28" fill="url(#ghor-dots)" />
              <path data-river d="M -20 205 C 120 170, 260 160, 400 118 S 640 42, 1020 64" fill="none" stroke="rgba(37,99,235,0.55)" strokeWidth="46" strokeLinecap="round" strokeDasharray="1600" strokeDashoffset="0" />
              <text x="120" y="150" fill="rgba(219,234,254,0.7)" fontSize="15" fontWeight="600" letterSpacing="3" transform="rotate(-9 120 150)">BRAHMAPUTRA</text>
              {MAP_POINTS.map((p) => (
                <g key={p.name} data-map-dot>
                  {p.big && <circle cx={p.x} cy={p.y} r="16" fill="rgba(37,99,235,0.25)" />}
                  <circle cx={p.x} cy={p.y} r={p.big ? 7 : 5} fill={p.big ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
                  <text x={p.x + 14} y={p.y + 5} fill={p.big ? "#FFFFFF" : "rgba(255,255,255,0.6)"} fontSize={p.big ? 19 : 15} fontWeight={p.big ? 700 : 500}>{p.name}</text>
                </g>
              ))}
            </svg>
            <figcaption className="mt-3 text-right text-xs text-white/45">Illustrative map · not to scale</figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Trust */}
      <section className="px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-5xl font-display text-[clamp(2.4rem,6vw,5.6rem)] font-bold leading-[0.98] tracking-[-0.045em] text-navy">
            Built to be more believable than a{" "}
            <span className="relative inline-block text-muted-soft">
              Facebook group
              <span aria-hidden className="absolute left-0 top-[55%] h-[0.08em] w-full rounded-full bg-navy/70" />
            </span>
            .
          </h2>

          <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div data-trust-photo className="relative min-h-[420px] overflow-hidden rounded-[28px]">
              <Image src="/landing/photos/room-bedroom-art.jpg" alt="A tidy bedroom with a double bed" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-8 text-white sm:p-10">
                <ShieldCheck size={34} className="text-success" aria-hidden />
                <p className="mt-4 max-w-md font-display text-3xl font-bold leading-tight tracking-tight">A real person reviews every listing before anyone sees it.</p>
              </div>
            </div>
            <div className="divide-y divide-navy/[0.08] border-y border-navy/[0.08]">
              {[
                { icon: Camera, title: "Three photos, minimum", body: "No photo-less posts. Owners show the actual room before it can go live." },
                { icon: Flag, title: "Reports take listings down", body: "Enough reports and a listing goes straight back into review." },
                { icon: Star, title: "Reviews from real enquiries", body: "Only people who messaged the owner about a listing can review it." },
                { icon: UserCheck, title: "Owners, not middlemen", body: "Verified phone numbers, and chat that stays between you and the owner." },
              ].map((f) => (
                <div key={f.title} className="flex gap-4 py-6">
                  <f.icon size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-display text-lg font-bold text-navy">{f.title}</h3>
                    <p className="mt-1 text-[15px] leading-6 text-body/75">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- How it works (pinned) */}
      <section id="how" className="scroll-mt-24 bg-white px-5 py-20 sm:px-8 md:py-28">
        <div data-steps className="mx-auto grid grid-cols-1 max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div data-steps-title className="lg:h-fit">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,4.6vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.035em] text-navy">
              From search to keys, without a middleman.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-8 text-body/75">Four steps. No viewing fee, no commission, no passing your number around.</p>
          </div>
          <ol className="space-y-10">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div data-step-image className="relative aspect-[16/9] origin-bottom overflow-hidden rounded-[24px]">
                  <Image src={s.image} alt="" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
                  <span className="absolute left-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white font-display text-lg font-bold text-navy">{i + 1}</span>
                </div>
                <div className="mt-5 flex gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <s.icon size={20} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold tracking-tight text-navy">{s.title}</h3>
                    <p className="mt-1.5 max-w-xl text-lg leading-8 text-body/75">{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Renters / Owners */}
      <section id="owners" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
        <div data-rise-group className="mx-auto max-w-7xl">
          <h2 data-rise className="max-w-3xl font-display text-[clamp(2.2rem,4.6vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.035em] text-navy">
            Two sides. One honest place.
          </h2>
          <div data-rise className="mt-14 flex flex-col gap-4 lg:h-[520px] lg:flex-row">
            {[
              {
                icon: Search,
                who: "For renters",
                title: "Find a room without the broker tax.",
                points: ["Browse checked rooms and flats", "Filter by rent, area and college", "Read reviews from people who enquired", "Chat or call the owner directly"],
                image: "/landing/photos/room-simple.jpg",
                cta: { href: "#waitlist", label: "Join the waitlist" },
              },
              {
                icon: Building2,
                who: "For owners",
                title: "List in minutes. Pay nothing to list.",
                points: ["Post a room or flat with photos", "Get enquiries in-app, with notifications", "See views and enquiries per listing", "No agent between you and your tenant"],
                image: "/landing/photos/flat-living-blue.jpg",
                cta: { href: "/sign-in", label: "List your property" },
              },
            ].map((side) => (
              <article
                key={side.who}
                className="group relative flex min-h-[440px] flex-col justify-end overflow-hidden rounded-[28px] bg-navy p-8 text-white transition-[flex-grow] duration-700 ease-out sm:p-10 lg:flex-1 lg:hover:flex-[1.5]"
              >
                <Image src={side.image} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/10" />
                <div className="relative">
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-white/80">
                    <side.icon size={16} aria-hidden /> {side.who}
                  </p>
                  <h3 className="mt-3 max-w-md font-display text-[2rem] font-bold leading-tight tracking-tight">{side.title}</h3>
                  <ul className="mt-5 space-y-2">
                    {side.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 font-medium text-white/85">
                        <Check size={16} className="shrink-0 text-primary-tint" aria-hidden /> {p}
                      </li>
                    ))}
                  </ul>
                  <a href={side.cta.href} className="press mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-navy hover:bg-cream">
                    {side.cta.label} <ArrowRight size={17} aria-hidden />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Final CTA */}
      <section id="waitlist" data-cta className="scroll-mt-24 px-3 pb-10 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-navy">
          <div data-cta-photo className="absolute inset-0">
            <Image src="/landing/photos/room-bright-bed.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/90 to-navy/50" />
          <div className="relative grid grid-cols-1 gap-12 px-6 py-20 sm:px-12 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <h2 className="font-display text-[clamp(2.6rem,6vw,5.4rem)] font-bold leading-[0.96] tracking-[-0.045em] text-white">
                Your next room is closer than you think.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/75">
                GHOR opens in Guwahati first. Join the list and we&apos;ll tell you the day checked homes go live — no spam, just that.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="px-5 pb-12 pt-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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

// An interactive slice of the product: chips really filter the example cards.
function DiscoverySection() {
  const [type, setType] = useState<"room" | "flat" | null>(null);
  const [under10, setUnder10] = useState(false);
  const [furnished, setFurnished] = useState(false);
  const shown = EXAMPLES.filter((e) => (!type || e.type === type) && (!under10 || e.rent < 10000) && (!furnished || e.furnished));

  const chip = (active: boolean) =>
    `press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors ${
      active ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-navy/10 hover:ring-navy/30"
    }`;

  return (
    <section id="discover" data-demo className="scroll-mt-24 bg-white px-5 py-20 sm:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-3xl font-display text-[clamp(2.2rem,4.6vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.035em] text-navy">
            Where are you looking?
          </h2>
          <p className="max-w-sm text-lg leading-7 text-body/75">This is what searching on GHOR feels like. Try the filters.</p>
        </div>

        <div className="mt-12 rounded-[28px] bg-cream p-4 ring-1 ring-navy/[0.07] sm:p-6">
          <div className="flex h-14 items-center gap-3 rounded-2xl bg-white pl-5 pr-2 ring-1 ring-navy/[0.08]">
            <Search size={19} className="text-navy" aria-hidden />
            <span className="flex-1 font-semibold text-navy">Guwahati</span>
            <span className="hidden text-sm text-muted sm:inline">{shown.length} example{shown.length === 1 ? "" : "s"}</span>
            <span className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">Search</span>
          </div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            <button className={chip(type === "room")} aria-pressed={type === "room"} onClick={() => setType(type === "room" ? null : "room")}>
              <Home size={15} aria-hidden /> Room
            </button>
            <button className={chip(type === "flat")} aria-pressed={type === "flat"} onClick={() => setType(type === "flat" ? null : "flat")}>
              <Building2 size={15} aria-hidden /> Flat
            </button>
            <button className={chip(under10)} aria-pressed={under10} onClick={() => setUnder10(!under10)}>Under ₹10k</button>
            <button className={chip(furnished)} aria-pressed={furnished} onClick={() => setFurnished(!furnished)}>Furnished</button>
            {(type || under10 || furnished) && (
              <button onClick={() => { setType(null); setUnder10(false); setFurnished(false); }} className="inline-flex h-10 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-primary">
                <X size={14} aria-hidden /> Clear
              </button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((e) => (
              <article key={e.id} data-demo-card className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={e.img} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-success-deep shadow-sm">
                    <ShieldCheck size={13} aria-hidden /> Approved
                  </span>
                  <div className="absolute bottom-3 left-3 flex gap-1.5">
                    <span className="rounded-md bg-navy px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">{e.type}</span>
                    <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-navy">{e.avail}</span>
                  </div>
                </div>
                <p className="mt-3.5 font-display text-[1.375rem] font-bold leading-none tracking-[-0.02em] text-navy">
                  {rupees(e.rent)}<span className="text-sm font-medium text-muted">/month</span>
                </p>
                <p className="mt-2 font-semibold text-ink">{e.title}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin size={14} className="text-primary" aria-hidden /> {e.locality}, Guwahati
                </p>
                <p className="mt-1.5 text-[13px] text-body">{e.tags.join(" · ")}</p>
              </article>
            ))}
            {!shown.length && (
              <p className="col-span-full py-10 text-center text-muted">No examples match — clear a filter.</p>
            )}
          </div>
          <p className="mt-6 text-center text-xs text-muted">Example listings with illustrative photos. Real Guwahati homes appear here when GHOR opens.</p>
        </div>
      </div>
    </section>
  );
}
