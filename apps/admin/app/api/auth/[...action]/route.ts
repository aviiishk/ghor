import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { callApi, forbiddenCrossOrigin, isSameOrigin, relay } from "@/lib/server/api";
import {
  clearAllAdminCookies,
  clearCookie,
  readCookie,
  setBreakGlassCookie,
  setPreCookie,
  setSessionCookies
} from "@/lib/server/session";

// Admin sign-in BFF. Every token the API issues (pre-MFA, break-glass, access, refresh)
// is put into an httpOnly cookie here and never returned to browser JavaScript (D-47).
// Only non-secret results (which MFA step is next, the enrollment QR, recovery codes that
// must be shown once) are passed through.

type Ctx = { params: Promise<{ action: string[] }> };

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const post = (b: unknown) => ({ method: "POST", body: JSON.stringify(b ?? {}) });

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const action = (await ctx.params).action.join("/");
  const input = await body(req);

  switch (action) {
    case "otp/send": {
      return relay(await callApi(req, "/admin/auth/otp/send", post({ phone: input.phone }), "none"));
    }

    case "otp/verify": {
      const res = await callApi(req, "/admin/auth/otp/verify", post({ phone: input.phone, code: input.code }), "none");
      if (!res.ok) return relay(res);
      const data = (await res.json()) as { mfa?: string; preToken?: string; breakGlassToken?: string };
      await clearAllAdminCookies();
      if (data.preToken) await setPreCookie(data.preToken);
      if (data.breakGlassToken) await setBreakGlassCookie(data.breakGlassToken);
      return NextResponse.json({ mfa: data.mfa ?? null, breakGlassAvailable: !!data.breakGlassToken });
    }

    case "break-glass": {
      const token = await readCookie("breakGlass");
      if (!token) return NextResponse.json({ message: "Break-glass session expired" }, { status: 401 });
      const res = await callApi(req, "/admin/auth/break-glass", post({ breakGlassToken: token }), "none");
      await clearCookie("breakGlass");
      if (!res.ok) return relay(res);
      const data = (await res.json()) as { mfa: string; preToken: string };
      await setPreCookie(data.preToken);
      return NextResponse.json({ mfa: data.mfa });
    }

    case "totp/enroll": {
      const res = await callApi(req, "/admin/auth/totp/enroll", post({}), "pre");
      if (!res.ok) return relay(res);
      const data = (await res.json()) as { otpauthUri: string; secret: string };
      // QR rendered here (server-side) — no third-party QR service ever sees the secret.
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUri, { margin: 1, width: 220 });
      return NextResponse.json({ qrDataUrl, secret: data.secret });
    }

    case "totp/confirm": {
      const res = await callApi(req, "/admin/auth/totp/enroll/confirm", post({ code: input.code }), "pre");
      if (!res.ok) return relay(res);
      const data = (await res.json()) as { accessToken: string; refreshToken: string; recoveryCodes: string[] };
      await setSessionCookies(data);
      // Shown exactly once by the enrollment page; never stored by this app.
      return NextResponse.json({ recoveryCodes: data.recoveryCodes });
    }

    case "totp/verify": {
      const res = await callApi(req, "/admin/auth/totp/verify", post({ code: input.code }), "pre");
      if (!res.ok) return relay(res);
      await setSessionCookies((await res.json()) as { accessToken: string; refreshToken: string });
      return NextResponse.json({ ok: true });
    }

    case "recovery": {
      return relay(await callApi(req, "/admin/auth/recovery/verify", post({ recoveryCode: input.recoveryCode }), "pre"));
    }

    case "step-up": {
      return relay(await callApi(req, "/admin/auth/step-up", post({ code: input.code }), "session"));
    }

    case "recovery/regenerate": {
      return relay(await callApi(req, "/admin/auth/recovery/regenerate", post({}), "session"));
    }

    case "logout": {
      await callApi(req, "/admin/auth/logout", post({}), "session").catch(() => null);
      await clearAllAdminCookies();
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const action = (await ctx.params).action.join("/");
  if (action === "me") return relay(await callApi(req, "/admin/auth/me", { method: "GET" }, "session"));
  if (action === "sessions") return relay(await callApi(req, "/admin/auth/sessions", { method: "GET" }, "session"));
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();
  const [kind, id] = (await ctx.params).action;
  if (kind === "sessions" && id && /^[0-9a-f-]{36}$/i.test(id)) {
    return relay(await callApi(req, `/admin/auth/sessions/${id}`, { method: "DELETE" }, "session"));
  }
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
