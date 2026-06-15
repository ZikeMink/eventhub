import { test, expect } from '@playwright/test';

const BASE_URL      = 'https://eventhub.rahulshettyacademy.com';
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

async function clearBookings(page) {
  await page.goto(`${BASE_URL}/bookings`);
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (alreadyEmpty) return;
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

/**
 * Books the first available event with the given quantity.
 * Returns { bookingRef, eventTitle }.
 * Precondition: user must be logged in.
 */
async function bookEventWithQuantity(page, quantity = 1) {
  await page.goto(`${BASE_URL}/events`);

  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();

  const eventTitle = (await firstCard.locator('h3').textContent())?.trim() ?? '';
  console.log(`Booking event: "${eventTitle}" — quantity: ${quantity}`);

  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  // Increment quantity beyond 1 by clicking "+" (quantity - 1) times
  if (quantity > 1) {
    const incrementBtn = page.getByRole('button', { name: '+' });
    await expect(incrementBtn).toBeVisible();
    for (let i = 1; i < quantity; i++) {
      await incrementBtn.click();
    }
    await expect(page.locator('#ticket-count')).toHaveText(String(quantity));
  }

  await page.getByLabel('Full Name').fill('Test User');
  await page.locator('#customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('.confirm-booking-btn').click();

  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  console.log(`Booking confirmed. Ref: ${bookingRef}`);
  return { bookingRef, eventTitle };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Booking Flow — Happy Paths', () => {

  // TC-005 ───────────────────────────────────────────────────────────────────
  test('TC-005: single-ticket booking shows refund-eligible result', async ({ page }) => {
    // -- Step 1: Login, clear state, book 1 ticket (default quantity) --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEventWithQuantity(page, 1);

    // -- Step 2: Navigate to booking detail via bookings list --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click the refund check button --
    await expect(page.locator('#check-refund-btn')).toBeVisible();
    await page.locator('#check-refund-btn').click();

    // -- Step 4: Spinner must appear immediately --
    await expect(page.locator('#refund-spinner')).toBeVisible();

    // -- Step 5: Wait for spinner to resolve (≤6s covers the 4s setTimeout) --
    await expect(page.locator('#refund-spinner')).not.toBeVisible({ timeout: 6000 });

    // -- Step 6: Assert eligible result with correct message --
    const result = page.locator('#refund-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Eligible for refund');
    await expect(result).toContainText('Single-ticket bookings qualify for a full refund');
  });

  // TC-006 ───────────────────────────────────────────────────────────────────
  test('TC-006: multi-ticket booking shows refund-ineligible result with quantity in message', async ({ page }) => {
    // -- Step 1: Login, clear state, book 2 tickets --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEventWithQuantity(page, 2);

    // -- Step 2: Navigate to booking detail via bookings list --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click the refund check button --
    await expect(page.locator('#check-refund-btn')).toBeVisible();
    await page.locator('#check-refund-btn').click();

    // -- Step 4: Spinner must appear immediately --
    await expect(page.locator('#refund-spinner')).toBeVisible();

    // -- Step 5: Wait for spinner to resolve --
    await expect(page.locator('#refund-spinner')).not.toBeVisible({ timeout: 6000 });

    // -- Step 6: Assert ineligible result mentions exact ticket count --
    const result = page.locator('#refund-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Not eligible for refund');
    await expect(result).toContainText('2 tickets');
    await expect(result).toContainText('non-refundable');
  });

  // TC-007 ───────────────────────────────────────────────────────────────────
  test('TC-007: navigate from bookings list to detail page and back', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEventWithQuantity(page, 1);

    // -- Step 2: Navigate to /bookings list --
    await page.goto(`${BASE_URL}/bookings`);
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);

    // -- Step 3: Click View Details on the booking card --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: 'View Details' }).click();

    // -- Step 4: Verify URL changed to detail page --
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 5: Verify breadcrumb contains the booking ref --
    const breadcrumbRef = page.locator('nav span.font-mono');
    await expect(breadcrumbRef).toContainText(bookingRef);

    // -- Step 6: Click "← Back to My Bookings" --
    await page.getByRole('link', { name: /back to my bookings/i }).click();

    // -- Step 7: Verify return to /bookings list --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
  });

});
