import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Landing } from "@/sections/landing/Landing";

export default async function Home() {
  // Someone who already has an account (a session cookie present, same check
  // middleware.ts uses) has no reason to land back on the pre-launch marketing page —
  // send them straight into the real product. First-time/signed-out visitors still see
  // the marketing page below, unchanged.
  const cookieStore = await cookies();
  if (cookieStore.get("ghor_at") || cookieStore.get("ghor_rt")) {
    redirect("/browse");
  }

  return <Landing />;
}
