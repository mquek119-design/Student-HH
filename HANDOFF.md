# HouseGrocer — Handoff

**Read `CLAUDE.md` first.** It is the authoritative description of the product, the
stack, the design tokens and the rules. This file only covers *where things stand*
and *what to do next*.

---

## 30-second context

A Next.js 14 (App Router) + TypeScript + Tailwind + Supabase web app for UK student
shared houses: plan meals together → one optimised Tesco shop → split the cost
**per item**, not equally.

The core claim is the **overlap optimiser**: two housemates each needing 300 g of
pasta buy one 500 g pack between them, not two. That is where the savings come from,
and it is built and unit-tested.

Everything runs locally on **http://localhost:3002** (`npm run dev`). There is no
deployed environment.

---

## State

`npm run typecheck` and `npm run build` are both clean. **Nothing is committed yet —
133 uncommitted files, no git history.** Consider an initial commit before changing
anything, so there is something to diff against.

### Working end to end

- **Auth** — Supabase magic link. `/login` → `/auth/callback` → session.
- **Onboarding** — `create_house` / `join_house` SQL functions, invite codes.
- **Recipes** — creation at `/recipes/new`; ingredients parsed one per line
  (`500 g Penne pasta`) with a live preview of what was understood.
- **Plan** — `addMealToPlan`, `leaveMeal`, `saveConstraints` are real writes.
  Picking a recipe a housemate already chose **joins their meal** rather than
  creating a second one. That overlap is the entire product; do not "fix" it.
- **Optimiser** (`src/lib/optimiser.ts`) — scales recipes to actual diner count,
  aggregates ingredients across meals, subtracts pantry stock, rounds up to whole
  packs, attributes each line back to the people whose meals needed it.
- **Tesco pricing** (`src/lib/tescoResolver.ts` + `src/lib/packParsing.ts`) —
  resolves each ingredient to a real product via Tesco search. **Search is
  unauthenticated**; only add-to-basket and checkout need a session.
- **Split** — computed from real basket allocations, with the arithmetic printed
  under every line.

### Not built

- **Tesco add-to-basket and checkout.** `lib/tesco/` is vendored and has the code,
  but nothing calls it. This is the biggest remaining gap.
- **Local-state controls that never persist**: basket quantity steppers, own-brand
  toggle, substitution accept/reject, "I've Paid", pantry used-up. They are
  deliberately shaped so the setters become server actions.
- **Recipe scraping** from a URL. The card on `/recipes` says so plainly.

---

## Do this first

The database is a **brand-new, empty Supabase project** (the previous one was
deleted after being in the wrong region — see Performance below). All four
migrations are applied and RLS is verified, but there are **no users and no data**.

1. Confirm **Authentication → URL Configuration** in Supabase:
   - Site URL `http://localhost:3002`
   - Redirect URLs include `http://localhost:3002/auth/callback`
   - This does not carry over between projects and silently breaks magic links.
2. `npm run dev`, sign in at `/login`, create a house.
3. Add 2–3 real recipes with **overlapping ingredients** (e.g. two pasta dishes).
   The overlap is what makes the optimiser demonstrable.
4. Plan meals on different days.
5. `/basket` → **Build basket**.

Step 5 has **never been run against a live database.** It is the first real test of
the Tesco pricing path. Expect to debug it. Check specifically:

- Do ingredients resolve to sensible products? (`ingredients.tesco_title`)
- Are `pack_size` / `pack_price` written back? If not, the RLS `ingredients_update`
  policy from migration `0004` is the first suspect — its absence was a real bug.
- Does the reported overlap saving match hand arithmetic?

---

## Then, in order

1. **Convert the remaining local-state controls to server actions.** Same pattern as
   `src/app/plan/actions.ts`. Basket steppers and "I've Paid" are the ones users
   will notice losing.
2. **Tesco add-to-basket + checkout.** Read `lib/tesco/providers/tesco/index.ts`
   and `auth.ts` first. Auth is the hard part: Akamai blocks automated login, so the
   working path is manual browser login → Cookie Editor export → `import-session`,
   once a week by the collector. `checkout()` deliberately stops at the payment URL —
   a human finishes 3-D Secure. **The app must never touch card details.**
3. **Supabase Realtime** for live basket/payment updates.
4. **Recipe scraping.**

---

