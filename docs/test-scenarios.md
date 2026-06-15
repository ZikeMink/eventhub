# Test Scenarios: Booking Management

Generated for EventHub booking management flows covering `/bookings`, `/bookings/:id`, cancel, clear all, and refund eligibility.

---

## Happy Path (TC-001 – TC-099)

### TC-001: View bookings list with existing bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Wait for booking cards to load
**Expected Results**: Booking cards render with event title, booking ref, quantity, total price, and "View Details" link
**Business Rule**: Each user sees only their own bookings
**Suggested Layer**: E2E

---

### TC-002: View booking detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on any booking card
3. Verify URL changes to `/bookings/:id`
**Expected Results**: Detail page shows Event Details, Customer Details, Payment Summary, Refund section, and Booking Information sections. Booking ref displayed in breadcrumb and header.
**Business Rule**: Booking detail includes embedded event info (title, category, date, venue, city)
**Suggested Layer**: E2E

---

### TC-003: Cancel a single booking
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings/:id` for a confirmed booking
2. Click "Cancel Booking" button
3. Confirm in the dialog by clicking "Yes, cancel it"
4. Wait for toast and redirect
**Expected Results**: Toast shows "Booking cancelled successfully", user is redirected to `/bookings`, cancelled booking no longer appears in the list
**Business Rule**: Booking deletion immediately removes the record; seat restoration is dynamic for user-created events
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has at least 2 bookings
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" link
3. Confirm in the browser `confirm()` dialog
**Expected Results**: All booking cards disappear, empty state ("No bookings yet") is shown
**Business Rule**: `clearAllBookings` deletes all bookings for the user in one operation
**Suggested Layer**: E2E

---

### TC-005: Refund eligibility — single ticket (eligible)
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with quantity = 1
**Steps**:
1. Navigate to `/bookings/:id` for a single-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for spinner to resolve (~4 seconds)
**Expected Results**: Spinner (`#refund-spinner`) appears first, then result shows in green with text "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: quantity === 1 → eligible; client-side only, no API call
**Suggested Layer**: E2E

---

### TC-006: Refund eligibility — multiple tickets (ineligible)
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with quantity > 1
**Steps**:
1. Navigate to `/bookings/:id` for a multi-ticket booking (e.g., 3 tickets)
2. Click "Check eligibility for refund?"
3. Wait for spinner to resolve (~4 seconds)
**Expected Results**: Spinner appears first, then result shows in red with text "Not eligible for refund. Group bookings (3 tickets) are non-refundable." (quantity reflected in message)
**Business Rule**: quantity > 1 → ineligible; message includes exact ticket count
**Suggested Layer**: E2E

---

### TC-007: Navigate from booking list to detail and back
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details"
3. Click "← Back to My Bookings"
**Expected Results**: Returns to `/bookings` list page
**Business Rule**: Navigation links are consistent across booking flows
**Suggested Layer**: E2E

---

### TC-008: Booking detail shows correct payment summary
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking for a known event (e.g., Marathon Chennai at $49/ticket, qty=2)
**Steps**:
1. Navigate to the booking detail page
2. Read "Price per ticket" and "Total Paid" fields
**Expected Results**: Price per ticket shows event's unit price; Total Paid = price × quantity ($98 for the example above)
**Business Rule**: `totalPrice = event.price × quantity`
**Suggested Layer**: E2E

---

## Business Rules (TC-100 – TC-199)

### TC-101: Booking reference first character matches event title
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User books an event with a known title (e.g., "Tech Conference Bangalore")
**Steps**:
1. Complete a booking for "Tech Conference Bangalore"
2. Read the booking ref from the confirmation card or `/bookings/:id`
**Expected Results**: Booking ref starts with "T" (e.g., `T-A3B2C1`)
**Business Rule**: Ref format `[FIRST_CHAR_UPPERCASE]-[6_RANDOM_ALPHANUMERIC]`; first char must match event title's first letter
**Suggested Layer**: E2E

---

### TC-102: FIFO pruning — 10th booking deletes oldest
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User already has exactly 9 bookings
**Steps**:
1. Note the oldest booking's ref before creating a new booking
2. Create a 10th booking on a different event
3. Navigate to `/bookings`
**Expected Results**: 9 bookings remain; the previously oldest booking is gone; the 10th (newest) booking appears
**Business Rule**: Max 9 bookings per user — oldest is pruned on overflow (FIFO); preference given to deleting a booking for a *different* event
**Suggested Layer**: E2E

---

