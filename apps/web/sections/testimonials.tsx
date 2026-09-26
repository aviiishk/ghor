import { Quote } from "lucide-react";
import { testimonials } from "@/lib/data";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

export function Testimonials() {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="container-page">
        <SectionHeading title="Built For Guwahati">
          A focused product for students, professionals, and owners in one fast-moving city.
        </SectionHeading>
        <div className="grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Reveal
              key={testimonial.name}
              transition={{ delay: index * 0.08, duration: 0.55 }}
              className="rounded-2xl border border-hairline bg-white p-7 shadow-sm"
            >
              <Quote className="mb-8 size-8 text-primary" />
              <p className="text-lg font-bold leading-8 text-ink">&quot;{testimonial.quote}&quot;</p>
              <div className="mt-8 flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {testimonial.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{testimonial.name}</h3>
                  <p className="text-sm font-medium text-muted">{testimonial.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
