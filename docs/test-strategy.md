# Test Strategy: Booking Management

Input: `docs/test-scenarios.md` (40 scenarios, TC-001 to TC-510)
Source analysis: `backend/src/services/bookingService.js`, `backend/src/repositories/bookingRepository.js`, `frontend/app/bookings/`, `frontend/components/bookings/`, `tests/booking-management.spec.js`

---

## Layer Distribution

| Layer | Count | Focus | Avg Time |
|-------|-------|-------|----------|
| Unit | 1 | Pure functions with no I/O | < 1ms |
| API | 6 | Backend contracts, auth enforcement, service logic | ~200ms |
| Component | 7 | React component rendering, state machines, UI branches | ~50ms |
| E2E | 26 | Multi-page journeys and full-stack flows | 5–15s |
| **Total** | **40** | | |

**Pyramid shape**: Wide at bottom (14 non-E2E), narrow at top (26 E2E). This is acceptable for an application whose most important behaviors are observable only through the full stack. However, the refund logic and booking ref generation are both pure and should be anchored at lower layers for speed and determinism.

---

## Unit Tests (1)

Pure functions with no database I/O. Zero infrastructure needed — run in Node directly.

### TC-407 — Rapid successive bookings produce unique refs
**Assigned Layer**: Unit ← (from API in scenarios)
**Source**: `backend/src/services/bookingService.js:11` — `randomRef(eventTitle)` and `generateUniqueRef(eventTitle:21)`
**Rationale**: `randomRef()` is a pure function. `generateUniqueRef()` is async only because of the DB collision check, but the retry + fallback logic (`attempts < 10` → timestamp fallback at line 31) can be unit-tested by mocking `bookingRepository.findByRef`. Running this at API layer is slower and doesn't isolate the collision path. The timestamp fallback is only exercisable by mocking 10 consecutive collisions — impossible to trigger reliably at API layer.
**What to test**: `randomRef('Tech Summit')` → starts with 'T', length 8, format `T-[A-Z0-9]{6}`; retry loop terminates with unique ref; 10-collision fallback produces timestamp-based ref.

---

## API / Integration Tests (6)

Hit real Express endpoints with HTTP client (e.g., `axios` or `fetch`). Requires seeded DB. Validates contracts, error codes, and backend business logic without a browser.

### TC-103 — FIFO pruning prefers different event over same event
**Assigned Layer**: API ← (already API in scenarios)
**Endpoints**: `POST /api/bookings` (×10), `GET /api/bookings`
**Source**: `bookingService.js:71` — `findOldestUserBookingExcludingEvent` + `sameEventFallback` flag
**Rationale**: This requires creating 9 pre-seeded bookings in a specific configuration (8 for Event B, 1 oldest for Event A), then asserting which booking was pruned after a 10th creation. Impossible to set up deterministically through the UI without flaky ordering; API setup + assertion is the only reliable approach.

### TC-104 — Booking status is always "confirmed"
**Assigned Layer**: API ← (downgraded from E2E)
**Endpoints**: `POST /api/bookings`, `GET /api/bookings/:id`
**Source**: `bookingService.js:115` — `status: 'confirmed'` hardcoded in `prisma.booking.create`
**Rationale**: Verifying `data.status === "confirmed"` in the API response is a single assertion on the JSON body. Taking it to E2E means a full login + booking + navigation flow just to read one field. The UI adds no additional coverage here.

### TC-202 — Cross-user cancel via API returns 403
**Assigned Layer**: API ← (already API in scenarios)
**Endpoints**: `DELETE /api/bookings/:id` (with User B's token on User A's booking)
**Source**: `bookingService.js:128` — `if (booking.userId !== userId) throw new ForbiddenError(...)`
**Rationale**: This is a security contract test. The HTTP response code (403) and error message are the spec. The UI (TC-201) tests the rendering of "Access Denied" — that's a separate, complementary E2E concern. Both layers are needed (defense-in-depth).