### TC-103: FIFO pruning prefers a different event over same event
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has 9 bookings — all for the same event except one (the oldest) which is for a different event
**Steps**:
1. Ensure the oldest booking is for Event A, all others for Event B
2. Create a new booking for Event B (triggering pruning)
**Expected Results**: The oldest booking (for Event A) is deleted, not an Event B booking
**Business Rule**: `findOldestUserBookingExcludingEvent` prefers pruning a booking for a different event; same-event fallback triggers seat burn
**Suggested Layer**: API

---

### TC-104: Booking status is always "confirmed"
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has any booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the status badge
**Expected Results**: Badge shows "confirmed"; no other status value is ever displayed
**Business Rule**: `status` defaults to `"confirmed"` at create time; no status transitions exist
**Suggested Layer**: E2E

---

### TC-105: Refund spinner displays for approximately 4 seconds
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Check eligibility for refund?"
2. Time how long the spinner is visible before the result appears
**Expected Results**: Spinner visible for ~4 seconds (4000ms setTimeout), then replaced by result
**Business Rule**: `setTimeout(..., 4000)` — hardcoded client-side delay before revealing outcome
**Suggested Layer**: E2E

---

### TC-106: Refund check result matches quantity boundary exactly
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has one booking with quantity = 1, another with quantity = 2
**Steps**:
1. Check refund eligibility on the quantity-1 booking → expect eligible
2. Check refund eligibility on the quantity-2 booking → expect ineligible
**Expected Results**: Boundary at qty=1 is eligible; qty=2 is the first ineligible value
**Business Rule**: `quantity === 1` is the only eligible value (strict equality)
**Suggested Layer**: E2E

---

### TC-107: Cancel booking removes it from list immediately
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a booking
**Steps**:
1. Note the booking ref
2. Cancel via `/bookings/:id`
3. Return to `/bookings`
**Expected Results**: The cancelled booking no longer appears in the list
**Business Rule**: Cancel deletes the DB record; React Query refetch updates the list
**Suggested Layer**: E2E

---

### TC-108: Clear all bookings works across all user bookings at once
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" and confirm
**Expected Results**: All 9 bookings deleted; empty state shown; no pagination visible
**Business Rule**: `deleteAllForUser` removes all bookings in a single DB operation regardless of count
**Suggested Layer**: E2E

---

## Security (TC-200 – TC-299)

### TC-201: Cross-user booking access shows "Access Denied" in UI
**Category**: Security
**Priority**: P0
**Preconditions**: User A and User B both have accounts; User A has a booking with ID X
**Steps**:
1. Login as User A, note a booking ID
2. Log out (clear `localStorage`)
3. Login as User B
4. Navigate directly to `/bookings/:userA_booking_id`
**Expected Results**: Page shows "Access Denied" title and "You are not authorized to view this booking." description; "View My Bookings" button is present
**Business Rule**: `booking.userId !== userId` → 403 Forbidden; UI renders Access Denied on HTTP 403
**Suggested Layer**: E2E

---

### TC-202: Cross-user cancel via API returns 403
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking with ID X; User B is authenticated
**Steps**:
1. Login as User B and capture JWT token
2. Send `DELETE /api/bookings/:userA_booking_id` with User B's Authorization header
**Expected Results**: HTTP 403 response; booking still exists in DB
**Business Rule**: `cancelBooking` checks `booking.userId !== userId` and throws `ForbiddenError`
**Suggested Layer**: API

---

### TC-203: Unauthenticated access to /bookings redirects to login
**Category**: Security
**Priority**: P0
**Preconditions**: No JWT in localStorage (logged out)
**Steps**:
1. Navigate directly to `/bookings`
**Expected Results**: Redirected to `/login`
**Business Rule**: Frontend auth state guard and backend Bearer token requirement
**Suggested Layer**: E2E

---

### TC-204: Unauthenticated access to /bookings/:id redirects to login
**Category**: Security
**Priority**: P0
**Preconditions**: No JWT in localStorage (logged out)
**Steps**:
1. Navigate directly to `/bookings/1`
**Expected Results**: Redirected to `/login`
**Business Rule**: All booking endpoints require valid Bearer token
**Suggested Layer**: E2E

---

### TC-205: Clear all via API only affects requester's bookings
**Category**: Security
**Priority**: P1
**Preconditions**: User A and User B both have bookings
**Steps**:
1. Send `DELETE /api/bookings` (clear all) with User B's token
2. Query User A's bookings via User A's token
**Expected Results**: User A's bookings are unaffected; only User B's bookings are deleted
**Business Rule**: `deleteAllForUser(userId)` is scoped to the authenticated user's `userId`
**Suggested Layer**: API

