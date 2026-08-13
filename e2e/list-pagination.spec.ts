import { test, expect } from '@playwright/test';
import { BENCH_ORIGIN } from '../playwright.config';

/**
 * Wave 2B exit criterion, verified live: "pagination advances to page 2 on a >20-row doctype;
 * columns come from in_list_view and show real values." `DocType` has 800+ rows on a stock
 * bench (ERPNext + Frappe's own doctypes) — a reliable >20-row fixture without creating data.
 */
test('list pagination advances past page 1 with real in_list_view columns', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('https://your-instance.erpnext.com').fill(BENCH_ORIGIN);
  await page.getByPlaceholder('Enter your username').fill('Administrator');
  await page.getByPlaceholder('••••••••').fill('admin');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('Workspace Overview')).toBeVisible({ timeout: 15_000 });

  await page.goto('/doctype/DocType');
  await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible({ timeout: 15_000 });

  // A real column value, not a blank/"-" placeholder — proves in_list_view fields beyond
  // name/creation/modified are actually being fetched now (C4), not just declared.
  const firstRowModified = await page.locator('table tbody tr').first().locator('td').nth(2).textContent();
  expect(firstRowModified?.trim()).not.toBe('-');
  expect(firstRowModified?.trim()).not.toBe('');

  const firstPageNames = await page.locator('table tbody tr td:nth-child(2)').allTextContents();

  // Exact match — the sidebar's real "ERPNext Settings" workspace name substring-matches "Next"
  // too now that it's populated with live data instead of being empty.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible({ timeout: 15_000 });

  const secondPageNames = await page.locator('table tbody tr td:nth-child(2)').allTextContents();
  // Page 2 must show DIFFERENT rows — the old bug (`total = data.length`) made "Next" a no-op
  // in practice once the UI trusted total, or otherwise never got here since totalPages was wrong.
  expect(secondPageNames).not.toEqual(firstPageNames);
});
