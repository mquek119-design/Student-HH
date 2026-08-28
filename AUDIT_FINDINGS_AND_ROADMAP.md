# Grub: Complete Audit Findings & 5-Week Roadmap

**Date**: 2026-08-28  
**Build Status**: ✓ All clean (typecheck, lint, build)  
**Audit Scope**: Code, Database, UI/UX (3 independent audits)

---

## Executive Summary

**Audit Results:**
- **Code**: 25 findings (3 critical, 5 high, 17 medium/low)
- **Database**: 14 findings (4 critical, 1 high, 9 medium)
- **UX**: 8 findings (3 medium, 5 low)

**Critical Blockers** (prevent shipping):
1. **Plan cutoff not enforced server-side** — users can add meals after cutoff via stale tabs
2. **Database migration naming conflict** — two `0021_*` files block Supabase deployment
3. **Push subscriptions RLS disabled** — auth tokens exposed to all authenticated users
4. **Dietary filters incomplete** — UI renders but doesn't filter recipes
5. **Database types missing** — `push_subscriptions` and `tesco_sessions` not in TypeScript

**High-Priority Issues** (degrade user experience):
1. Quantity control buttons too small for mobile (24x24px vs 44x44px)
2. Unhandled Promise rejections in Tesco session checks
3. Leftovers depend on `meal.status = 'cooked'` with no UI to set this
4. Room assignment saves but never used
5. Cook offer lifecycle untested

---

## CRITICAL FIXES (This Week)

### 1. Database Schema & Types Fix
**Impact**: Blocks Supabase deployment and feature use  
**Effort**: 2 hours

**Tasks**:
- [ ] Rename `supabase/migrations/0021_push_subscriptions.sql` → `0023_push_subscriptions.sql`
- [ ] Rename `supabase/migrations/0021_recipe_dietary_tags.sql` → `0022_recipe_dietary_tags.sql`
- [ ] Rename `supabase/migrations/0022_tesco_sessions.sql` → `0024_tesco_sessions.sql`
- [ ] Uncomment RLS enable in `0023_push_subscriptions.sql` (line 40) + policies (lines 43-45)
- [ ] Add house_id boundary check to `0024_tesco_sessions.sql` RLS policies
- [ ] Regenerate types: `npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`
- [ ] Update `src/lib/supabase/database.types.ts`: add `'dietary_tags'` to `recipes.Insertable` optional fields
- [ ] Deploy all 4 migrations to Supabase SQL editor
- [ ] Run `npm run verify` (should still pass)
- [ ] Commit: "fix: correct database migrations and regenerate types"

### 2. Plan Cutoff Server-Side Enforcement
**Impact**: Security issue; blocks post-cutoff meal additions  
**Effort**: 1 hour

**Task**: Add server-side cutoff check in `src/app/plan/actions.ts`

```typescript
// In addMealToPlan() before plan read
if (isCutoffPassed(plan.cutoffAt)) {
  return fail('Planning has closed. No more meals can be added.');
}
```

Also add to: `joinMeal()`, `leaveMeal()`, `setCook()` (all meal mutations after cutoff should reject)

**Verification**: E2E test that adding meal after cutoff fails

### 3. Dietary Filters Wire-Up
**Impact**: Feature incomplete; UI renders but doesn't filter  
**Effort**: 1.5 hours

**Tasks**:
- [ ] Wire `RecipeFilterChips.tsx` selected state → `useSearchParams()` query params
- [ ] Update recipe search query to filter on `matchesDietaryFilter()`
- [ ] Display dietary warnings on meal cards during planning (not just preventing joins)
- [ ] Test: filter by "Vegetarian", verify only vegetarian recipes show
- [ ] Test: join vegetarian meal as non-vegetarian, show warning
- [ ] Commit: "feat: complete dietary filter implementation"

### 4. Promise Rejection Handlers
**Impact**: Silent failures in Tesco session, push notifications  
**Effort**: 1 hour

