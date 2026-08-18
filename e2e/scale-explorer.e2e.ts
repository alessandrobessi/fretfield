import { expect, test } from '@playwright/test';

/**
 * C major pentatonic (root=C) — C, D, E, G, A, matching the fret-position
 * conventions the rest of the suite already uses (C at A-string fret 3, Bb
 * at A-string fret 1, not in the scale).
 */

async function selectScale(
	page: import('@playwright/test').Page,
	root: string,
	scale: string
): Promise<void> {
	await page.getByRole('tab', { name: 'Scale Explorer' }).click();
	await page.getByLabel('Scale root').selectOption({ label: root });
	await page.getByLabel('Scale', { exact: true }).selectOption({ label: scale });
}

test.describe('Scale Explorer', () => {
	test('choosing a root and scale highlights every matching fret, independent of any chord', async ({
		page
	}) => {
		await page.goto('/');
		await selectScale(page, 'C', 'Major Pentatonic');

		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();
		await expect(page.getByTestId('fret-A-1').locator('[data-block="0"]')).not.toBeVisible();
	});

	test('with no root/scale chosen yet, an empty-state hint explains what to do', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Explorer' }).click();

		await expect(
			page.getByText('Choose a root and a scale to see it highlighted on the neck.')
		).toBeVisible();
	});

	test('a single scale has no "common note" callout — that only applies with several overlays', async ({
		page
	}) => {
		await page.goto('/');
		await selectScale(page, 'C', 'Major Pentatonic');

		await expect(page.getByTestId('fret-A-3')).not.toHaveClass(/scale-block-common/);
	});
});
