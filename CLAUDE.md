# HouseGrocer

## What This Is

A web app for UK university shared houses to plan meals together, build one optimised weekly shop, add it to Tesco's online basket, and split costs per item — not equally.

The core insight: the buying unit is the household (3–5 students), not the individual. One combined order clears Tesco's £25 click-and-collect / £50 delivery minimum that a solo student can't hit. The ingredient-overlap optimiser cuts waste and cost by reusing ingredients across multiple meals.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres + Auth + Realtime) — *clients wired, schema not yet live*
- **Deployment**: Vercel
- **Tesco integration**: to be vendored into `lib/tesco/` — a private fork of uk-grocery-cli. **Not yet present in this repo.**

## Current State

UI complete, schema and auth written, `npm run build` clean (20 routes + middleware).

### There is no demo data. This is deliberate.

`mockData.ts` has been **deleted**. Every screen reads real rows or renders an empty state — nothing invents a number, and a house with no data looks empty rather than pretending otherwise. In a money app the fabricated figures were the dangerous kind: an invented savings benchmark and a split whose "workings" didn't compute from anything.

Without `.env.local`, `layout.tsx` renders `<SetupRequired>` instead of the app. That is a legible setup screen, not a crash. **Do not reintroduce fixtures to make screens look populated.**

Everything derived is derived for real:
- `getCurrentSplit()` sums the caller's actual share of each basket line via `allocateLine()`; the workings printed on the Split page are that arithmetic, item by item
- `getSavings()` counts only own-brand deltas (`original_unit_price − unit_price`), because that is the one saving we can evidence. There is **no** bulk/pantry breakdown and **no** comparison against other households — we have no data on other houses
- Conflicts are computed in `conflicts.ts`, not stored
- `PayPanel` shows the collector's own `payment_details_text` verbatim, or says they haven't set any

Done:
- Postgres schema + RLS (`supabase/migrations/`), seed (`supabase/seed.sql`, optional)
- Magic-link auth: middleware, `/login`, `/auth/callback`, `create_house` / `join_house`
- **Recipe creation** (`/recipes/new`) — ingredients parsed one per line, `500 g Penne pasta`
- **Plan mutations are real writes**: `addMealToPlan`, `leaveMeal`, `saveConstraints`. Picking a recipe a housemate already chose *joins their meal* rather than creating a second one — that overlap is the entire point
- Plans are created lazily; the first person to add a meal brings the week into existence

Not done:
- **No `lib/tesco/`.** Checkout, product search and add-to-basket are UI-only.
- **No optimiser.** Nothing writes `basket_items` yet, so the Basket, Split and Reconciliation screens will sit on their empty states until it exists. This is now the single biggest gap.
- **Basket, reconciliation and pantry controls are still local state.** Steppers, substitution accept/reject and "I've Paid" update React state and are lost on reload. They are shaped so the setters become server actions.
- **No recipe scraping.** The URL import card on `/recipes` says so plainly.

## Connecting Supabase

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_initial_schema.sql` then `0002_rls.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
4. Set the Site URL and add `http://localhost:3000/auth/callback` to Redirect URLs (Authentication → URL Configuration), or magic links will bounce.
5. Optional: create four users, paste their UUIDs into the top of `supabase/seed.sql`, and run it to get the demo house.
6. **Regenerate the types** — do not hand-edit them:
   ```
   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
   ```

### Why the migration can appear to do nothing

The SQL editor runs a whole file in **one transaction**, so any single failing statement silently discards all 38 — you get zero tables and no obvious error unless you scroll.

The known offender is `create trigger … on auth.users`. Managed Supabase projects give `auth.users` to `supabase_auth_admin`, so the editor's `postgres` role is refused with *"must be owner of relation users"*. `0001` now wraps that trigger in a `DO` block that catches the error and carries on; profiles are instead created by `getCurrentUserOrNull()` on first sign-in, so the trigger is optional.