## Landmines

Each of these cost real debugging time. They are not hypothetical.

### `src/lib/supabase/database.types.ts`

Hand-maintained. Break either rule and supabase-js types **every query result as
`never[]`** with no error pointing anywhere near the cause:

- Row types must be `type X = {…}`, **never** `interface X {…}`. TypeScript gives
  type aliases an implicit index signature and withholds one from interfaces, so an
  interface fails supabase-js's `Record<string, unknown>` constraint.
- Empty groups must be `{ [_ in never]: never }`, **never** `Record<string, never>`.
  The latter has a string index signature, so the query parser finds every table
  name in `Views` and resolves it to `never`.

Prefer regenerating: `npx supabase gen types typescript --project-id <ref>`.

Also: keep `@supabase/ssr` **≥ 0.12**. Version 0.5.x passes generics to
`SupabaseClient` in an order `supabase-js` ≥ 2.111 no longer uses — same `never`
symptom, different cause.

### Migrations

The Supabase SQL editor runs a whole file **in one transaction**, so one failing
statement silently discards the entire file. You get no tables and no obvious error
unless you scroll.

The known offender is `create trigger … on auth.users` — managed projects do not
grant ownership of `auth.users`. `0001` now wraps it in a `DO` block that catches
the error. Profiles are created by `getCurrentUserOrNull()` on first sign-in instead,
so the trigger is optional.

`supabase/reset.sql` drops everything if a partial run needs clearing (dev only).

### Do not

- **Do not reintroduce fixtures.** `mockData.ts` was deleted deliberately. Every
  screen reads real rows or renders an empty state. In a money app an invented
  figure is worse than a blank panel — the whole product rests on housemates
  trusting the split. If a number cannot be derived, say so.
- **Do not edit `lib/tesco/`.** Vendored from a private fork; treat as a dependency.
- **Do not remove the `cache()` wrappers** in `src/lib/queries.ts`. They dedupe
  per-request round trips; without them a page made ~10 redundant auth calls.
- **Do not run `npm run build` while the dev server is running.** They share `.next`
  and every static asset 404s. Symptom: unstyled page. Fix: `rm -rf .next`, restart.

### Environment quirks

- `tailwind.config.ts` changes need a **dev server restart**; HMR misses them.
- A `bg-*` utility on `<body>` beats any `@layer base` rule. The mint background is
  `bg-surface-0` on the element in `layout.tsx` for this reason.
- Stale dev servers squat on ports. If you see `EADDRINUSE`, kill the listener on
  3002 rather than letting Next drift to another port — the Supabase redirect URL
  is pinned to 3002.

---

## Performance

Do **not** reach for hosting as a performance fix. Two real causes were found and
fixed; both were code and configuration, not infrastructure.

1. **Query waterfall.** Every `getCurrentUser()` bottoms out in
   `supabase.auth.getUser()`, which is a *network round trip*, not a local token
   decode. Pages made ~10 of them. Fixed with React `cache()`, by dropping a
   redundant `profiles` lookup from middleware, and by fetching `ingredients` once
   per request instead of three times.
2. **Supabase region.** The original project's origin round trip was ~210 ms. After
   moving to a nearer region it is ~55 ms — roughly 4× on *every* query. Measure
   with `curl -w "ttfb=%{time_starttransfer}"`; if `time_appconnect` is low but
   TTFB is high, the edge is near and the origin is far.

There is still a genuinely sequential 7-hop chain in `getWeeklyPlan`
(auth → profiles → houses → planned_meals → meal_participants → recipes →
recipe_ingredients). Collapsing hops with PostgREST embedded selects
(`profiles?select=*,houses(*)`) is the remaining win, worth ~2 hops.

---

## Verification habits worth keeping

- **Look at it in a browser.** Playwright MCP is configured in `.mcp.json`
  (headless, isolated, 375×812). A wrong body background survived every build and
  typecheck and was only visible on screen.
- **Validate SQL before asking someone to run it.** `pg-query-emscripten` parses
  with the real Postgres parser; `parsePlpgsql` also compiles `$$…$$` bodies, which
  plain parsing skips.
- **Test money arithmetic numerically.** `src/lib/optimiser.ts` has 17 checks behind
  it covering pooling, pantry credit, unit merging and penny-exact attribution.
  Anything touching pence deserves the same.
