import { Button } from "@/components/button";
import { Reveal } from "@/components/reveal";

export function FinalCta() {
  return (
    <section className="bg-white py-20 md:py-28">
      <Reveal className="container-page text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[38px] font-[720] leading-[1.12] tracking-normal text-ink md:text-[54px]">
            Stop Calling 50 Owners For One Room.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg font-medium leading-8 text-muted">
            Join the waitlist and get early access before GHOR opens to everyone in Guwahati.
          </p>
          <div className="mt-8">
            <Button href="#waitlist">Reserve Your Spot</Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
