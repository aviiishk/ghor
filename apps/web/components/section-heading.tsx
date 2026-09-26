import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
};

export function SectionHeading({ eyebrow, title, children }: SectionHeadingProps) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-[34px] font-[720] leading-[1.12] tracking-normal text-ink md:text-[44px] lg:text-[50px]">
        {title}
      </h2>
      {children ? (
        <p className="mt-4 text-base font-medium leading-7 text-muted md:text-[18px] md:leading-8">
          {children}
        </p>
      ) : null}
    </Reveal>
  );
}
