import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow static assets, images, Next.js internal files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // Check auth session cookie
  const sessionCookie = request.cookies.get('lixfnet_session')?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie);
      if (parsed && parsed.username) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // 2. If unauthenticated, redirect ANY path to /login (absolute privacy & security)
  if (!isAuthenticated && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. If authenticated user navigates to /login, redirect into main portal
  if (isAuthenticated && pathname === '/login') {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