**Files to fix**:
- `src/components/basket/BasketView.tsx:68` — add `.catch()` to `checkTescoSession()`
- `src/components/settings/TescoSessionPanel.tsx:18, 40` — add `.catch()`
- `src/components/PushNotificationSetup.tsx:111` — add error handling to fetch
- `src/components/PushNotificationSetup.tsx:100` — use proper type assertion instead of `as any`

**Commit**: "fix: add error handlers to unhandled promise chains"

---

## WEEK 1: Critical Bugs & Stabilization

**Goal**: Fix all critical & high-priority bugs. App should be deployable.

**Tasks** (13 total):

1. ✅ Database schema & types fix (see above)
2. ✅ Plan cutoff server-side enforcement (see above)
3. ✅ Dietary filters wire-up (see above)
4. ✅ Promise rejection handlers (see above)
5. Fix touch target sizes (buttons 24px → 44px)
   - `src/components/basket/BasketView.tsx:416-430` quantity buttons
   - `src/components/split/Reconciliation.tsx:205-224` quantity buttons
   - `src/components/split/Reconciliation.tsx:287-314` Accept/Reject buttons
6. Add focus ring to small buttons (keyboard nav)
7. Wire up room display (show room next to usernames on meal assignments, balances)
8. Add "Mark as cooked" UI to KitchenPanel (so leftovers can show)
9. Add form validation feedback (cook time, servings min validation)
10. Verify empty states on Pantry, Leftovers, Recipes
11. Add E2E tests: plan cutoff, dietary filters, cook offer lifecycle
12. Resolve 20+ `as any` type casts (enforce strict types)
13. Run full test suite; aim for >85% coverage on critical paths

**Definition of Done**:
- `npm run verify` passes
- All critical findings fixed
- 8+ E2E tests passing
- No Promise rejections in console
- App deployable to staging

**Effort Estimate**: 40-50 hours (5 concurrent agents × 8-10 hours each)

---

## WEEK 2: Feature Completion & Testing

**Goal**: Complete incomplete features. Fix remaining high/medium bugs.

**Tasks** (12 total):

1. Cook offer lifecycle full E2E test (offer → accept/decline → standDown)
2. Leftovers claim/release logic (UI + backend)
3. Reconciliation edge cases (partial delivery, multiple substitutions)
4. `splitPence()` rounding edge cases (3+ way splits)
5. Slot booking E2E test (real Tesco API, not mocked)
6. Pantry item management (add, edit, delete)
7. Staples creation and sync
8. Guest meal capacity (guests count toward max_diners)
9. Bailed participants (don't charge, don't delete)
10. Ledger exports (CSV for accounting)
11. Payment reminder notifications (push + email)
12. Accessibility audit (WCAG 2.1 AA compliance)

**Definition of Done**:
- All incomplete features now complete
- 50+ E2E tests passing
- 0 high-priority bugs
- Accessibility audit green

**Effort Estimate**: 35-45 hours

---

## WEEK 3: Performance & Reliability

**Goal**: Optimize, stabilize, prepare for load testing.

**Tasks** (10 total):

1. Memoization sweep (remove Map recreation on every render)
2. Query optimization (N+1 prevention, batch queries)
3. Tesco session persistence (resume orders mid-week)
4. Error recovery (network failure retry patterns)
5. Rate limiting on API routes (prevent abuse)
6. Cache invalidation strategy (when to bust caches)
7. Load testing (100 concurrent users on plan view)
8. Database backup strategy (Supabase automate)
9. Monitoring setup (error tracking, performance metrics)
10. Documentation (API routes, server actions, data flow)

**Definition of Done**:
- <100ms First Contentful Paint on mobile
- <50ms server action response (p95)
- 0 unhandled rejections
- Error tracking live
- Load test passes 100 users

**Effort Estimate**: 30-40 hours

---

## WEEK 4: User Experience Polish

**Goal**: Fix all UX/accessibility findings. Refine UI feel.

**Tasks** (8 total):

1. Motion refinements (enter/exit animations for modals, slides)
2. Skeleton loaders (show structure while data loads)
3. Toast notifications (success/error feedback)
4. Keyboard shortcut documentation
5. Mobile responsiveness testing (375px → 1280px viewports)
6. Dark mode verification (if applicable)
7. Contrast ratio audit (WCAG AAA where possible)
8. User testing (5 real houses, gather feedback)

