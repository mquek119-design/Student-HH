/**
 * POST /api/tesco/import-session
 *
 * Accepts a Tesco session cookie JSON from the client and saves it to the database.
 * The collector can export cookies from their browser using Cookie-Editor or DevTools
 * and send them here to persist the session for checkout operations.
 *
 * Request body:
 * {
 *   cookiesJson: string // JSON array of cookies or { cookies: [...] }
 * }
 *
 * Response:
 * {
 *   status: 'success' | 'error',
 *   message: string,
 *   expiresAt?: string,
 *   authenticatedCookies?: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/queries';
import { inferSessionExpiry, type TescoSession } from '../../../../../lib/tesco/providers/tesco/auth';
import { saveTescoSessionToDb } from '@/lib/supabase/tescoSession';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json(
        { status: 'error', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!user.houseId) {
      return NextResponse.json(
        { status: 'error', message: 'User not in a house' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    if (!body.cookiesJson || typeof body.cookiesJson !== 'string') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing or invalid cookiesJson field',
        },
        { status: 400 }
      );
    }

    // Parse cookie JSON
    let cookies: any[];
    try {
      const parsed = JSON.parse(body.cookiesJson);
      cookies = Array.isArray(parsed) ? parsed : parsed.cookies;

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Invalid cookie data. Expected JSON array or { cookies: [...] }',
          },
          { status: 400 }
        );
      }
    } catch (parseErr: any) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Invalid JSON format: ${parseErr?.message}`,
        },
        { status: 400 }
      );
    }

    // Create and save session
    const session: TescoSession = {
      cookies,
      expiresAt: inferSessionExpiry(cookies),
      lastLogin: new Date().toISOString(),
    };

    await saveTescoSessionToDb(session);

    return NextResponse.json(
      {
        status: 'success',
        message: `Tesco session imported with ${cookies.length} cookies`,
        expiresAt: session.expiresAt,
        authenticatedCookies: cookies.length,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[tesco/import-session] Error:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err?.message || 'Failed to import Tesco session',
      },
      { status: 500 }
    );
  }
}