If a re-run fails with "already exists", an earlier attempt landed partially — run `supabase/reset.sql` first (destructive, dev only).

Verify from the shell without a password:
```
curl -s "$URL/rest/v1/houses?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
`PGRST205 … not found in the schema cache` means the table is missing (or, rarely, the cache is stale — `NOTIFY pgrst, 'reload schema';` rules that out).

### API key naming

Newer projects issue `sb_publishable_…` instead of an `anon` JWT. `supabase/config.ts` accepts either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are browser-safe. Never put a `sb_secret_…` / `service_role` key in a `NEXT_PUBLIC_` var — those bypass RLS.

### Two traps in `database.types.ts`

Both make supabase-js silently type every query result as `never[]`, with no error pointing at the cause. If you must hand-edit:

- **Row types must be `type X = {…}`, never `interface X {…}`.** supabase-js constrains rows to `Record<string, unknown>`; TypeScript grants type aliases an implicit index signature but withholds one from interfaces. Cost an hour of debugging.
- **Empty groups must be `{ [_ in never]: never }`, never `Record<string, never>`.** The latter has a string index signature, so the select-query parser finds every table name in `Views` and resolves it to `never`.

Also keep `@supabase/ssr` ≥ 0.12 — 0.5.x passes generics to `SupabaseClient` in an order `supabase-js` ≥ 2.111 no longer uses, with the same `never` symptom.

## Project Structure

```
Student HH/
├── CLAUDE.md                   # This file — read first
├── mockups/                    # 20 per-screen folders (see below)
│   └── housegrocer/DESIGN.md   # Design token spec — source of truth for styling
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Fonts + AppChrome wrapper
│   │   ├── page.tsx            # Feed (tab 1)
│   │   ├── plan/               # Fancy? + plan grid (tab 2)
│   │   ├── basket/             # Basket review (tab 3)
│   │   ├── split/              # layout + page, /balances, /reconcile (tab 4)
│   │   ├── recipes/            # Hub + [id] detail — entered from Plan
│   │   ├── pantry/             # Shared + personal pantry — entered from Plan
│   │   ├── settings/           # House settings
│   │   ├── account/            # My account + /savings
│   │   └── onboarding/         # Welcome, create, join, invite (no tab bar)
│   ├── components/
│   │   ├── nav/                # AppChrome, TopAppBar, BottomNav, tabs.ts
│   │   ├── ui/                 # Card, Badge, PageShell, PageHeader, SubTabs
│   │   ├── avatars/            # Avatar, AvatarStack (initials-based)
│   │   ├── media/              # Icon (Material Symbols), FoodImage placeholder
│   │   ├── feed/ plan/ basket/ split/ recipes/ settings/ cards/ timers/
│   └── lib/
│       ├── types.ts            # Core data model
│       ├── money.ts            # Pence formatting + remainder-safe splitting
│       ├── queries.ts          # THE data seam — swap mock for Supabase here
│       ├── mockData.ts         # Fixtures
│       ├── clsx.ts
│       └── supabase/           # client.ts (browser), server.ts (RSC/actions)
└── tailwind.config.ts          # Tokens ported from DESIGN.md
```

## Navigation — Four Tabs

Decided deliberately; the mockups were inconsistent (some showed six tabs, some four). Everything remains reachable:

| Tab | What lives here |
|---|---|
| **Feed** | Home, countdown, payment status, nudge |
| **Plan** | "What do you fancy?" input on top, plan grid below; recipes and pantry reached from the planning flow |
| **Basket** | Basket review, own-brand toggle, proceed to checkout |
| **Split** | This week's split, balances/ledger, delivery reconciliation |

`src/components/nav/tabs.ts` maps route prefixes to tabs via an `owns` array, so `/recipes/r-tacos` keeps **Plan** highlighted. Add new routes to an existing tab's `owns` list rather than adding a fifth tab.

Onboarding renders without chrome — `AppChrome` checks the pathname and drops the bars under `/onboarding`.

## Design Reference

`mockups/` holds **20 per-screen folders**, each with `code.html` (a complete standalone Tailwind mockup) and `screen.png`. The HTML is the useful artifact — it is real markup, and **9 of the 20 PNGs are broken 28-byte placeholders** (`<FIFE Image failed to fetch>`): house_feed, house_pantry, my_account, order_reconciliation_1, order_reconciliation_2, recipe_detail, recipes_hub_1, savings_history, the_basket.

`order_reconciliation_1` has **no `code.html` and a broken PNG** — there is no usable reference for it. The reconciliation screen was built from `order_reconciliation_2` plus the requirements below.

### Visual identity — from `mockups/housegrocer/DESIGN.md`

The tokens in DESIGN.md are the source of truth and are ported verbatim into `tailwind.config.ts`. An earlier draft of this file quoted a different palette (`#00703C` green, `#F27D21` orange); **that was wrong** — use the tokens.

