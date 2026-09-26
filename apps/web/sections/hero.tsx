"use client";

import { motion } from "framer-motion";
import { Home, Star } from "lucide-react";
import { Button } from "@/components/button";
import { PhoneMockup } from "@/components/hero/PhoneMockup";

const avatars = ["AD", "RB", "MS", "NK"];

export function Hero() {
  return (
    <section className="hero-curve relative overflow-x-hidden pt-[110px] md:pt-36">
      <div className="absolute left-[-120px] top-28 hidden h-72 w-72 rounded-full border border-brand-100/70 sm:block" />
      <div className="absolute left-[-90px] top-36 hidden h-52 w-52 rounded-full border border-brand-100/70 sm:block" />
      <div className="absolute right-[36%] top-24 hidden h-24 w-40 rounded-full bg-white/70 blur-2xl lg:block" />
      <div className="container-page grid items-center gap-0 pb-8 md:gap-14 md:pb-20 lg:grid-cols-[0.92fr_1.08fr] lg:pb-24">
        <motion.div
          className="text-center md:text-left"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/78 px-3 py-2 text-xs font-semibold text-primary shadow-sm ring-1 ring-brand-100 backdrop-blur md:mb-7 md:px-4 md:text-sm">
            <Home className="size-4" />
            Guwahati&apos;s Future Room Finding App
          </div>

          <h1 className="mx-auto max-w-[330px] overflow-visible font-display text-[56px] font-bold leading-[0.95] tracking-normal text-ink md:hidden">
            Finding a room
            <br />
            in Guwahati
            <br />
            shouldn&apos;t take
            <br />
            <span className="blue-text-gradient italic">50 calls.</span>
          </h1>

          <h1 className="hidden max-w-[700px] font-display text-[64px] font-[600] leading-[1.03] tracking-normal text-ink md:block lg:text-[72px] xl:text-[78px]">
            Finding a room in Guwahati shouldn&apos;t take{" "}
            <span className="blue-text-gradient italic">50 calls.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-[95%] text-base font-medium leading-[1.6] text-muted md:mx-0 md:mt-6 md:max-w-xl md:text-lg md:leading-8">
            GHOR helps students and professionals discover verified rooms and PGs, chat directly
            with owners, and move in faster.
          </p>

          <div className="mt-6 flex justify-center md:mt-8 md:justify-start">
            <Button href="#waitlist" className="h-14 w-full max-w-[320px] md:w-auto md:min-w-[185px]">
              Join Waitlist
            </Button>
          </div>

          <div className="mx-auto mt-5 flex max-w-[280px] flex-col items-center gap-2 md:mx-0 md:mt-8 md:max-w-none md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex justify-center -space-x-2 md:-space-x-3">
                {avatars.map((avatar, index) => (
                  <div
                    key={avatar}
                    className="grid size-8 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-slate-900 to-primary text-[10px] font-semibold text-white shadow-sm md:size-11 md:text-xs"
                    style={{ zIndex: avatars.length - index }}
                  >
                    {avatar}
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-0.5 text-amber-400 md:gap-1" aria-label="Five star trust rating">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-3.5 fill-current md:size-4" />
                ))}
              </div>
            </div>
            <p className="max-w-[260px] text-center text-xs font-semibold leading-5 text-muted md:max-w-xs md:text-left md:text-sm">
              Trusted by students and professionals across Guwahati.
            </p>
          </div>
        </motion.div>

        <div id="preview" className="mt-8 md:mt-0">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
