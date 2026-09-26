import { steps } from "@/lib/data";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 md:py-28">
      <div className="container-page">
        <SectionHeading title="How GHOR Works">
          A cleaner path from first search to final visit, without the endless call list.
        </SectionHeading>
        <div className="relative grid gap-5 lg:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-12 hidden h-px bg-hairline lg:block" />
          {steps.map((step, index) => (
            <Reveal
              key={step.title}
              transition={{ delay: index * 0.08, duration: 0.55 }}
              className="relative rounded-2xl border border-hairline bg-white p-7 shadow-sm"
            >
              <div className="mb-7 grid size-16 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-on-primary shadow-glow">
                {index + 1}
              </div>
              <h3 className="font-display text-[23px] font-[720] leading-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-base font-medium leading-7 text-muted">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