---

## Negative / Error (TC-300 – TC-399)

### TC-301: Navigate to non-existent booking ID shows "Booking not found"
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Navigate to `/bookings/99999` (ID that does not exist)
**Expected Results**: Page shows "Booking not found" and "This booking doesn't exist or may have been cancelled."; "View My Bookings" button present
**Business Rule**: `getBookingById` throws `NotFoundError`; UI maps non-403 errors to the not-found state
**Suggested Layer**: E2E

---

### TC-302: Clear all when user has no bookings
**Category**: Negative
**Priority**: P2
**Preconditions**: User has zero bookings
**Steps**:
1. Navigate to `/bookings` (empty state)
2. Click "Clear all bookings"
3. Confirm
**Expected Results**: No error; empty state remains; API returns `{ deleted: 0 }`
**Business Rule**: `deleteAllForUser` with no matching records returns count=0 without error
**Suggested Layer**: E2E

---

### TC-303: Navigate to booking after it has been cancelled
**Category**: Negative
**Priority**: P1
**Preconditions**: User has just cancelled booking ID X
**Steps**:
1. Cancel booking X
2. Navigate directly to `/bookings/:X`
**Expected Results**: "Booking not found" page — not a crash or stale data display
**Business Rule**: Cancel deletes the record; subsequent GET returns 404
**Suggested Layer**: E2E

---

### TC-304: API cancel of non-existent booking returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `DELETE /api/bookings/99999` with a valid token
**Expected Results**: HTTP 404 with message `"Booking with id 99999 not found"`
**Business Rule**: `cancelBooking` throws `NotFoundError` when no booking record found
**Suggested Layer**: API

---

## Edge Cases (TC-400 – TC-499)

### TC-401: Book maximum quantity (10 tickets)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is on an event detail page with ≥10 seats available for this user
**Steps**:
1. Increment ticket count to 10 using the "+" button
2. Fill customer form and confirm
**Expected Results**: Booking created with quantity=10; total price = event price × 10; refund eligibility shows "Not eligible"
**Business Rule**: Quantity max is 10; `totalPrice = price × quantity`
**Suggested Layer**: E2E

---

### TC-402: Refund eligibility at exact boundary quantity = 2
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has a booking with quantity = 2
**Steps**:
1. Navigate to the booking detail for quantity=2
2. Check refund eligibility
**Expected Results**: Shows "Not eligible" — "Group bookings (2 tickets) are non-refundable"
**Business Rule**: Only quantity === 1 is eligible; 2 is the first ineligible value
**Suggested Layer**: E2E

---

### TC-403: Cancel the only remaining booking results in empty state
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has exactly one booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Cancel the booking
**Expected Results**: Redirected to `/bookings`; empty state ("No bookings yet") shown; no pagination
**Business Rule**: Empty state renders when `bookings.length === 0` after refetch
**Suggested Layer**: E2E

---

### TC-404: 9 bookings fill page 1 with no pagination
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has exactly 9 bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: All 9 booking cards visible on page 1; no pagination controls rendered
**Business Rule**: `totalPages = Math.ceil(9 / 10) = 1`; pagination only renders when `totalPages > 1`
**Suggested Layer**: E2E

---

### TC-405: Multiple bookings for the same user-created event
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has created their own event with sufficient seats
**Steps**:
1. Book the user-created event
2. Book the same event again
3. Navigate to `/bookings`
**Expected Results**: Two separate booking cards for the same event, each with a unique booking ref
**Business Rule**: Same user can book the same dynamic event multiple times; seats are computed per-user
**Suggested Layer**: E2E

---

### TC-406: FIFO same-event fallback permanently burns a seat
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 9 bookings all for the same Event A
**Steps**:
1. Record available seats on Event A
2. Create a 10th booking for Event A (triggers pruning)
3. Check available seats on Event A again
**Expected Results**: Oldest booking is pruned; a seat is permanently decremented via `decrementSeats` to compensate for the fact that the same event's booking was pruned
**Business Rule**: `sameEventFallback` path in `createBooking` calls `eventRepository.decrementSeats` to prevent seat count inflation
**Suggested Layer**: API

---

### TC-407: Rapid successive bookings produce unique refs
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User creates multiple bookings for events starting with the same letter
**Steps**:
1. Create 5+ bookings for events all starting with "T" in quick succession
**Expected Results**: All booking refs are unique; each in format `T-[6_ALPHANUMERIC]`
**Business Rule**: `generateUniqueRef` retries up to 10 times on collision; falls back to timestamp-based ref
**Suggested Layer**: API

---

