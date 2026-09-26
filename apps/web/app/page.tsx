import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FinalCta } from "@/sections/final-cta";
import { Footer } from "@/sections/footer";
import { Hero } from "@/sections/hero";
import { HowItWorks } from "@/sections/how-it-works";
import { Navbar } from "@/sections/navbar";
import { Waitlist } from "@/sections/waitlist";

export default async function Home() {
  // Someone who already has an account (a session cookie present, same check
  // middleware.ts uses) has no reason to land back on the pre-launch marketing page —
  // send them straight into the real product. First-time/signed-out visitors still see
  // the marketing page below, unchanged.
  const cookieStore = await cookies();
  if (cookieStore.get("ghor_at") || cookieStore.get("ghor_rt")) {
    redirect("/browse");
  }

  return (
    <main className="overflow-hidden bg-white">
      <Navbar />
      <Hero />
      <Waitlist />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </main>
  );
}
