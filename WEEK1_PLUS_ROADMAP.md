# Post-Week1 Roadmap (Options 2-8)

**Status:** Backlog / To-Do  
**Priority Order:** As listed below

---

## Option 2: Complete Authentication & Onboarding Flow (6-10 hours)

**Goal:** Test and fix entire signup/login/onboarding journey end-to-end

### Gaps to Test
- [ ] Email OTP flow (magic link sign-in) — never tested E2E
- [ ] Signup → onboarding sequence — path unclear
- [ ] House creation form validation & error states
- [ ] House invite flow (just fixed 500, full flow untested)
- [ ] Room assignment → Feed transition
- [ ] First-time user experience complete flow

### Known Issues to Fix
- [ ] Missing error handling on invite flow (partially fixed)
- [ ] Redirect chains unclear (signup → instructions → create → invite → feed)
- [ ] Form state persistence across multi-step onboarding
- [ ] "Join existing house" flow (untested end-to-end)
- [ ] Error messages match Grub voice?

### Definition of Done
- Walk through signup → feed without errors
- Walk through join invite → feed without errors
- All error states tested and fixed
- E2E test suite for auth flows
- Production-ready auth

---

## Option 3: Protected Routes Deep-Dive (8-12 hours)

**Goal:** Test all 10 authenticated routes with real data flow

### Routes to Audit
- [ ] `/` (Feed) — empty state, data display, refresh
- [ ] `/plan` — week rendering, meal cards, responsive, add meal flow
- [ ] `/recipes` — search, filters, quick-add sheet, pagination
- [ ] `/basket` — live Tesco data, own-brand toggle, totals, checkout
- [ ] `/split` — split calculation, "I've paid" flow, ledger, history
- [ ] `/split/reconcile` — substitution handling, money math, refunds
- [ ] `/split/balances` — peer balances, ledger entries, export
- [ ] `/account` — profile edit, dietary prefs, payment details edit
- [ ] `/settings` — house config, cutoff times, member management
- [ ] `/pantry` — empty state, item CRUD, low stock alerts
- [ ] `/leftovers` — creation, claiming, guest management

### Defects to Document
- Layout/responsive issues at each route (375px, 768px, 1440px)
- Console errors specific to each page
- Missing empty states
- Broken interactions (buttons, forms, modals, sheets)
- Data loading/error states
- Unhandled edge cases

