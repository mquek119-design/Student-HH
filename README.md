# Grub (HouseGrocer)

A web app for UK university shared houses to plan meals together, build one
optimised weekly Tesco shop, and split the cost per item — not equally.

See `CLAUDE.md` for the product, architecture and the rules the codebase runs
on. This file is just setup and day-to-day commands.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS · Supabase
(Postgres + Auth + Realtime) · Vercel

## Setup

1. `npm install`
2. Create a Supabase project, then run `supabase/migrations/0001_initial_schema.sql`
   through the latest migration in the SQL editor, in order.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and key.
4. In Supabase → Authentication → URL Configuration, set the Site URL and add
   `http://localhost:3002/auth/callback` to Redirect URLs, or magic links
   bounce.
5. `npm run dev` — the app runs at `http://localhost:3002`.

Without a working `.env.local`, the app renders a legible `<SetupRequired>`
screen instead of crashing — that's deliberate, see CLAUDE.md.

Full detail, including the demo-data seeder and known migration gotchas, is
under "Connecting Supabase" in `CLAUDE.md`.

## Commands

```bash
npm run dev        # http://localhost:3002
npm run verify     # typecheck + lint + build — run this before saying anything is done
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # jest — money/optimiser/units unit tests
npm run e2e          # playwright
```

## Deploying

No deployed environment exists yet. The app is a standard Next.js App Router
project, so a Vercel deploy needs:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` on older Supabase projects) set as
  environment variables
- the Supabase Site URL and redirect URLs updated to the production domain
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` only if push notifications are wired up later
  (currently unset — the subscribe flow no-ops without it)

Never put a `service_role` / `sb_secret_…` key in a `NEXT_PUBLIC_` variable —
those bypass Row Level Security.

## Testing

`npm test` runs the unit suite (money arithmetic, the optimiser, unit
conversions — see CLAUDE.md's "seams worth knowing" for why these matter).
`npm run e2e` runs Playwright against a running dev server. There's also a
Playwright MCP server registered in `.mcp.json` for driving a real browser
from Claude Code — see CLAUDE.md's "Local Development & Testing" section.
