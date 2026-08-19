import { expect, test } from '@playwright/test';

/**
 * Runs only at tablet-portrait and phone-portrait (see playwright.config.ts)
 * — a smoke check that the M8 responsive fixes hold at the roadmap's own
 * highest-emphasis viewport (tablet, alongside a bass + interface) and its
 * narrowest realistic target, not a full re-run of the desktop suite.
 */

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
	return page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
}

test.describe('Responsive smoke: Explore -> Progression -> Scales', () => {
	test('setting a root/chord and browsing the Scales lens fits without horizontal overflow', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click();
		await expect(page.getByTestId('fret-A-3')).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await page.getByRole('tab', { name: 'Scales', exact: true }).click();

		await expect(page.getByText('Common to every chord:')).toBeVisible();
		expect(await hasHorizontalOverflow(page)).toBe(false);

		await page.getByRole('button', { name: /Settings/ }).click();
		await expect(page.getByRole('radio', { name: 'Intervals' })).toBeVisible();
		expect(await hasHorizontalOverflow(page)).toBe(false);
	});
});

test.describe('Responsive smoke: Practice presets', () => {
	test('opening a preset from Practice home fits without horizontal overflow', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await expect(page.getByText('Pick something to practice.')).toBeVisible();
		expect(await hasHorizontalOverflow(page)).toBe(false);

		await page.getByRole('button', { name: /^Presets/ }).click();
		await expect(page.getByRole('button', { name: /^Find the Thirds/ })).toBeVisible();
		expect(await hasHorizontalOverflow(page)).toBe(false);

		await page.getByRole('button', { name: /^Find the Sevenths/ }).click();
		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.guided-practice .prompt')).toContainText('Find b7');
		expect(await hasHorizontalOverflow(page)).toBe(false);
	});
});
