"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, BarChart3, FileClock, Flag, Gauge, Inbox, LogOut, Settings2, Shield, ShieldCheck, Users, UserCog } from "lucide-react";
import { api } from "@/lib/client/api";
import { useCan, useMe } from "@/components/providers";

// Navigation mirrors the API permission map so admins don't see dead ends. It is only
// presentation — hiding a link protects nothing; the API authorizes every request.
const NAV = [
  { href: "/", label: "Overview", icon: Gauge, permission: "listings.review" },
  { href: "/moderation", label: "Moderation", icon: Inbox, permission: "listings.review" },
  { href: "/reports", label: "Reports", icon: Flag, permission: "reports.review" },
  { href: "/users", label: "Users", icon: Users, permission: "users.view" },
  { href: "/trust", label: "Verification status", icon: ShieldCheck, permission: "verification.view" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "listings.review" },
  { href: "/audit", label: "Audit log", icon: FileClock, permission: "audit.view" },
  { href: "/system", label: "System health", icon: Activity, permission: "system.health.view" },
  { href: "/admin-users", label: "Admin users", icon: UserCog, permission: "admin.manage" },
  { href: "/config", label: "Configuration", icon: Settings2, permission: "configuration.manage" },
  { href: "/security", label: "My security", icon: Shield, permission: null }
] as const;

const ROLE_LABEL: Record<string, string> = { admin: "Admin", senior_reviewer: "Senior reviewer", super_admin: "Super admin" };

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const can = useCan();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/sign-in");
  }

  return (
    <div className="flex min-h-[calc(100vh-24px)] flex-col md:flex-row">
      <aside className="border-b border-hairline bg-navy text-white md:w-60 md:shrink-0 md:border-b-0">
        <div className="px-5 py-4">
          <p className="font-display text-lg font-bold">GHOR <span className="font-semibold text-white/60">Admin</span></p>
          {me && (
            <p className="mt-1 text-xs text-white/70">
              {me.name ?? "Admin"} · {ROLE_LABEL[me.role]}
              {me.seniorCapability ? " + senior" : ""}
            </p>
          )}
        </div>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.filter((n) => n.permission === null || can(n.permission)).map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`}
              >
                <Icon size={16} aria-hidden /> {n.label}
              </Link>
            );
          })}
          <button onClick={signOut} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium text-white/75 hover:bg-white/10">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
