import { ArrowRight, Play } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ButtonProps = ComponentPropsWithoutRef<"a"> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
  icon?: "arrow" | "play";
};

export function Button({
  children,
  className = "",
  variant = "primary",
  icon = "arrow",
  ...props
}: ButtonProps) {
  const Icon = icon === "play" ? Play : ArrowRight;
  const styles =
    variant === "primary"
      ? "bg-primary text-on-primary shadow-glow hover:bg-primary-pressed"
      : "border border-hairline bg-canvas text-ink shadow-sm hover:border-brand-100 hover:bg-primary-light";

  return (
    <a
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-focus-ring ${styles} ${className}`}
      {...props}
    >
      {icon === "play" ? <Icon className="size-4 fill-current" /> : null}
      <span>{children}</span>
      {icon === "arrow" ? (
        <span className="grid size-6 place-items-center rounded-full bg-white/18 transition group-hover:translate-x-0.5">
          <Icon className="size-4" />
        </span>
      ) : null}
    </a>
  );
}