**Definition of Done**:
- All UX findings resolved
- Mobile/desktop both smooth
- User testing feedback <3 issues per house

**Effort Estimate**: 25-35 hours

---

## WEEK 5: Deployment & Post-Launch

**Goal**: Deploy to production. Monitor. Plan next phase.

**Tasks** (6 total):

1. Production deployment (Vercel)
2. Smoke test on live environment
3. Monitoring dashboards (errors, performance, usage)
4. Incident response playbook
5. 1-week post-launch QA (live data bugs)
6. Roadmap for Weeks 6-10 (push notifications, multi-house, analytics)

**Definition of Done**:
- Live on production
- 0 P0 incidents
- Daily active users tracking
- Feedback collection active

**Effort Estimate**: 15-20 hours

---

## Summary by Category

| Category | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Total |
|----------|--------|--------|--------|--------|--------|-------|
| Bug Fixes | 13 | 5 | 3 | 2 | 1 | 24 |
| Features | 2 | 8 | 1 | 2 | 1 | 14 |
| Testing | 3 | 2 | 2 | 1 | 2 | 10 |
| Ops/Infra | 1 | 1 | 4 | 1 | 3 | 10 |
| **Total** | **19** | **16** | **10** | **6** | **7** | **58** |

**Effort**: ~165-175 hours (5 agents × 8h/day × 5 days)  
**Timeline**: 5 calendar weeks with 5 concurrent agents

---

# 8-Concurrent-Agent Team Structure

## Team Composition

```
Grub Development Team (8 Concurrent Agents)

EXECUTION TIER (5 agents):
  ├─ Agent Task-1 (Features & Implementation)
  ├─ Agent Task-2 (Features & Implementation)
  ├─ Agent Task-3 (Bug Fixes & Refactoring)
  ├─ Agent Task-4 (Testing & QA)
  └─ Agent Task-5 (Backend & Database)

QUALITY TIER (1 agent):
  └─ Agent QA-Check (Code Review, Testing Verification)

OPS TIER (1 agent):
  └─ Agent Permission-Monitor (Settings, Allowlist Updates)

LEADERSHIP TIER (1 agent):
  └─ Agent Senior-Dev (Task Assignment, Prioritization, Reviews)
```

## Agent Roles & Responsibilities

### Task Agents (5)
**Assignment**: 1 task per agent per 2-hour cycle  
**Autonomy**: Full (can create PRs, commits, branches)  
**Success Criteria**: Task complete, tests passing, code review approval

**Agent Task-1 (Features)**:
- UI components, pages, flows
- Styling, animations, responsive design
- User-facing changes

**Agent Task-2 (Features)**:
- Complementary features (different domain)
- Route handlers, middleware
- Configuration changes

**Agent Task-3 (Fixes)**:
- Bug fixes from priority list
- Refactoring, tech debt
- Performance optimizations

**Agent Task-4 (Testing)**:
- E2E test suites
- Unit test coverage
- Load/stress testing
- Accessibility audits

**Agent Task-5 (Backend)**:
- Database migrations
- Server actions, API routes
- Business logic (queries, optimiser, money)

### QA Check Agent (1)
**Trigger**: On each Task agent commit  
**Checks**:
- [ ] Code review (security, correctness, style)
- [ ] Tests passing (Jest, Playwright)
- [ ] No regressions (compare before/after)
- [ ] Build passes (typecheck, lint, build)
- [ ] Database migrations safe
- [ ] No fabricated data

**Output**: ✅ Approved or ❌ Needs fixes (with specific items)

### Permission Monitor Agent (1)
**Trigger**: Every 2 hours, after Task agents finish  
**Checks**:
- [ ] Scan console for new permission denials
- [ ] Update `.claude/settings.json` with new patterns
- [ ] Verify all 3 settings files in sync
- [ ] Commit permission updates if changed

**Output**: "Permissions updated: +2 patterns" or "No changes needed"

