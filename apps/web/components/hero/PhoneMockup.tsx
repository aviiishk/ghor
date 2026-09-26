"use client";

import { motion } from "framer-motion";
import {
  Home,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Send,
  Signal,
  Sparkles,
  Wifi
} from "lucide-react";

export function PhoneMockup() {
  return (
    <>
      <CompactProductPreview />
      <div className="relative mx-auto hidden h-[600px] w-full max-w-[620px] overflow-visible md:block lg:h-[650px]">
      <div className="absolute inset-x-0 bottom-16 hidden h-72 rounded-[50%] bg-[radial-gradient(circle,rgba(37,99,235,0.16),transparent_68%)] blur-xl sm:block" />
      <div className="absolute -right-16 top-5 hidden h-72 w-72 rounded-full bg-brand-100/55 blur-3xl sm:block" />
      <div className="absolute left-6 top-24 hidden h-40 w-40 rounded-full bg-sky-100/80 blur-3xl sm:block" />

      <Cloud className="left-[18%] top-[12%] hidden sm:block" />
      <Cloud className="right-[11%] top-[24%] hidden scale-75 opacity-70 sm:block" />
      <Sparkles className="absolute left-[28%] top-[32%] hidden size-5 text-brand-300 sm:block" />
      <Sparkles className="absolute right-[3%] top-[37%] hidden size-5 text-brand-300 sm:block" />
      <Sparkles className="absolute left-[14%] top-[48%] hidden size-4 text-brand-300 sm:block" />

      <RouteLine />
      <FloatingPin className="right-[7%] top-[18%] sm:right-0 sm:top-[24%] lg:right-1" delay={0.2} size="large" />
      <FloatingPin className="hidden left-[8%] bottom-[30%] sm:left-[13%] sm:grid" delay={1.1} size="small" />

      <CitySkyline />

      <div className="absolute bottom-8 left-1/2 h-7 w-[220px] -translate-x-1/2 rounded-full bg-slate-900/10 blur-lg sm:bottom-4 sm:h-12 sm:w-[480px] sm:bg-slate-900/18 sm:blur-2xl" />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-4 z-20 w-[340px] -translate-x-1/2 rotate-[8deg] lg:top-2 lg:w-[380px] xl:w-[405px]"
      >
        <div className="relative rounded-[44px] bg-gradient-to-br from-slate-700 via-slate-950 to-black p-[6px] shadow-[0_18px_45px_rgba(15,23,42,0.22)] sm:rounded-[58px] sm:p-2 sm:shadow-[0_35px_95px_rgba(15,23,42,0.32)]">
          <div className="absolute -right-[7px] top-[118px] h-16 w-[5px] rounded-r-md bg-slate-700 shadow-inner sm:-right-2 sm:h-20" />
          <div className="absolute -left-[6px] top-[94px] h-10 w-[4px] rounded-l-md bg-slate-800 sm:-left-2" />
          <div className="absolute -left-[6px] top-[150px] h-14 w-[4px] rounded-l-md bg-slate-800 sm:-left-2 sm:h-16" />

          <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-white sm:rounded-[49px]">
            <div className="absolute left-1/2 top-3 z-20 h-[18px] w-[68px] -translate-x-1/2 rounded-full bg-black shadow-inner sm:top-4 sm:h-[25px] sm:w-[105px]" />
            <div className="absolute left-0 right-0 top-0 z-10 flex h-11 items-center justify-between px-6 pt-2 text-[9px] font-semibold text-slate-950 sm:h-16 sm:px-9 sm:text-xs">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <Signal className="size-3 sm:size-4" />
                <Wifi className="size-3 sm:size-4" />
                <span className="h-2.5 w-4 rounded-[3px] border border-slate-900 after:ml-[2px] after:block after:h-1.5 after:w-2.5 after:rounded-[2px] after:bg-slate-900 sm:h-3 sm:w-5 sm:after:h-2 sm:after:w-3" />
              </div>
            </div>

            <div className="flex h-[610px] flex-col bg-white px-6 pb-5 pt-[76px] lg:h-[640px]">
              <div className="mb-5 flex shrink-0 items-center justify-between">
                <PhoneLogo />
                <button
                  type="button"
                  aria-label="Open menu"
                  className="grid size-8 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              </div>

              <RoomCard />

              <div className="mt-6 flex-1 space-y-5">
                <ChatMessage
                  side="owner"
                  text="Hi, the room is available."
                  time="10:30 AM"
                />
                <ChatMessage
                  side="user"
                  text="Can I schedule a visit tomorrow?"
                  time="10:31 AM"
                />
                <ChatMessage side="owner" text="Yes, 11AM works." time="10:32 AM" />
                <ChatMessage side="user" text="Perfect." time="10:32 AM" compact />
              </div>

              <div className="mt-5 flex shrink-0 items-center gap-2 rounded-full border border-[#E5E7EB] bg-slate-50 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <button
                  type="button"
                  aria-label="Attach file"
                  className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-primary"
                >
                  <Paperclip className="size-4" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-400">
                  Type a message...
                </span>
                <button
                  type="button"
                  aria-label="Send message"
                  className="grid size-9 place-items-center rounded-full bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[#1D4ED8]"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
}

function CompactProductPreview() {
  return (
    <div className="mx-auto w-[280px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)] md:hidden">
      <div className="mb-4 flex items-center justify-between">
        <PhoneLogo />
        <MoreHorizontal className="size-5 text-slate-500" />
      </div>
      <RoomCard />
      <div className="mt-4 space-y-3">
        <ChatMessage side="owner" text="Hi, the room is available." time="10:30 AM" />
        <ChatMessage side="user" text="Can I schedule a visit tomorrow?" time="10:31 AM" />
      </div>
    </div>
  );
}

function PhoneLogo() {
  return (
    <div className="flex items-center gap-1 text-lg font-[750] leading-none text-[#0F172A] md:text-2xl">
      GH
      <span className="grid size-5 place-items-center rounded-full bg-[#2563EB] text-white sm:size-6">
        <Home className="size-3 sm:size-3.5" />
      </span>
      R
    </div>
  );
}

function RoomCard() {
  return (
    <div className="relative z-10 flex shrink-0 gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_10px_22px_rgba(15,23,42,0.08)] md:gap-3 md:p-3 md:shadow-[0_12px_28px_rgba(15,23,42,0.09)]">
      <RoomThumbnail />
      <div className="min-w-0 flex-1 py-0.5 md:py-1">
        <h3 className="truncate text-[11px] font-semibold text-[#0F172A] md:text-sm">
          Single Room in Beltola
        </h3>
        <p className="mt-0.5 text-[11px] font-semibold text-[#2563EB] md:mt-1 md:text-sm">
          Rs. 5,000 / month
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-[9px] font-medium text-slate-500 md:mt-2 md:text-xs">
          <MapPin className="size-3 shrink-0" />
          Beltola, Guwahati
        </p>
      </div>
    </div>
  );
}

function RoomThumbnail() {
  return (
    <div
      aria-label="Room thumbnail illustration"
      className="relative h-[52px] w-[66px] shrink-0 overflow-hidden rounded-xl bg-[#eef4ff] md:h-[70px] md:w-[88px]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#e0ecff_48%,#c7d2fe_100%)]" />
      <div className="absolute right-1.5 top-1.5 h-7 w-4 rounded-sm border border-slate-300 bg-gradient-to-b from-sky-100 to-white sm:right-2 sm:top-2 sm:h-10 sm:w-6" />
      <div className="absolute left-1.5 top-4 h-7 w-11 rounded-md bg-white shadow-sm sm:left-2 sm:top-6 sm:h-9 sm:w-14" />
      <div className="absolute left-2 top-6 h-3.5 w-9 rounded bg-[#d7b99d] sm:left-3 sm:top-9 sm:h-5 sm:w-12" />
      <div className="absolute bottom-1.5 left-1 h-3.5 w-14 skew-x-[-12deg] rounded-sm bg-[#9ca3af]/55 sm:bottom-2 sm:left-1.5 sm:h-5 sm:w-[72px]" />
      <div className="absolute left-1 top-2 h-8 w-1.5 rounded-full bg-[#6b7280]/30" />
      <div className="absolute right-0 top-0 h-full w-4 bg-white/28" />
    </div>
  );
}

function ChatMessage({
  side,
  text,
  time,
  compact = false
}: {
  side: "owner" | "user";
  text: string;
  time: string;
  compact?: boolean;
}) {
  const isUser = side === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[86%] gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {!isUser ? <OwnerAvatar /> : null}
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div
            className={`rounded-[18px] px-3 py-1.5 text-[10px] font-semibold leading-4 md:px-4 md:py-2.5 md:text-xs ${
              compact ? "max-w-[90px]" : "max-w-[235px]"
            } ${
              isUser
                ? "rounded-br-md bg-[#2563EB] text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]"
                : "rounded-bl-md bg-[#F3F4F6] text-[#0F172A]"
            }`}
          >
            {text}
          </div>
          <span className="mt-0.5 text-[8px] font-medium text-slate-400 sm:mt-1 sm:text-[10px]">
            {time}
            {isUser ? "  ✓✓" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function OwnerAvatar() {
  return (
    <div className="relative mt-1 size-7 shrink-0 overflow-hidden rounded-full border border-white bg-[#fde7cf] shadow-sm sm:size-8">
      <div className="absolute left-1/2 top-1 size-3.5 -translate-x-1/2 rounded-full bg-[#8b5e3c] sm:size-4" />
      <div className="absolute left-1/2 top-4 h-5 w-7 -translate-x-1/2 rounded-t-full bg-[#1f2937] sm:top-5 sm:w-8" />
      <div className="absolute left-[8px] top-[9px] h-1.5 w-1 rounded-full bg-[#111827] sm:left-[10px]" />
      <div className="absolute right-[8px] top-[9px] h-1.5 w-1 rounded-full bg-[#111827] sm:right-[10px]" />
    </div>
  );
}

function FloatingPin({
  className,
  delay,
  size
}: {
  className: string;
  delay: number;
  size: "small" | "large";
}) {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay }}
      className={`absolute z-0 grid rounded-full bg-[#2563EB] text-white shadow-[0_16px_36px_rgba(37,99,235,0.32)] ${
        size === "large" ? "size-12 place-items-center sm:size-14" : "size-10 place-items-center sm:size-11"
      } ${className}`}
    >
      <Home className={size === "large" ? "size-6" : "size-5"} />
    </motion.div>
  );
}

