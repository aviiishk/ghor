import { Home } from "lucide-react";

// The GHOR wordmark — the "O" is a house in a GHOR-blue disc (matches the approved
// mockups in /assets). Deliberately NOT a link: callers wrap it in <Link> where it should
// navigate. It used to render its own <a href="#">, which nested an <a> inside every
// <Link> that wrapped it and broke hydration (found 2026-09-26).
export function Logo({ size = "md", tone = "ink" }: { size?: "sm" | "md"; tone?: "ink" | "white" }) {
  const text = size === "sm" ? "text-xl" : "text-[1.6rem] md:text-[1.75rem]";
  const disc = size === "sm" ? "size-[1.15rem]" : "size-[1.45rem] md:size-[1.6rem]";
  const icon = size === "sm" ? "size-2.5" : "size-3.5";
  return (
    <span
      role="img"
      aria-label="GHOR"
      className={`inline-flex items-center font-display font-extrabold leading-none tracking-[-0.03em] ${text} ${tone === "white" ? "text-white" : "text-navy"}`}
    >
      GH
      <span className={`mx-[0.04em] inline-grid place-items-center rounded-full bg-primary text-white ${disc}`}>
        <Home className={icon} strokeWidth={2.75} aria-hidden="true" />
      </span>
      R
    </span>
  );
}
