# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users can browse events, book tickets, manage bookings, and create events. Each user operates in an isolated sandbox.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5
- **Backend**: Express.js, Prisma ORM, MySQL 8+
- **Auth**: JWT (7-day expiry), bcryptjs — stored in `localStorage` as `eventhub_token`
- **Testing**: Playwright E2E (Chromium only)

## Project Structure
```
eventhub/
├── frontend/          # Next.js 14 app (port 3000)
│   ├── app/           # Pages (App Router)
│   ├── components/    # React components
│   ├── lib/           # API clients, hooks, providers
│   └── types/         # TypeScript interfaces
├── backend/           # Express API (port 3001)
│   ├── src/
│   │   ├── routes/        # HTTP endpoints
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access (Prisma)
│   │   ├── validators/     # Input validation
│   │   └── middleware/     # Auth, error handling
│   └── prisma/            # Schema + seed
├── tests/             # Playwright E2E tests
├── .claude/
│   └── skills/        # Skill documents (domain knowledge + test standards)
└── playwright.config.ts
```

## Architecture Pattern
Backend follows layered architecture: Routes → Controllers → Services → Repositories → Database

Frontend uses `apiClient` (`frontend/lib/api/client.ts`) for all HTTP calls, with React Query hooks in `frontend/lib/hooks/` wrapping those calls.

## Commands
```bash
npm run dev          # Start frontend + backend concurrently
npm run setup        # Install all dependencies
npm run seed         # Seed 10 static events
npm run migrate      # Run Prisma migrations (dev)
npm run db:push      # Push schema changes without migration
npm run build        # Build frontend
npm run lint         # Lint frontend
npm run test         # Run all Playwright tests (against hosted URL)
npm run test:ui      # Playwright with UI mode
npm run test:report  # Open last HTML test report
npx playwright test tests/<file>.spec.js --reporter=line  # Run single test file
```

## Testing Conventions
- Tests run against the **hosted app** at `https://eventhub.rahulshettyacademy.com`, not localhost — no local server needed
- Test files go in `tests/` as `<feature-name>.spec.js`
- Follow guidelines in `.claude/skills/playwright-best-practices`
- Locator priority: data-testid > role > label/placeholder > ID > CSS class
- No `page.waitForTimeout()` — use `expect().toBeVisible()`
- Tests must be self-contained (login → action → assert)
- Use test accounts: `rahulshetty1@gmail.com` / `Magiclife1!`

## Data Models (Prisma)
Three models in `backend/prisma/schema.prisma`:
- **User** — `id`, `email`, `password`, has many Events and Bookings
- **Event** — `id`, `title`, `category`, `venue`, `city`, `eventDate`, `price`, `totalSeats`, `availableSeats`, `isStatic` (true = seeded/immutable), `userId` (null for static events)
- **Booking** — `id`, `eventId`, `userId`, `customerName`, `customerEmail`, `customerPhone`, `quantity`, `totalPrice`, `status` (default `"confirmed"`), `bookingRef`

## Key Business Rules
- Max 6 user-created events per user (FIFO pruning on overflow)
- Max 9 bookings per user (FIFO pruning on overflow)
- Booking ref first character = event title first character (uppercase)
- `availableSeats` shown to a user = global `availableSeats` minus that user's already-booked quantity for the event (computed in `eventService.withPersonalSeats`)
- Seat count reduces on booking, restores on cancellation
- Refund eligibility: 1 ticket = eligible, >1 tickets = not eligible (client-side logic)
- Cross-user booking access returns "Access Denied"
- Static events (`isStatic: true`) are immutable — seeded via `npm run seed`

## Custom Skills (Slash Commands)
- `/generate-tests <feature>` — AI Test Automation Engineer: generates Playwright tests
- `/review-tests <file>` — AI Code Reviewer: reviews test code quality
- `/create-scenarios <area>` — AI Functional Tester: creates test scenario documents
- `/test-strategy <scenarios>` — AI Test Architect: assigns tests to optimal pyramid layers

## Skill Documents
- `.claude/skills/playwright-best-practices` — Playwright testing standards
- `.claude/skills/eventhub-domain` — Domain knowledge and business rules

## Code Style
- Backend: JavaScript with JSDoc, Express patterns
- Frontend: TypeScript, React hooks, Tailwind utility classes
- Tests: JavaScript with Playwright test runner
- Use meaningful variable names, add step comments in tests
- Keep functions focused and single-responsibility