### TC-205 — Clear all via API only affects requester's bookings
**Assigned Layer**: API ← (already API in scenarios)
**Endpoints**: `DELETE /api/bookings` (User B), `GET /api/bookings` (User A)
**Source**: `bookingRepository.js:60` — `prisma.booking.deleteMany({ where: { userId } })`
**Rationale**: The `userId` scoping of `deleteMany` is a critical data isolation rule. This is verifiable in one API round-trip by checking User A's bookings after User B clears theirs. No browser needed.

### TC-304 — API cancel of non-existent booking returns 404
**Assigned Layer**: API ← (already API in scenarios)
**Endpoints**: `DELETE /api/bookings/99999`
**Source**: `bookingService.js:126` — `cancelBooking` → `bookingRepository.findById` → null → `NotFoundError`
**Rationale**: 404 HTTP contract. TC-303 (navigate to cancelled booking in UI) tests the frontend rendering of this error. TC-304 tests the API contract directly — no UI involvement needed.

### TC-406 — FIFO same-event fallback permanently burns a seat
**Assigned Layer**: API ← (already API in scenarios)
**Endpoints**: `POST /api/bookings` (×10 same event), `GET /api/events/:id`
**Source**: `bookingService.js:95` — `if (sameEventFallback) await eventRepository.decrementSeats(data.eventId, data.quantity)`
**Rationale**: This involves reading `event.availableSeats` before and after the 10th booking to detect the extra decrement. E2E cannot reliably set up 9 pre-existing bookings for one event without flake; the seat count delta is only measurable at the data layer.

---

## Component Tests (7)

Render individual React components in isolation (Jest + React Testing Library). No server, no browser. Ideal for client-side logic and UI state branches.

### TC-105 — Refund spinner displays for ~4 seconds
**Assigned Layer**: Component ← (downgraded from E2E)
**Source**: `frontend/app/bookings/[id]/page.tsx:27` — `setTimeout(() => { setStatus(...) }, 4000)`
**Rationale**: Running this at E2E makes every CI run wait a real 4 seconds per test. With Jest fake timers (`jest.useFakeTimers()`), `jest.advanceTimersByTime(4000)` triggers the state change instantly. Component layer tests all three state transitions — idle → checking → eligible/ineligible — in milliseconds.

### TC-106 — Refund check result matches quantity boundary exactly
**Assigned Layer**: Component ← (downgraded from E2E)
**Source**: `frontend/app/bookings/[id]/page.tsx:27` — `setStatus(quantity === 1 ? 'eligible' : 'ineligible')`
**Rationale**: This is a pure conditional expression in the component. Render `<RefundEligibility quantity={1} />` and `<RefundEligibility quantity={2} />` with fake timers — no DB, no browser, no login. Boundary conditions (qty=1, qty=2) are inherently unstable to test at E2E because you'd need specific bookings to exist.

### TC-402 — Refund eligibility at exact boundary quantity = 2
**Assigned Layer**: Component ← (downgraded from E2E)
**Source**: Same as TC-106
**Rationale**: Duplicate boundary test from a different angle — tests that qty=2 is the first ineligible value. Same reasoning as TC-106: pure component logic with fake timers.

### TC-502 — Loading skeleton displays while bookings fetch
**Assigned Layer**: Component ← (already Component in scenarios)
**Source**: `frontend/app/bookings/page.tsx:66` — `{isLoading && (<div>...BookingCardSkeleton × 5...)}`
**Rationale**: Mock the `useBookings` hook to return `{ isLoading: true }`. Assert 5 skeleton elements render. This branch is a single conditional — no need to simulate network latency in a browser.

### TC-503 — Error state shows Retry button on fetch failure
**Assigned Layer**: Component ← (already Component in scenarios)
**Source**: `frontend/app/bookings/page.tsx:73` — `{isError && (<EmptyState ... action={<Button onClick={() => refetch()}>Retry</Button>} />)}`
**Rationale**: Mock `useBookings` to return `{ isError: true }`. Assert the EmptyState content and that clicking "Retry" calls `refetch`. Pure rendering test.