- **Primary green**: `#006b3f` (`primary`), `#008751` (`primary-container`)
- **Accent orange**: `#994700` (`secondary`), `#fb7800` (`secondary-container`)
- **Body background**: `#F0F9F4` — the `surface-0` token, applied as `bg-surface-0` on `<body>` in `layout.tsx`. It must be a utility on the element, not a rule in `globals.css`: any `bg-*` class on `<body>` beats an `@layer base` declaration, which silently left the app on `#f9f9fc` for a while. The `background` token is a separate, paler colour — don't reach for it on `<body>`.
- **Cards**: `surface-container-lowest` white, 1px `surface-container-highest` border, `shadow-ambient-card`
- **Type**: **Plus Jakarta Sans** for text, **JetBrains Mono** (`font-numeric-data`, `font-label-caps`) for all money, quantities, dates and timers — columns of numbers must align
- **Mobile-first**: 375px viewport. The mockups are also fully responsive with `md:` breakpoints and a desktop top-nav — that is built, not a stretch goal.

**borderRadius caveat**: DESIGN.md's `rounded` frontmatter block and the scale the mockups actually rendered with disagree. `tailwind.config.ts` follows the mockups (`DEFAULT` 0.25rem / `lg` 0.5rem / `xl` 0.75rem), because the ported markup assumes `rounded-xl` on a card means 12px.

### Imagery

The mockups referenced `lh3.googleusercontent.com/aida-public/…` URLs which are temporary and will 404. **Do not reintroduce them.** Instead:

- Housemates → `<Avatar>` renders coloured initials from the DESIGN.md palette
- Food/products → `<FoodImage>` renders a deterministic tinted tile, and passes through a real `src` when one exists

## Local Development & Testing

Everything is tested on localhost. There is no deployed environment yet.

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

### Browser testing via Playwright MCP

`.mcp.json` registers [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) as a project-scoped server, so Claude Code can drive a real browser against localhost and verify screens itself rather than asserting on raw HTML.

Configured as: headless, isolated profile (nothing persists between runs), Chromium, **375x812 viewport** to match the mobile-first target. Use `browser_resize` to check the `md:` breakpoints — the desktop layout is real and worth checking at ~1280 wide.

Screenshots and traces land in `.playwright-mcp/` (gitignored).

Start the dev server **before** driving the browser — the MCP server will not start it for you.

## Tesco Integration (not yet vendored)

When `lib/tesco/` lands:

- **Do not modify anything in `lib/tesco/`.** Treat it as a vendored dependency.
- **Do not call the CLI from the web app.** Wrap the provider's TypeScript functions in API routes / server actions.
- Custom fork modifications to preserve: reliable add-to-basket without bot detection, single-tab browsing, default best-match product selection.
- **Auth caveat**: Akamai bot detection blocks automated login. Reliable path is manual browser login → Cookie Editor export → `import-session`. The collector authenticates manually once a week.
- **Checkout is safe**: `checkout()` stops at the payment URL. A human finishes 3-D Secure. The app never touches card details.
- `next.config.js` already marks `playwright`/`playwright-core` as server-external so they never reach the client or edge bundle.

