import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/config';

/** Routes reachable while signed out. */
const PUBLIC_PREFIXES = ['/welcome', '/login', '/auth', '/onboarding'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // With no database there is nothing any page can render, and every one of
  // them would throw on its first query. Send them all to /setup instead —
  // this must happen here, before page components execute.
  if (!isSupabaseConfigured) {
    if (pathname === '/setup') return NextResponse.next();
    const target = request.nextUrl.clone();
    target.pathname = '/setup';
    target.search = '';
    return NextResponse.redirect(target);
  }

  // Configured: /setup has nothing left to say.
  if (pathname === '/setup') {
    const target = request.nextUrl.clone();
    target.pathname = '/';
    target.search = '';
    return NextResponse.redirect(target);
  }

  let response = NextResponse.next({ request });

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
    },
  };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieMethods,
  });

  // getUser() revalidates against the auth server and refreshes the session
  // cookie. Do not swap this for getSession(), which trusts the cookie as-is.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const target = request.nextUrl.clone();
    // The bare root is the front door: a signed-out visitor there wants to be
    // sold to, not shown a login form. Deep links still go to /login with a
    // `next`, so nothing that needed auth is lost on the way.
    if (pathname === '/') {
      target.pathname = '/welcome';
      target.search = '';
    } else {
      target.pathname = '/login';
      target.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(target);
  }

  if (user && pathname === '/login') {
    const target = request.nextUrl.clone();
    target.pathname = '/';
    target.search = '';
    return NextResponse.redirect(target);
  }

  // A signed-in user with no house is redirected to onboarding by the pages
  // themselves (`if (!currentUser.houseId) redirect('/onboarding')`).
  //
  // Doing it here as well cost a `profiles` round trip on EVERY request —
  // ~250ms against a remote Supabase region, on navigations, server actions and
  // data requests alike — to answer a question the page already answers from
  // data it has to load anyway.

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
