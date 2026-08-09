/**
 * LOCAL ADDITION — see lib/tesco/VENDOR-CHANGES.md
 *
 * Playwright's `addCookies` accepts `sameSite` values of exactly "Strict",
 * "Lax" or "None" and throws on anything else:
 *
 *   browserContext.addCookies: cookies[0].sameSite: expected one of (Strict|Lax|None)
 *
 * Sessions imported from Cookie Editor (the documented way to get a Tesco
 * session past Akamai) do not use those spellings — a real export here held
 * `null`, `no_restriction`, `lax` and `strict`. Every browser fallback in this
 * package therefore threw on the first cookie, and because those fallbacks sit
 * behind a `catch`, the real failure surfaced as a confusing cookie error
 * instead of whatever went wrong upstream.
 */

type LooseCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string | null;
  [key: string]: unknown;
};

export type PlaywrightCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
};

const SAME_SITE: Record<string, 'Strict' | 'Lax' | 'None'> = {
  strict: 'Strict',
  lax: 'Lax',
  none: 'None',
  no_restriction: 'None',
  unspecified: 'Lax',
};

export function normaliseCookies(cookies: LooseCookie[] = []): PlaywrightCookie[] {
  return cookies
    .filter((cookie) => cookie && cookie.name && cookie.value !== undefined)
    .map((cookie) => {
      const raw = String(cookie.sameSite ?? '').toLowerCase();
      // Default to Lax, which is what browsers themselves assume when a cookie
      // arrives without the attribute.
      const sameSite = SAME_SITE[raw] ?? 'Lax';

      const normalised: PlaywrightCookie = {
        name: cookie.name,
        value: String(cookie.value),
        domain: cookie.domain,
        path: cookie.path || '/',
        httpOnly: Boolean(cookie.httpOnly),
        // SameSite=None is only valid on a Secure cookie; Playwright rejects
        // the combination otherwise.
        secure: sameSite === 'None' ? true : Boolean(cookie.secure),
        sameSite,
      };

      // Session cookies carry no expiry. -1 is Playwright's "session cookie";
      // passing a stale or bogus timestamp silently drops them.
      if (typeof cookie.expires === 'number' && cookie.expires > 0) {
        normalised.expires = cookie.expires;
      }

      return normalised;
    });
}