## UI State (TC-500 – TC-599)

### TC-501: Empty state displays when user has no bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: User has zero bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: Empty state shows "No bookings yet" title, descriptive text, ticket icon, and "Browse Events" button linking to `/events`
**Business Rule**: `bookings.length === 0` renders the `<EmptyState>` component
**Suggested Layer**: E2E

---

### TC-502: Loading skeleton displays while bookings fetch
**Category**: UI State
**Priority**: P2
**Preconditions**: User is logged in (observe initial render)
**Steps**:
1. Navigate to `/bookings` and observe state before data loads
**Expected Results**: 5 `BookingCardSkeleton` placeholder elements visible during `isLoading`; replaced by real cards once data arrives
**Business Rule**: `isLoading` state renders skeleton placeholders to prevent layout shift
**Suggested Layer**: E2E

---

### TC-503: Error state shows Retry button on fetch failure
**Category**: UI State
**Priority**: P2
**Preconditions**: API returns an error on booking fetch
**Steps**:
1. Navigate to `/bookings` while backend returns an error
**Expected Results**: "Couldn't load bookings" with "Failed to connect to the server. Please try again." and a "Retry" button; clicking Retry triggers `refetch()`
**Business Rule**: `isError` renders error empty state
**Suggested Layer**: Component

---

### TC-504: "Clear all bookings" button shows "Clearing…" during operation
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings; clearing is in progress
**Steps**:
1. Click "Clear all bookings" and confirm
2. Observe button text immediately
**Expected Results**: Button text changes to "Clearing…" and is disabled while API call is pending; reverts or list empties after completion
**Business Rule**: `clearing` state flag disables button and changes label to "Clearing…"
**Suggested Layer**: E2E

---

### TC-505: Confirm dialog appears before cancelling a booking
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on `/bookings/:id` for a confirmed booking
**Steps**:
1. Click "Cancel Booking"
2. Observe the dialog without confirming
**Expected Results**: `ConfirmDialog` shows title "Cancel this booking?", description including the booking ref and seat count, "Yes, cancel it" confirm button, and a dismiss/close option
**Business Rule**: Two-step confirmation prevents accidental cancellation
**Suggested Layer**: E2E

---

### TC-506: Closing confirm dialog without confirming preserves booking
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on booking detail page
**Steps**:
1. Click "Cancel Booking"
2. Click the close/dismiss button (not "Yes, cancel it")
**Expected Results**: Dialog closes; user stays on the detail page; booking still exists
**Business Rule**: Dismissing the dialog sets `confirm` state to false without calling the cancel mutation
**Suggested Layer**: E2E

---

### TC-507: Refund states transition correctly: idle → checking → result
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on booking detail page
**Steps**:
1. Verify "Check eligibility for refund?" link is visible (idle state)
2. Click it; verify spinner (`#refund-spinner`) appears immediately (checking state)
3. Wait ~4 seconds; verify result (`#refund-result`) replaces spinner
**Expected Results**: Clean state transitions with no overlap; the "check" link disappears once clicked; spinner disappears once result appears
**Business Rule**: Component state machine: `idle → checking → eligible | ineligible`
**Suggested Layer**: E2E

---

### TC-508: Eligible refund result uses green styling; ineligible uses red
**Category**: UI State
**Priority**: P2
**Preconditions**: User has one single-ticket and one multi-ticket booking
**Steps**:
1. Check refund on single-ticket booking → observe result box color
2. Check refund on multi-ticket booking → observe result box color
**Expected Results**: Eligible: green/emerald result box (`bg-emerald-50`); Ineligible: red result box (`bg-red-50`)
**Business Rule**: Color coding communicates refund outcome without relying on text alone
**Suggested Layer**: E2E

---

### TC-509: Breadcrumb on detail page shows the booking ref
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on any booking detail page
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the breadcrumb navigation at the top
**Expected Results**: Breadcrumb reads "My Bookings / [BOOKING-REF]" with ref in monospace font matching the booking's actual ref
**Business Rule**: Breadcrumb uses `booking.bookingRef` for orientation
**Suggested Layer**: E2E

---

### TC-510: "Access Denied" page has link back to own bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: User B is viewing User A's booking URL (cross-user access)
**Steps**:
1. Navigate to another user's booking URL
2. Observe the error page
**Expected Results**: "Access Denied" heading; "You are not authorized to view this booking."; "View My Bookings" button links to `/bookings`
**Business Rule**: HTTP 403 (`is403` flag) renders the Access Denied variant of `<EmptyState>`; user can recover to their own bookings
**Suggested Layer**: E2E