function RouteLine() {
  return (
    <svg
      className="absolute right-[-52px] top-[70px] h-[220px] w-[220px] text-brand-300 sm:right-[-26px] sm:top-[112px] sm:h-[320px] sm:w-[320px]"
      viewBox="0 0 320 320"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M300 20C235 35 222 80 214 122C204 176 155 180 105 190C58 199 36 230 28 292"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="8 12"
      />
    </svg>
  );
}

function CitySkyline() {
  const towers = [
    "left-[2%] h-24 w-10",
    "left-[11%] h-36 w-12",
    "left-[22%] h-28 w-8",
    "left-[31%] h-44 w-14",
    "left-[45%] h-32 w-10",
    "right-[31%] h-52 w-16",
    "right-[19%] h-36 w-11",
    "right-[7%] h-28 w-9"
  ];

  return (
    <div className="absolute inset-x-0 bottom-20 hidden h-64 overflow-hidden opacity-75 sm:block">
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-100/80 to-transparent" />
      {towers.map((tower) => (
        <div
          key={tower}
          className={`absolute bottom-0 rounded-t-[14px] bg-gradient-to-t from-brand-100 to-brand-50 ${tower}`}
        >
          <div className="absolute -top-6 left-1/2 h-7 w-4 -translate-x-1/2 rounded-t-full bg-brand-50" />
          <div className="absolute inset-x-2 top-8 grid grid-cols-2 gap-1 opacity-60">
            {Array.from({ length: 8 }).map((_, index) => (
              <span key={index} className="h-2 rounded-sm bg-white/70" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Cloud({ className }: { className: string }) {
  return (
    <div className={`absolute h-7 w-12 text-brand-100 ${className}`} aria-hidden="true">
      <div className="absolute bottom-0 left-1 h-4 w-10 rounded-full bg-current" />
      <div className="absolute bottom-2 left-4 size-6 rounded-full bg-current" />
      <div className="absolute bottom-1 left-0 size-5 rounded-full bg-current" />
    </div>
  );
}