### TC-507 — Refund states transition correctly: idle → checking → result
**Assigned Layer**: Component ← (downgraded from E2E)
**Source**: `frontend/app/bookings/[id]/page.tsx:21-69` — `RefundEligibility` component with 4-state machine
**Rationale**: The state machine (`idle`, `checking`, `eligible`, `ineligible`) is entirely local to `RefundEligibility`. All transitions can be exercised with fake timers. Testing this at E2E requires a real 4s delay per state and couples the state machine test to the login + booking flow.

### TC-508 — Eligible refund result uses green styling; ineligible uses red
**Assigned Layer**: Component ← (downgraded from E2E)
**Source**: `frontend/app/bookings/[id]/page.tsx:53-68` — `bg-emerald-50`/`bg-red-50` classes
**Rationale**: CSS class assertions on rendered output — textbook component test. Checking Tailwind classes in a full browser adds no coverage over `getByTestId('refund-result').className`.

---

## E2E Tests (26)

Full-stack flows in Chromium via Playwright. Run against `https://eventhub.rahulshettyacademy.com`. Each test must be self-contained (login → setup → action → assert).

### Already Implemented (5 tests in `tests/booking-management.spec.js`)
| Test ID | Description | Status |
|---------|-------------|--------|
| TC-001 | View bookings list | ✅ Implemented |
| TC-002 | View booking detail page | ✅ Implemented |
| TC-003 | Cancel booking + confirm dialog | ✅ Implemented |
| TC-004 | Clear all bookings | ✅ Implemented |
| TC-101 | Booking ref first char matches event title | ✅ Implemented (labeled TC-102 in file) |

### Remaining E2E Tests (21 tests)

**Happy Path**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-005 | Refund eligible (qty=1) — spinner then green result | P1 | `#refund-spinner` visible → `#refund-result` with "Eligible" text |
| TC-006 | Refund ineligible (qty>1) — spinner then red result | P1 | `#refund-result` with "not eligible" + correct quantity in message |
| TC-007 | Navigate list → detail → back | P1 | URL transitions + breadcrumb text |
| TC-008 | Payment summary shows correct total | P1 | `totalPrice === eventPrice × quantity` displayed in "Total Paid" field |

**Business Rules**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-102 | FIFO: 10th booking removes oldest (different event) | P1 | Oldest booking ref absent after 10th booking created |
| TC-107 | Cancel removes booking from list | P0 | Cancelled booking ref not in `/bookings` after cancel + navigate |
| TC-108 | Clear all removes all 9 bookings | P1 | Empty state after clear all with 9 bookings pre-set |

**Security**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-201 | Cross-user access → "Access Denied" UI | P0 | `h1` = "Access Denied"; "View My Bookings" button visible |
| TC-203 | Unauthenticated `/bookings` → redirect | P0 | URL becomes `/login` |
| TC-204 | Unauthenticated `/bookings/:id` → redirect | P0 | URL becomes `/login` |

**Negative / Error**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-301 | Non-existent booking ID → "Booking not found" | P1 | EmptyState with "Booking not found" title |
| TC-302 | Clear all when empty → no error | P2 | Empty state remains; no toast error |
| TC-303 | Navigate to cancelled booking → "not found" | P1 | 404 page after successful cancel |

**Edge Cases**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-401 | Book max quantity (10 tickets) | P1 | Booking created; total = price × 10 |
| TC-403 | Cancel last booking → empty state | P1 | Redirect to `/bookings`; empty state shown |
| TC-404 | 9 bookings fills page 1 — no pagination | P2 | No pagination controls; all 9 cards visible |
| TC-405 | Multiple bookings same event | P2 | Two distinct booking refs for same event title |

**UI State**

