import { features } from "@/lib/data";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

export function Features() {
  return (
    <section id="features" className="bg-surface py-20 md:py-28">
      <div className="container-page">
        <SectionHeading title="Why People Need GHOR">
          Built for the exact friction of finding rooms, PGs, and responsive owners in Guwahati.
        </SectionHeading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              transition={{ delay: index * 0.04, duration: 0.5 }}
              className="group rounded-2xl border border-hairline bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary-light text-primary transition group-hover:bg-primary group-hover:text-on-primary">
                <feature.icon className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-ink">{feature.title}</h3>
              <p className="mt-3 text-base font-medium leading-7 text-muted">{feature.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
