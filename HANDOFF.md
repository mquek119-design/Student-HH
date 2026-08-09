# HouseGrocer — Status & Handoff

**Read `CLAUDE.md` first** for the product, stack and rules. This file covers
where things stand and who should do what next.

---

## State

Next.js 14 + TypeScript + Tailwind + Supabase, running at **http://localhost:3002**
(`npm run dev`). No deployed environment.

`npm run typecheck`, `npm run lint` and `npm run build` are all clean.

### Working end to end

- **Auth** — Supabase magic link; profile auto-created on first sign-in.
- **Onboarding** — `create_house` / `join_house`, invite codes.
- **Recipes** — creation with one-ingredient-per-line parsing and a live preview.
- **Plan** — real writes. Picking a recipe a housemate already chose *joins their
  meal* rather than duplicating it. That overlap is the product; don't "fix" it.
- **Optimiser** (`src/lib/optimiser.ts`) — scales to diner count, pools
  ingredients across meals, subtracts pantry, rounds to whole packs, attributes
  each line by participation. 17 numeric checks behind it.
- **Tesco pricing** — `search` is **unauthenticated**; ingredients resolve to real
  products with real prices, pack sizes and images, cached on `ingredients` with
  a 7-day TTL.
- **Slots** — delivery *and* Click & Collect, verified live (166 and 52 available).
  Optional house preference suggests a best match; the collector always selects.
  The fee becomes a split line divided equally, penny-exact.
- **Split** — computed from real allocations, arithmetic printed under each line.
- **Server actions** — basket, pantry, payment, reconciliation all persist.
- **Realtime** — live house-wide updates.

### Not built

- `bookSlot()` reserving with Tesco is **coded but never executed** — nobody has
  booked a real delivery. Everything else in the slot flow is verified.
- Recipe scraping from a URL.
- Anything beyond a dry-run checkout preview. `checkout()` stops at the payment
  URL by design; a human finishes 3-D Secure. **The app never touches card details.**

### Migrations

`0001`–`0010`. All applied except **`0010_slot_preferences.sql`** — run it.
`supabase/reset.sql` is a destructive dev-only clean slate.

---

## For Gemini: UI and brand identity — yes, with guardrails

Based on the previous batch of work, this is a good fit. Visual work is bounded,
mistakes are self-evident on screen, and nothing here can silently corrupt money.

### Do

- Apply the new brand identity: colours, typography, spacing, iconography.
- Update `tailwind.config.ts` tokens and the components under
  `src/components/ui/`, `src/components/nav/`, `src/components/avatars/`.
- Improve layout, responsiveness and empty states.
- Keep to tokens (`text-on-surface-variant`, `bg-primary-container`) rather than
  raw hex, so a future rebrand is one file.

### Rules that will bite if ignored

1. **Look at it in a browser.** Playwright MCP is configured in `.mcp.json`
   (headless, 375×812). A wrong `<body>` background once survived every build and
   typecheck and was only caught on screen. Green CI is not evidence a UI change
   worked.
2. **`tailwind.config.ts` changes need a dev server restart.** HMR misses them.
3. **A `bg-*` utility on `<body>` beats any `@layer base` rule.** The mint
   background is `bg-surface-0` on the element in `layout.tsx` for this reason.
4. **Never run `npm run build` while the dev server is running** — they share
   `.next` and every asset 404s. Symptom: unstyled page. Fix: `rm -rf .next`,
   restart.
5. **Run `npm run lint`.** It is configured with `no-unused-vars` as an *error*,
   which catches the "component imported but never rendered" mistake that made a
   whole feature invisible while the build stayed green.

### Do not touch

- `src/lib/optimiser.ts`, `money.ts`, `units.ts`, `packParsing.ts`,
  `slotMatching.ts` — money and pack arithmetic, each with numeric tests.
- `src/lib/queries.ts` — the `cache()` wrappers exist for a reason; removing them
  restores a ~10-round-trip waterfall per page.
- `supabase/migrations/**` — schema and RLS.
- `lib/tesco/**` — vendored. If it must change, record it in
  `lib/tesco/VENDOR-CHANGES.md` or re-vendoring silently discards the change.

### Two habits worth adopting

- **Don't report success from a failed operation.** A previous seeder logged an
  RLS rejection and still returned "seeded successfully!". In an app about
  splitting money, a false success is worse than an error.
- **Verify against the live thing, not the code.** Two migrations were written
  but never applied; the code wrote to columns that did not exist, the update
  failed silently, and prices never appeared. One `curl` would have shown it.

---

## What to start on next (bigger calls — worth doing with review)

1. **Book a real slot.** `chooseSlot()` saves the choice and calls `bookSlot()`.
   Listing and pricing are verified; reserving is not. Do it once, deliberately.
2. **Reconciliation against a real delivery.** The money rules are implemented
   (unreceived refunds, partial quantities, substitutions charged at the
   substitute's price) but have never met an actual Tesco order.
3. **Decide on per-house product choice.** `ingredients` is a global catalogue,
   so pack price and product are shared across houses. Fine while everyone wants
   cheapest; the moment two houses want different products for "milk" it needs a
   `house_ingredient_products` table. The trade-off is written into
   `0004_tesco_product_cache.sql`.
4. **Deploy.** Only after the weekly cycle works end to end — deploying earlier
   hides bugs behind "it's the network".

---

## Performance notes

Two real causes were found and fixed; neither was hosting.

- **Query waterfall.** `getCurrentUser()` bottoms out in `auth.getUser()`, a
  network round trip. Pages made ~10. Fixed with React `cache()`, dropping a
  redundant middleware `profiles` lookup, and fetching `ingredients` once per
  request instead of three times.
- **Supabase region.** Origin round trip went from ~210 ms to ~55 ms after moving
  region. Diagnose with `curl -w "ttfb=%{time_starttransfer}"`: low
  `time_appconnect` with high TTFB means the edge is near and the origin is far.

A genuinely sequential 7-hop chain remains in `getWeeklyPlan`. Collapsing hops
with PostgREST embedded selects (`profiles?select=*,houses(*)`) is the remaining
win, worth ~2 hops.
