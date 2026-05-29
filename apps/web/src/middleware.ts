import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Handle icon requests for PWA and browser auto-discovery.
 * Catches /icon-NNN.*, /apple-icon-NNN.*, /android-icon-NNN.* etc.
 * and rewrites them to the existing static icon files.
 */
const ICON_PATTERN = /^\/(icon|apple-icon|android-icon)(-\d+x?\d*)?\.(svg|png|ico)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = ICON_PATTERN.exec(pathname);

  if (match) {
    const ext = pathname.endsWith('.svg') ? 'svg' : 'png';
    const normalized = `/icon-192.${ext}`;
    const url = request.nextUrl.clone();
    url.pathname = normalized;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Apply to static file requests for icon patterns
export const config = {
  matcher: '/((?!api|_next|trpc).*)',
};
