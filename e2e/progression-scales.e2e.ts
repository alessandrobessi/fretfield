import { expect, test } from '@playwright/test';

/**
 * C major ii-V-I: Dm7 -> G7 -> Cmaj7. Family-suggested defaults:
 *   Dm7   (minor)    -> D Minor Pentatonic  (D, F, G, A, C)
 *   G7    (dominant) -> G Mixolydian        (G, A, B, C, D, E, F)
 *   Cmaj7 (major)    -> C Major Pentatonic  (C, D, E, G, A)
 *
 * C (A string fret 3) is in all three -> the "common note" case.
 * F (E string fret 1) is in Dm7 + G7's defaults but not Cmaj7's.
 * E (G string fret 9) is not in Dm7's default (minor pentatonic has no 2nd)
 * but is in D Dorian -> used to verify overriding a chord's scale.
 */

async function setUpProgression(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByTestId('fret-A-3').click(); // root C
	await page.getByRole('tab', { name: /^Progression/ }).click();
	await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
	await page.getByRole('tab', { name: 'Scales', exact: true }).click();
}

test.describe('Progression Scales', () => {
	test('each chord gets a family-suggested default scale', async ({ page }) => {
		await setUpProgression(page);

		await expect(page.getByLabel('Chord 1 scale')).toHaveValue('minor-pentatonic');
		await expect(page.getByLabel('Chord 2 scale')).toHaveValue('mixolydian');
		await expect(page.getByLabel('Chord 3 scale')).toHaveValue('major-pentatonic');
	});

	test('a note common to every chord default is highlighted for all three blocks', async ({
		page
	}) => {
		await setUpProgression(page);

		const cFret = page.getByTestId('fret-A-3');
		await expect(cFret.locator('[data-block="0"]')).toBeVisible();
		await expect(cFret.locator('[data-block="1"]')).toBeVisible();
		await expect(cFret.locator('[data-block="2"]')).toBeVisible();
		await expect(cFret).toHaveClass(/scale-block-common/);
		await expect(page.locator('text=Common to every chord')).toBeVisible();
	});

	test('a note in only some chord defaults is highlighted only for those blocks', async ({
		page
	}) => {
		await setUpProgression(page);

		const fFret = page.getByTestId('fret-E-1');
		await expect(fFret.locator('[data-block="0"]')).toBeVisible();
		await expect(fFret.locator('[data-block="1"]')).toBeVisible();
		await expect(fFret.locator('[data-block="2"]')).not.toBeVisible();
		await expect(fFret).not.toHaveClass(/scale-block-common/);
	});

	test('overriding a chord scale changes what that block highlights', async ({ page }) => {
		await setUpProgression(page);

		const eFret = page.getByTestId('fret-G-9');
		await expect(eFret.locator('[data-block="0"]')).not.toBeVisible();

		await page.getByLabel('Chord 1 scale').selectOption({ label: 'Dorian' });

		await expect(eFret.locator('[data-block="0"]')).toBeVisible();
	});

	test('with no progression chosen yet, the lens explains what to do first', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByRole('tab', { name: 'Scales', exact: true }).click();

		await expect(
			page.getByText('Choose a root and a progression to see suggested scales per chord.')
		).toBeVisible();
	});
});