| TC | Description | Priority | Key Assertions |
|----|-------------|----------|----------------|
| TC-501 | Empty state shows when 0 bookings | P1 | "No bookings yet"; "Browse Events" link |
| TC-504 | "Clearing…" button state during clear | P2 | Button text + disabled attribute during API call |
| TC-505 | Confirm dialog content before cancel | P1 | Dialog title; booking ref in description; "Yes, cancel it" button |
| TC-506 | Dismiss confirm dialog → booking intact | P1 | Dialog closes; still on detail page; booking exists |
| TC-509 | Breadcrumb shows booking ref | P2 | `nav` contains `bookingRef` in monospace span |
| TC-510 | "Access Denied" links back to own bookings | P1 | "View My Bookings" button → `/bookings` |

---

## Defense-in-Depth: Multi-Layer Coverage

These critical rules are tested at more than one layer:

| Rule | Unit | API | Component | E2E |
|------|------|-----|-----------|-----|
| Booking ref format (first char = title first char) | TC-407 (ref gen) | — | — | TC-101 ✅ |
| Cross-user access denied | — | TC-202 | — | TC-201 |
| Refund eligibility boundary (qty=1 only) | — | — | TC-106, TC-402 | TC-005, TC-006 |
| FIFO same-event seat burn | — | TC-406 | — | — |

---

## Anti-Patterns Found in Existing Tests

### 1. Inverted pyramid — zero API and unit coverage
**File**: `tests/booking-management.spec.js`
All 5 existing tests are E2E. There are no API tests and no unit tests for `bookingService.js` or `RefundEligibility`. This means pure backend business logic (FIFO pruning, seat burn, ref generation) has no fast feedback loop.
**Fix**: Implement TC-407 (Unit) and TC-202, TC-304, TC-406 (API) as the first additions.

### 2. Refund eligibility tested only at E2E — 4-second forced wait
**Tests**: TC-005, TC-006 (when implemented)
The `RefundEligibility` component uses `setTimeout(..., 4000)`. If both refund scenarios run at E2E, CI adds ≥8 real seconds for timer waits alone. Each additional refund test compounds this.
**Fix**: Push TC-105, TC-106, TC-402, TC-507, TC-508 to Component tests with `jest.useFakeTimers()`. Keep only one representative E2E test for the full booking → refund flow.

### 3. Existing TC-102 label mismatch
**File**: `tests/booking-management.spec.js:152`
The test named `TC-102` actually tests the booking reference format (first char = event title first char), which maps to TC-101 in `docs/test-scenarios.md`. TC-102 (FIFO pruning) is not yet implemented.
**Fix**: Rename the existing test to `TC-101` and implement FIFO pruning as `TC-102`.

### 4. TC-302 (clear all when empty) assigned to E2E
**Scenario**: TC-302 navigates to `/bookings`, clicks "Clear all", and confirms. The meaningful assertion is that the API returns `{ deleted: 0 }` without error. The empty-state UI is already covered by TC-501. Running TC-302 at E2E duplicates TC-501's UI assertions and adds a browser boot just to test a `deleteMany` edge case.
**Fix**: Implement TC-302 as an API test: `DELETE /api/bookings` on a user with 0 bookings → HTTP 200, `{ deleted: 0 }`.

---

## Recommended Implementation Order

1. **TC-001–004, TC-101** — already done ✅
2. **TC-202, TC-304** — API security and error contracts (fast wins, no UI needed)
3. **TC-201, TC-203, TC-204** — complete security E2E coverage (P0)
4. **TC-106, TC-402, TC-507** — Component tests for refund logic (eliminate future 4s timer waits)
5. **TC-005, TC-006** — E2E refund happy paths (one for each outcome)
6. **TC-107, TC-108** — cancel + clear all business rules
7. **TC-102** — FIFO pruning (requires multi-booking setup, do after helpers are stable)
8. **TC-301, TC-303** — error state E2E
9. **TC-407** — Unit test for `randomRef()` + `generateUniqueRef()`
10. **Remaining P2/P3** — TC-103, TC-205, TC-406 (API), TC-105, TC-502, TC-503, TC-508 (Component), and remaining E2E edge cases
