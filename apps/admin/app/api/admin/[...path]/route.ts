import { NextResponse, type NextRequest } from "next/server";
import { callApi, forbiddenCrossOrigin, isSameOrigin, relay } from "@/lib/server/api";

// BFF proxy: browser → /api/admin/<path> → apps/api /admin/<path> with the session's
// admin-audience token attached server-side. Scope is deliberately narrow:
//  - only /admin/* on the API (never marketplace endpoints — admin tokens are refused
//    there anyway, and this proxy can't even address them);
//  - never /admin/auth/* (sign-in has its own handler that keeps tokens out of responses);
//  - authorization is NOT decided here. The API checks permission + step-up on every
//    call; this layer only transports.
const SEGMENT = /^[A-Za-z0-9_.-]+$/;

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const segments = (await ctx.params).path;
  if (!segments.length || segments[0] === "auth" || !segments.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const search = req.nextUrl.search;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const res = await callApi(req, `/admin/${segments.join("/")}${search}`, { method: req.method, body }, "session");
  return relay(res);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
