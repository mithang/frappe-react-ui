import { test, expect } from '@playwright/test';
import { BENCH_ORIGIN } from '../playwright.config';

/**
 * Wave 0 exit gate: login -> read -> write, same-site cross-origin against a live bench.
 * This is the one test in the suite that must run against a real container — it's the only
 * way to catch the CSRF/cookie/CORS failure class the plan's defect inventory is built on.
 */
test.describe('login -> read -> write (same-site cross-origin)', () => {
  test('authenticates, reads a real list, and writes a new document', async ({ page }) => {
    const request = page.request; // shares the browser's session cookie, unlike the bare `request` fixture
    await page.goto('/');

    await page.getByPlaceholder('https://your-instance.erpnext.com').fill(BENCH_ORIGIN);
    await page.getByPlaceholder('Enter your username').fill('Administrator');
    await page.getByPlaceholder('••••••••').fill('admin');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Authenticated shell should replace the login form. Don't assert on the sign-in button
    // disappearing — its own label changes to "Authenticating..." the instant isLoading flips,
    // which makes a name-based lookup a false positive before the login call even resolves.
    await expect(page.getByText('Workspace Overview')).toBeVisible({ timeout: 15_000 });

    // --- read: a real list of users, not fabricated data ---
    await page.goto('/doctype/User');
    await expect(page.getByText('Administrator', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // --- write: create a ToDo through the real form + save path ---
    const marker = `e2e-write-check-${Date.now()}`;
    await page.goto('/doctype/ToDo/new');
    await page.getByPlaceholder('Enter description').fill(marker);
    await page.locator('form').getByRole('button', { name: 'Create' }).click();

    // Success is judged against the server, not a toast — a toast can lie, the record can't.
    await expect(async () => {
      const res = await request.post(`${BENCH_ORIGIN}/api/method/frappe.client.get_list`, {
        headers: { Origin: 'http://app.localtest.me:5173', 'Content-Type': 'application/json' },
        data: { doctype: 'ToDo', filters: { description: marker } },
      });
      const body = await res.json();
      expect(body.message?.length ?? 0).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });

    // Clean up what this test wrote so re-runs stay idempotent.
    const list = await request.post(`${BENCH_ORIGIN}/api/method/frappe.client.get_list`, {
      headers: { Origin: 'http://app.localtest.me:5173', 'Content-Type': 'application/json' },
      data: { doctype: 'ToDo', filters: { description: marker } },
    });
    const { message: rows } = await list.json();
    for (const row of rows ?? []) {
      await request.post(`${BENCH_ORIGIN}/api/method/frappe.client.delete`, {
        headers: { Origin: 'http://app.localtest.me:5173', 'Content-Type': 'application/json' },
        data: { doctype: 'ToDo', name: row.name },
      });
    }
  });
});
