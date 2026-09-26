// Route protection for the "login required before browsing" product decision (root
// CLAUDE.md §2/§7.4), applied on web the same way apps/mobile's app/_layout.tsx auth
// gate applies it. This only checks cookie *presence*, not JWT validity — a stale/expired
// refresh cookie still gets past this gate and fails at the first /api/gateway call
// instead, same tradeoff apps/mobile accepts (see its _layout.tsx comment on there being
// no realtime "auth state changed" stream). Full signature verification here would need
// the JWT secret available to the Edge runtime, which isn't worth doing before that gap
// actually causes a problem.
import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'ghor_rt';

const PROTECTED_PREFIXES = [
  '/browse',
  '/listing',
  '/my-listings',
  '/chats',
  '/chat',
  '/profile',
  '/notifications',
  '/owner',
  '/onboarding',
  '/admin',
];
const SIGNED_OUT_ONLY_PREFIXES = ['/sign-in', '/verify-otp'];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  if (matches(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (matches(pathname, SIGNED_OUT_ONLY_PREFIXES) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/browse';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/browse/:path*',
    '/listing/:path*',
    '/my-listings/:path*',
    '/chats/:path*',
    '/chat/:path*',
    '/profile/:path*',
    '/notifications/:path*',
    '/owner/:path*',
    '/onboarding',
    '/admin',
    '/admin/:path*',
    '/sign-in',
    '/verify-otp',
  ],
};
