"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Logo } from "@/components/logo";

const navItems = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Waitlist", href: "#waitlist" }
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-2 md:pt-4">
      <nav
        className={`container-page flex h-[72px] items-center justify-between rounded-2xl border px-4 transition duration-300 md:h-16 md:px-6 ${
          scrolled
            ? "border-hairline bg-white/86 shadow-soft backdrop-blur-xl"
            : "border-transparent bg-white/70 backdrop-blur-xl"
        }`}
        aria-label="Primary navigation"
      >
        <Logo />
        <div className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-ink transition hover:text-primary"
            >
              {item.label}
            </a>
          ))}
          <a
            href="/sign-in"
            className="text-sm font-semibold text-ink transition hover:text-primary"
          >
            Sign In
          </a>
        </div>
        <Button href="#waitlist" className="hidden md:inline-flex">
          Join Waitlist
        </Button>
        <Button href="/sign-in" className="min-h-11 px-5 md:hidden" aria-label="Sign In">
          Sign In
        </Button>
      </nav>
    </header>
  );
}