## Core Data Model

See `src/lib/types.ts` — it is the authoritative version and matches this:

```
House · User · Ingredient · Recipe · RecipeIngredient
WeeklyPlan · PlannedMeal · MealParticipant · PlanConflict
BasketItem (with Allocation[]) · Split (with SplitLine[]) · LedgerEntry
PantryItem · Substitution · ReconciliationItem
```

`PlanConflict` was not in the original spec — it came from the `the_house_plan_integrated` mockup, which shows a "Conflict Detected" state when two housemates pick incompatible meals on the same day, with the forfeited savings quantified.

## Weekly Cycle

1. **Sunday**: Housemates open "What do you fancy?" and submit recipes / constraints / opt-outs
2. **Cutoff** (Sunday 17:00 by default): Planning locks; the optimiser builds the basket
3. **Basket review**: Collector reviews, swaps to own-brand, adjusts quantities
4. **Order placed**: Collector places the Tesco order from their account
5. **Delivery**: Reconciliation page shows substitutions and refunds
6. **Settlement**: Per-item split posted; housemates pay the collector directly; collector confirms

## Key Design Decisions

- **No custody of funds.** The app never holds money — it calculates and displays. Settlement happens by bank transfer / Revolut. Keeps us outside FCA regulation.
- **"I've Paid" is social, not verified.** Display who's outstanding prominently; social pressure is the enforcement mechanism.
- **One person's Tesco account.** The collector rotates weekly. The Basket checkout button is disabled for everyone except the collector.
- **Substitution reconciliation is mandatory.** The receipt never matches the plan. `src/components/split/Reconciliation.tsx` implements the money rules: unreceived items refund fully; partial deliveries charge received quantity only; accepted substitutions charge the substitute's price (which may exceed the ordered price); rejected substitutions charge nothing.
- **All money in integer pence.** `splitPence()` in `money.ts` distributes remainder pence to the largest fractional shares, so a 3-way split of 100p is 34/33/33 and never loses a penny.
- **Show the arithmetic.** The Split page prints the workings under every line. An opaque split is the fastest way to lose trust in a shared house.

## Coding Conventions

- Server components by default; `'use client'` only where interactivity requires it
- Tesco calls go through server actions or API routes — never expose session/auth to the client
- All monetary values in pence (integers), displayed via `formatPence()`
- Component files PascalCase; utility files camelCase
- Keep pages thin — data fetching in the page, logic in `lib/`, interactivity in components
- Reach for the tokens (`text-on-surface-variant`, `bg-primary-container`) over raw hex

## Build Order — Remaining

1. Connect a Supabase project and verify the schema against a real database — the migrations have never been executed
2. The overlap optimiser: aggregate ingredients across planned meals, subtract the pantry, allocate pack sizes, and write `basket_items` + `basket_allocations`. Everything downstream (Basket, Split, Reconciliation, Savings) is empty until this exists
3. Convert the remaining local-state controls to server actions: basket steppers, substitution decisions, "I've Paid", pantry used-up
4. Vendor `lib/tesco/`, wrap in API routes, wire product search and real prices
5. Supabase Realtime for live basket and payment updates
6. Recipe scraping

## A Rule Worth Keeping

When a figure cannot be derived, show an empty state saying so — never a placeholder that looks like data. The whole product rests on housemates trusting the split; one invented number seen through costs more than a blank panel ever will.

## What NOT to Build Yet

- Multi-supermarket support — Tesco only for MVP
- Native mobile app — responsive web is sufficient
- Push notifications — in-app banners and the countdown timer
- AI recipe recommendations — manual input first
- Open-banking payment verification — too expensive at this stage
