import { Home } from "lucide-react";

export function Logo() {
  return (
    <a href="#" aria-label="GHOR home" className="flex items-center gap-2">
      <span className="font-display text-[1.6rem] font-[750] tracking-normal text-ink md:text-3xl">
        GH
      </span>
      <span className="grid size-7 place-items-center rounded-full bg-primary text-on-primary shadow-glow md:size-8">
        <Home className="size-3.5 md:size-4" aria-hidden="true" />
      </span>
      <span className="font-display text-[1.6rem] font-[750] tracking-normal text-ink md:text-3xl">
        R
      </span>
    </a>
  );
}
