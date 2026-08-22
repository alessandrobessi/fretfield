import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * Acid Bass Intelligence V4 M12 (§29): the generated-target path
 * (CURRENT/NEXT/UPCOMING) overlaid on the fretboard, alongside the existing
 * scale/played-note layers -- see FretCell.svelte's `generated-*` classes
 * and scale-practice.svelte.ts's `generatedTargetPath`. Deeper logic
 * (exact-MIDI mapping, current/next ordering) is unit-tested directly
 * against the store in scale-practice-generated-target.spec.ts; this file
 * only checks the DOM-level wiring, matching this app's "no giant
 * snapshots" testing boundary.
 */
async function openGeneratedLine(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
	await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
	await page.getByRole('button', { name: 'Bass', exact: true }).click();
	await page.getByRole('button', { name: 'Generated', exact: true }).click();
}

test.describe('Acid Bass Intelligence V4: generated-target fretboard layer', () => {
	test('shows a current-target marker once a root/progression is selected in Generated mode', async ({
		page
	}) => {
		await openGeneratedLine(page);

		const current = page.locator('[data-testid^="fret-"].generated-current');
		await expect(current).toHaveCount(1);
	});

	test('is absent entirely in Manual mode', async ({ page }) => {
		await openGeneratedLine(page);
		await expect(page.locator('[data-testid^="fret-"].generated-current')).toHaveCount(1);

		await page.getByRole('button', { name: 'Manual', exact: true }).click();

		await expect(page.locator('[data-testid^="fret-"].generated-current')).toHaveCount(0);
		await expect(page.locator('[data-testid^="fret-"].generated-next')).toHaveCount(0);
		await expect(page.locator('[data-testid^="fret-"].generated-upcoming')).toHaveCount(0);
		await expect(page.locator('[data-testid^="fret-"].generated-alternative')).toHaveCount(0);
	});

	test('a played (Live Input) note remains visible alongside the generated-target layer', async ({
		page
	}) => {
		await openGeneratedLine(page);
		await enableFakeInput(page);

		await playNote(page, 261.63); // C4

		// The played note's own layer still shows...
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-just-played/);
		// ...independent of whichever fret the generated-target layer marks.
		await expect(page.locator('[data-testid^="fret-"].generated-current')).toHaveCount(1);
	});
});
