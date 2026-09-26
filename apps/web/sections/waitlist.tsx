"use client";

import { type FormEvent, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle,
  Home,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WaitlistApiResponse, WaitlistLead } from "@/types/waitlist";

const benefits = [
  "Early access",
  "Founding member badge",
  "Priority room alerts",
  "Direct owner messaging"
];

const trustItems = [
  { icon: Lock, label: "No spam ever" },
  { icon: Zap, label: "Early access guaranteed" },
  { icon: Trophy, label: "Founding member perks" }
];

const avatars = ["AD", "RB", "MS", "NK", "PB"];
const spotsClaimed = 37;

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 }
};

export function Waitlist() {
  const [formData, setFormData] = useState<WaitlistLead>({
    name: "",
    email: "",
    phone: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null);

  function showToast(type: "error" | "success", message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4500);
  }

  function validateForm() {
    const phoneDigits = formData.phone.replace(/\D/g, "");

    if (formData.name.trim().length < 2) {
      return "Name must be at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return "Please enter a valid email address.";
    }

    if (phoneDigits.length < 10) {
      return "Phone number must contain at least 10 digits.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      showToast("error", validationError);
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim()
        })
      });

      const rawResponse = await response.text();
      console.log("[Waitlist form response status]", response.status);
      console.log("[Waitlist form response raw body]", rawResponse);

      const data = JSON.parse(rawResponse) as WaitlistApiResponse;
      console.log("[Waitlist form parsed JSON]", data);
      console.log("[Waitlist form returned object]", data);

      if (!response.ok || !data.success) {
        showToast("error", data.message || "Something went wrong. Please try again.");
        return;
      }

      setIsSubmitted(true);
      showToast("success", "Spot reserved successfully.");
    } catch {
      showToast("error", "Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="waitlist" className="relative bg-white py-16 md:py-24">
      {toast ? (
        <div
          role="status"
          className={`fixed right-4 top-24 z-[60] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-soft ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        transition={{ staggerChildren: 0.08 }}
        className="container-page"
      >
        <div className="relative min-h-[550px] overflow-hidden rounded-[32px] border border-white/20 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.34),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(125,211,252,0.28),transparent_24%),linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#4338ca_100%)] p-5 text-white shadow-[0_36px_110px_rgba(29,78,216,0.32)] md:min-h-[620px] md:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
          <div className="pointer-events-none absolute -left-20 top-16 size-72 rounded-full bg-white/14 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-10 size-80 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent" />

          <FloatingDecor />

          <div className="relative z-10 grid min-h-[510px] gap-9 lg:grid-cols-[1fr_0.88fr] lg:items-center">
            <motion.div variants={fadeUp} className="max-w-2xl py-4 md:py-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/14 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl">
                <Zap className="size-4 fill-amber-300 text-amber-300" />
                Limited Founding Members
              </div>

              <h2 className="font-display mt-7 max-w-[650px] text-4xl font-[720] leading-[1.08] tracking-normal text-white sm:text-5xl md:text-[58px] lg:text-[64px]">
                Be One Of The First 100 Users In Guwahati
              </h2>

              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-blue-50 md:text-xl">
                Get priority access before launch, exclusive founding member perks, and early
                access to verified rooms.
              </p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex -space-x-3">
                  {avatars.map((avatar, index) => (
                    <div
                      key={avatar}
                      className="grid size-11 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-slate-950 to-blue-400 text-xs font-semibold text-white shadow-lg"
                      style={{ zIndex: avatars.length - index }}
                    >
                      {avatar}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-semibold text-blue-50">
                  <span className="text-white">+37 people</span> already joined this week
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mt-9 max-w-xl rounded-3xl border border-white/16 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-100">37 / 100 Spots Claimed</p>
                    <p className="mt-1 font-display text-3xl font-[720] text-white">
                      63 Spots Remaining
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#1D4ED8] shadow-sm">
                    37%
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/14 ring-1 ring-white/14">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "37%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.25 }}
                    className="h-full rounded-full bg-gradient-to-r from-white via-blue-100 to-cyan-200 shadow-[0_0_30px_rgba(255,255,255,0.85)]"
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3 rounded-full bg-white/[0.08] px-3 py-2 text-sm font-semibold text-blue-50 ring-1 ring-white/10">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/16 text-white ring-1 ring-white/18">
                      <Check className="size-4" />
                    </span>
                    {benefit}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="lg:justify-self-end">
              <form
                onSubmit={handleSubmit}
                className="relative overflow-hidden rounded-3xl border border-white bg-white p-6 text-[#0F172A] shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:p-10 lg:max-w-[470px]"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.12),transparent_70%)]" />
                <div className="pointer-events-none absolute -right-14 -top-14 size-36 rounded-full bg-blue-100/80 blur-3xl" />

                {isSubmitted ? (
                  <SuccessState />
                ) : (
                <div className="relative">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB]">
                    <ShieldCheck className="size-4" />
                    Launch Waitlist
                  </div>
                  <h3 className="font-display text-3xl font-[720] tracking-normal text-[#0F172A]">
                    Reserve Your Spot
                  </h3>
                  <p className="mt-3 text-base font-medium leading-7 text-[#64748B]">
                    Join the launch waitlist in under 30 seconds.
                  </p>

                  <div className="mt-8 grid gap-4">
                    <Field
                      icon={User}
                      label="Name"
                      type="text"
                      value={formData.name}
                      disabled={isSubmitting}
                      onChange={(value) => setFormData((current) => ({ ...current, name: value }))}
                    />
                    <Field
                      icon={Mail}
                      label="Email"
                      type="email"
                      value={formData.email}
                      disabled={isSubmitting}
                      onChange={(value) => setFormData((current) => ({ ...current, email: value }))}
                    />
                    <Field
                      icon={Phone}
                      label="Phone"
                      type="tel"
                      value={formData.phone}
                      disabled={isSubmitting}
                      onChange={(value) => setFormData((current) => ({ ...current, phone: value }))}
                    />
                  </div>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="group mt-6 flex h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#4338CA] px-6 text-base font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.34)] transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Submitting..." : "Reserve My Spot"}
                    {!isSubmitting ? (
                      <ArrowRight className="size-5 transition group-hover:translate-x-1" />
                    ) : null}
                  </motion.button>

                  <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    {trustItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 text-sm font-semibold text-[#334155]">
                        <span className="grid size-7 place-items-center rounded-full bg-white text-[#2563EB] shadow-sm">
                          <item.icon className="size-4" />
                        </span>
                        {item.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                    <p className="text-sm font-semibold text-[#2563EB]">Launching Soon In Guwahati</p>
                    <p className="mt-1 text-sm font-medium text-[#64748B]">
                      Only <span className="font-semibold text-[#0F172A]">63 spots</span> remain.
                    </p>
                  </div>
                </div>
                )}
              </form>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  value,
  disabled,
  onChange
}: {
  icon: LucideIcon;
  label: string;
  type: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="group relative block">
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-[#2563EB]" />
      <input
        required
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="h-[60px] w-full rounded-2xl border border-[#E2E8F0] bg-white px-14 text-base font-semibold text-[#0F172A] outline-none shadow-sm transition placeholder:text-slate-400 hover:border-blue-200 focus:border-[#2563EB] focus:shadow-[0_14px_32px_rgba(37,99,235,0.12)] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}

function SuccessState() {
  const successBenefits = ["Early Access", "Priority Alerts", "Founding Member Perks"];
  const confetti = [
    "left-[14%] top-[10%] bg-blue-300",
    "left-[28%] top-[4%] bg-cyan-300",
    "right-[18%] top-[12%] bg-indigo-300",
    "right-[10%] top-[28%] bg-blue-400",
    "left-[10%] bottom-[28%] bg-sky-300",
    "right-[24%] bottom-[16%] bg-indigo-400"
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 }
        }
      }}
      className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-white/80 p-5 text-center shadow-[0_24px_80px_rgba(37,99,235,0.16)] backdrop-blur-xl sm:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.18),transparent_48%)]" />
      <div className="pointer-events-none absolute -left-20 -top-20 size-44 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-44 rounded-full bg-indigo-200/45 blur-3xl" />

      {confetti.map((className, index) => (
        <motion.span
          key={className}
          initial={{ opacity: 0, scale: 0.3, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0.75], scale: [0.3, 1, 0.9], y: [-6, 10, 18], rotate: 120 }}
          transition={{ duration: 1.1, delay: index * 0.08, ease: "easeOut" }}
          className={`pointer-events-none absolute size-2 rounded-full ${className}`}
        />
      ))}

      <motion.div
        variants={{
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: "easeOut" } }
        }}
        className="relative mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#4338CA] text-white shadow-[0_18px_42px_rgba(37,99,235,0.38)]"
      >
        <CheckCircle className="size-10" />
      </motion.div>

      <motion.div variants={fadeUp} className="relative">
        <h3 className="mt-6 font-display text-4xl font-[720] tracking-normal text-[#0F172A]">
          {"\uD83C\uDF89"} Spot Reserved
        </h3>
        <p className="mx-auto mt-4 max-w-sm text-base font-medium leading-7 text-[#64748B]">
          You&apos;re officially on the GHOR waitlist. We&apos;ll notify you when verified rooms
          and PGs become available.
        </p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="relative mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#2563EB]"
      >
        <Zap className="size-4 fill-[#2563EB]" />
        Founding Member #{spotsClaimed + 1}
      </motion.div>

      <motion.div variants={fadeUp} className="relative mt-6 grid gap-3">
        {successBenefits.map((benefit) => (
          <div
            key={benefit}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/86 px-4 py-3 text-left text-sm font-semibold text-[#334155] shadow-sm"
          >
            <span className="grid size-7 place-items-center rounded-full bg-blue-50 text-[#2563EB]">
              <Check className="size-4" />
            </span>
            {benefit}
          </div>
        ))}
      </motion.div>

      <motion.p variants={fadeUp} className="relative mt-6 text-sm font-semibold text-[#64748B]">
        <span className="text-[#0F172A]">37+ people</span> joined this week
      </motion.p>

      <motion.div variants={fadeUp} className="relative mt-7 grid gap-3">
        <a
          href="https://chat.whatsapp.com/"
          target="_blank"
          rel="noreferrer"
          className="flex h-[58px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#4338CA] px-6 text-base font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          Join WhatsApp Community
        </a>
        <a
          href="#"
          className="text-sm font-semibold text-[#64748B] transition hover:text-[#2563EB]"
        >
          Back To Homepage
        </a>
      </motion.div>
    </motion.div>
  );
}
function FloatingDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [-8, -3, -8] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[44%] top-10 hidden rounded-2xl border border-white/16 bg-white/12 px-4 py-3 shadow-2xl backdrop-blur-xl lg:block"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/18">
            <Bell className="size-4 text-white" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white">Room alert ready</p>
            <p className="text-[10px] font-medium text-blue-100">Beltola, under Rs. 6k</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 14, 0], rotate: [7, 2, 7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -right-4 top-24 hidden rounded-2xl border border-white/16 bg-white/12 p-4 shadow-2xl backdrop-blur-xl md:block"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-[#2563EB]">
            <MapPin className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white">Guwahati launch</p>
            <p className="text-[10px] font-medium text-blue-100">100 founding users</p>
          </div>
        </div>
      </motion.div>

      <Sparkles className="absolute left-[44%] top-[35%] size-5 text-white/35" />
      <Home className="absolute bottom-[14%] right-[8%] size-16 rotate-12 text-white/10" />
    </div>
  );
}