### Definition of Done
- Complete feature map (what works, what doesn't)
- Defect log with screenshots
- Responsive verified on all viewports
- All critical paths tested

---

## Option 4: Money & Reconciliation Testing (6-10 hours)

**Goal:** Verify split accuracy (core product value)

### Money Flows to Verify
- [ ] `splitPence()` rounding on 3+ way splits (test 3, 4, 5 person)
- [ ] `allocateLine()` weight calculation (single, shared, mixed)
- [ ] Own-brand savings computation (delta calculation)
- [ ] Substitution cost adjustment (upgrade/downgrade)
- [ ] Partial delivery refunds (qty received < qty ordered)
- [ ] Ledger entry generation (correct person, amount, type)
- [ ] Payment settlement math (including rounding edge cases)

### Test Scenarios
- 3-person household, uneven ingredient allocation
- 4-person with guests (covered/uncovered guests)
- Partial delivery + substitutions (complex case)
- Own-brand toggle effect on totals (should reduce cost)
- Bailed participant cost redistribution (removed after order)
- Expense shares (external costs split correctly)
- Rounding: 100p ÷ 3 = 34/33/33 (not 33/33/34)

### Definition of Done
- All money flows tested with real data
- Edge cases documented (rounding, bailed, guests)
- No money bugs found
- Split calculation verified against manual math
- Production-ready reconciliation

---

## Option 5: Performance & Load Testing (4-8 hours)

**Goal:** Optimize before scaling

### Metrics to Check
- [ ] Page load time (Lighthouse: FCP, LCP, CLS)
- [ ] Server action response time (p95, p99)
- [ ] Database query count per page (N+1 detection)
- [ ] Bundle size analysis (total JS, per-route)
- [ ] Memory usage (React DevTools Profiler)
- [ ] Image optimization (Tesco product images)

### Known Optimizations Needed
- [ ] Remove Map recreation on every render (from earlier audit)
- [ ] Batch database queries (prevents waterfall)
- [ ] Memoization on expensive components
- [ ] Code-split heavy routes (recipes, reconciliation)
- [ ] Image lazy-loading (Tesco products)

### Definition of Done
- FCP < 2s, LCP < 3s, CLS < 0.1 (Lighthouse green)
- Server action p95 < 500ms
- No N+1 queries in critical paths
- Bundle size < 150KB (gzipped)

---

## Option 6: E2E Test Coverage (8-12 hours)

**Goal:** Create Playwright test suite for critical paths

### Test Scenarios
- [ ] Sign up → onboarding → first plan complete
- [ ] Add meal to plan → build basket → view split
- [ ] Mark as cooked → leftovers creation → claim leftovers
- [ ] Accept/reject substitution → reconciliation flow
- [ ] Payment settlement flow ("I've paid" → ledger)
- [ ] Cook offer lifecycle (offer → accept/decline → standdown)
- [ ] Dietary filter + meal join with warning
- [ ] Join existing house via invite code
- [ ] House settings config (cutoff time, preferences)

### Coverage Targets
- 15-20 end-to-end test cases
- All main user paths covered
- Happy path + error cases
- Mobile (375px) + desktop (1440px)

### Definition of Done
- All tests passing locally
- CI/CD ready (GitHub Actions)
- Test report generated
- >80% code coverage on critical paths

---

## Option 7: Accessibility Audit (4-6 hours)

**Goal:** WCAG 2.1 AA compliance

### Areas to Check
- [ ] Keyboard navigation (Tab through all pages, escape modals)
- [ ] Color contrast ratios (all text/BG combinations)
- [ ] ARIA labels on interactive elements (buttons, links, forms)
- [ ] Focus ring visibility (clear focus indicator)
- [ ] Form labels and error associations (proper `<label>` tags)
- [ ] Screen reader testing (NVDA/JAWS simulation)
- [ ] Reduced motion preferences (disable animations)
- [ ] Touch target sizes (already fixed: 44px minimum)

### Tools
- axe DevTools (Chrome extension)
- WAVE (WebAIM)
- Lighthouse (built-in audit)
- Keyboard-only testing (no mouse)

### Definition of Done
- Zero axe violations on all pages
- All contrast ratios WCAG AA (4.5:1 normal, 3:1 large)
- Keyboard nav working on all flows
- ARIA labels complete
- Screen reader tested

---

## Option 8: Deployment Preparation (4-6 hours)

**Goal:** Get ready for production

### Deployment Checklist
- [ ] Environment variables documented (.env.production)
- [ ] Supabase production project setup
- [ ] Database backups strategy (daily snapshots)
- [ ] Error tracking setup (Sentry or similar)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Incident response playbook (who, when, how)
- [ ] Smoke test script (critical flows on prod)
- [ ] Rollback procedure (documented)
- [ ] Monitoring dashboards (errors, latency, users)
- [ ] Runbook for common issues

### Pre-Deploy Checklist
- [ ] All Week1 fixes merged to main
- [ ] All tests passing
- [ ] Build artifact created and tested
- [ ] Staging environment smoke test complete
- [ ] Data migration plan (if any)
- [ ] Rollback tested

### Definition of Done
- Deployment documentation complete
- Team trained on runbook
- Monitoring active
- Safe to deploy (confident rollback plan)

---

## Priority Timeline

**Recommended order of execution:**

### If 1 week timeline:
1. **Option 1** (Week 1 fixes) — 8h ← CURRENT
2. **Option 2** (Auth flow) — 8h
3. **Option 8** (Deployment prep) — 4h
4. **Option 6** (E2E tests) — 8h
**Total: 28h | 3-4 days with parallel agents**

### If 2-3 week timeline:
1. **Option 1** → **Option 3** → **Option 4** → **Option 5** → **Option 7** → **Option 6** → **Option 8**
**Total: 50-60 hours | Complete coverage, production-hardened**

---

## Notes

- Options 2-8 are independent (can be done in any order except 8 needs most others complete)
- Each option can be delegated to separate agents for parallel execution
- Revisit this roadmap after Week 1 complete to prioritize next sprint
