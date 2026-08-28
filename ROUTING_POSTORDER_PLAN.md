# Routing Redesign + Post-Order Flow Audit

**Objective**: Redesign landing page and signup flow; ensure post-order (ordered→delivered) journey is solid

**Status**: Planning  
**Timeline**: 2-3 days with parallel agents  
**Agents**: 3-4 concurrent

---

## Part A: Routing Redesign

### Goal
Make `/welcome` the true entry point for all users. Add "Why Grub" narrative. Clarify signup flow with dedicated pages.

### Changes

#### 1. Welcome Page Redesign (`src/app/welcome/page.tsx`)
**Current State**: Already has auth-aware CTAs, hero, marquee, benefits, steps.  
**Gaps**:
- Excessive horizontal centering (`max-w-5xl` limits content width unnecessarily)
- Missing "Why Grub" user-voice narrative section
- Layout could better use viewport width on desktop

**Changes**:
- Remove `max-w-5xl mx-auto` from outer container; use full-width with `px-margin-mobile md:px-margin-desktop`
- Add "Why Grub" section after marquee, before benefits (user narrative explaining the thesis)
- Keep hero narrower for readability, but let supporting content breathe
- Verify CTAs match Grub voice (already fixed in voice polish, should be fine)

**Definition of Done**:
- No excessive left/right whitespace on desktop (1440px)
- "Why Grub" section visible and engaging
- All CTAs working and styled correctly
- Mobile (375px) + tablet (768px) + desktop (1440px) responsive
- Build passes

---

#### 2. New Signup Flow Pages
**Goal**: Split signup into discrete, understandable steps.

**A. `/onboarding/signup/page.tsx` — Create Account**
- New user account creation (mirrors `/login` but creates instead of authenticating)
- Email + optional password / magic link flow
- Redirects to `/onboarding/instructions` on success
- Uses Supabase `auth.signUp()`

**B. `/onboarding/instructions/page.tsx` — How Grub Works**
- Static education page explaining the product flow
- "Why Grub" copy (can reuse from welcome redesign)
- "One house, one shop, split fair" thesis
- Three-step flow (pick, build, settle)
- "Next" button → `/onboarding` (house creation/join picker)
- Optional "Skip" for quick path

**Definition of Done**:
- Both pages created and wired together
- Signup → instructions → create → invite → feed flow works end-to-end
- All pages responsive at 375px/768px/1440px
- Build passes

---

#### 3. Middleware + Routing (Minor tweaks)
**Current**: Signed-out → `/welcome`, signed-in → `/`, signed-in to `/login` → `/`

**Proposed** (minimal change):
- Signed-out `/` → `/welcome` ✓ (already happens)
- Signed-in `/` → `/` (keep as-is, or optionally redirect to `/welcome` for value prop re-engagement)
- `/onboarding/signup` → public (add to `PUBLIC_PREFIXES` if not there)
- `/onboarding/instructions` → public (add to `PUBLIC_PREFIXES` if not there)

**Likely no middleware changes needed** — signup route will be public, middleware will already handle it.

---

## Part B: Post-Order Flow Audit

### Goal
Ensure the "ordered" state (after basket placed) flow is solid end-to-end.

### Routes to Check
- **`/plan?week=current`** — Should show KitchenPanel (mark as cooked, leftovers, bailed status)
- **`/split`** — Split breakdown + collector view (payment confirmation, dispute flow)
- **`/split/reconcile`** — Substitution handling, quantity adjustments, refunds
- **`/basket`** — (Empty after order placed, should redirect or show "ordered" state)

### Key Scenarios

#### Scenario 1: Mark Meal as Cooked
- [ ] Day passes, meal row shows "Mark as cooked" UI
- [ ] Clicking marks `planned_meals.status = 'cooked'`
- [ ] Enables leftovers creation (if implemented)
- [ ] Only cook or housemate can mark

#### Scenario 2: Reconciliation Flow
- [ ] After delivery, collector marks items received/partial/refunded
- [ ] Quantity adjustments (ordered 2 packs, received 1)
- [ ] Substitution accept/reject (charged on accepted, refunded on rejected)
- [ ] Final reconciliation posts correct split amounts
- [ ] Money math holds: no penny lost, rounding correct

#### Scenario 3: Settlement (Collector View)
- [ ] Collector sees `CollectorPanel` with outstanding balances
- [ ] Housemates mark as paid via `PayPanel`
- [ ] Collector confirms or disputes payment
- [ ] Ledger shows final settled amount

#### Scenario 4: Payment Panel (Non-Collector)
- [ ] Shows amount owed to collector
- [ ] "I've paid" button sends notification
- [ ] Status progresses: pending → notified → confirmed
- [ ] Payment proof (bank details, link) displayed

### Defects to Catch
- [ ] Broken routes (404s, 500s after order placed)
- [ ] Reconciliation quantities not persisting
- [ ] Money math errors (rounding, allocation)
- [ ] Missing permission checks (non-cook marking as cooked, etc.)
- [ ] UI broken at mobile/tablet/desktop
- [ ] Console errors on post-order routes
- [ ] Missing empty states

### Definition of Done
- Walk through full post-order flow: order → delivery → reconciliation → settlement
- All money calculations verified (compare against manual math)
- No console errors
- All permission checks working
- Responsive at 375px/768px/1440px
- Test report documenting what works/broken

---

## Parallel Execution

**Agent A: Welcome Redesign** (1-2 hours)
- Remove centering, add "Why Grub", responsive check

**Agent B: Signup Flow** (2-3 hours)
- Create `/onboarding/signup` + `/onboarding/instructions`
- Wire flow together
- Test end-to-end

**Agent C: Post-Order Audit** (2-3 hours)
- Test all post-order routes
- Document defects
- Verify money math
- Fix critical issues

**Optional Agent D: Integration** (1 hour)
- Merge all PRs
- Final smoke test

---

## Success Criteria

- [ ] `/welcome` redesigned (full-width, "Why Grub", responsive)
- [ ] Signup flow complete (signup → instructions → create → feed)
- [ ] Post-order routes all functional
- [ ] Money math verified
- [ ] `npm run verify` passes
- [ ] All commits created
- [ ] Responsive tested at 375px/768px/1440px

---

## Next Steps

1. Spawn Agent A (Welcome)
2. Spawn Agent B (Signup)
3. Spawn Agent C (Post-Order Audit)
4. Merge and test