### Senior Dev Agent (1)
**Trigger**: At cycle start (every 2 hours)  
**Responsibilities**:
1. Read audit findings, priority list, completed work
2. Identify next 5 highest-priority tasks
3. Write task briefs (1 per agent, self-contained)
4. Assign tasks to Task agents (1:1 mapping)
5. Set success criteria
6. Review QA check results
7. Route failed tasks to blockers list
8. Update roadmap progress

**Output**:
```
2-Hour Cycle Report:
- Completed: Task-1 (dietary filters), Task-3 (touch target fix), Task-5 (migrations)
- Blocked: Task-2 (needs Tesco API key)
- Next: Task-1→cook offer tests, Task-2→leftovers UI, etc.
- Permissions: +1 pattern added
```

---

## 2-Hour Autonomous Loop

**Phase 1 - Assess (10 min)**:
- Read CLAUDE.md, audit findings, priority list
- Check git status (uncommitted changes, conflicts)
- Run `npm run verify` (typecheck, lint, build)
- Review prior cycle's QA results

**Phase 2 - Assign (10 min)**:
- Senior-Dev picks next 5 tasks from priority queue
- Writes 1-page brief per task (goal, files, success criteria)
- Assigns Task-1 through Task-5 (1:1)

**Phase 3 - Execute (90 min)**:
- All 5 Task agents work in parallel
- Each creates branch, implements, tests, commits
- QA-Check watches commits; reviews as they land
- Permission-Monitor tracks new patterns

**Phase 4 - Verify (20 min)**:
- QA-Check final passes on all 5 commits
- Permission-Monitor updates settings if needed
- Senior-Dev reviews results, routes blockers
- All run `npm run verify` together

**Phase 5 - Report (10 min)**:
- Summarize cycle completion
- List next 5 tasks
- Update burndown chart
- Early exit if: all top-20 tasks done OR 2x build failure in a row (manual intervention needed)

**Loop Continues**: Every 2 hours, 24/7 (via cloud routine)

---

## Success Metrics

**Per Cycle**:
- ✅ 4-5 tasks completed per 2-hour cycle
- ✅ <1 task blocker per cycle (resolved within 2 cycles)
- ✅ 0 permission prompts (all patterns pre-added)
- ✅ QA passes 100% of commits
- ✅ 0 regressions detected

**Per Week**:
- ✅ 40-50 tasks completed (10-13 per day)
- ✅ <3 high-priority bugs remaining
- ✅ Test coverage >80%
- ✅ 0 P0 incidents

**Overall**:
- ✅ All 58 tasks done by end of Week 5
- ✅ App deployable to production
- ✅ 0 fabricated data
- ✅ <100ms page load (mobile p95)

---

## Implementation Checklist

- [ ] Deploy database migrations (0021-0024 corrected)
- [ ] Fix 4 critical bugs (cutoff, dietary, push, promises)
- [ ] Authorize GitHub for cloud routine (user action)
- [ ] Create RemoteTrigger for 2-hour autonomous loop
- [ ] Spawn 8-agent team for Cycle 1
- [ ] Monitor first 2 cycles for stability
- [ ] Adjust task sizes if needed (some too big/small)
- [ ] Daily standups with Senior-Dev summary

---

## Notes

**Failure Modes**:
1. **Cascade blocker**: One task blocks 3+ others → escalate to user immediately
2. **Type regression**: `as any` increases instead of decreases → Senior-Dev routes to refactor queue
3. **Test flakiness**: Same E2E test fails 2x in a row → disable and spike
4. **Permission sprawl**: New patterns added every cycle → review and consolidate

**Scaling**:
- 5 tasks per cycle works up to 50-60 tasks total
- Beyond 100 tasks, consider 8-agent concurrency (current plan)
- If tasks <2hr each, can spawn 10 agents (2 per Task agent)

**Handoff to Maintenance**:
- After Week 5 deploy, reduce to 3 agents (1 task, 1 QA, 1 senior)
- 1-week post-launch QA critical
- Plan Weeks 6-10 roadmap (push notif, multi-house, analytics)
