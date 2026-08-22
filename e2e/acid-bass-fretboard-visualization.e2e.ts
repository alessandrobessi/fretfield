import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * Acid Bass Intelligence V4 M12 (§29): the bass-target path
 * (CURRENT/NEXT/UPCOMING) overlaid on the fretboard, alongside the existing
 * scale/played-note layers -- see FretCell.svelte's `bass-target-*` classes
 * and scale-practice.svelte.ts's `bassTargetPath` (originally
 * `generatedTargetPath`, generalized 2026-08 -- user-reported bug, not part
 * of the V4 spec -- to also cover manually-authored steps via
 * `manualTargetPath`, so the layer no longer disappears just because Acid
 * Bass is in Manual mode). Deeper logic (exact-MIDI mapping, current/next
 * ordering) is unit-tested directly against the store in
 * scale-practice-generated-target.spec.ts/scale-practice-manual-target.spec.ts;
 * this file only checks the DOM-level wiring, matching this app's "no giant
 * snapshots" testing boundary.
 */
async function openGeneratedLine(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
	await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
	await page.getByRole('button', { name: 'Edit Groove' }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
	await page.getByRole('button', { name: 'Generated', exact: true }).click();
}

test.describe('Acid Bass Intelligence V4: bass-target fretboard layer', () => {
	test('shows a current-target marker once a root/progression is selected in Generated mode', async ({
		page
	}) => {
		await openGeneratedLine(page);

		const current = page.locator('[data-testid^="fret-"].bass-target-current');
		await expect(current).toHaveCount(1);
	});

	test("switching to Manual mode shows the manually-authored pattern's own target instead of nothing", async ({
		page
	}) => {
		await openGeneratedLine(page);
		await expect(page.locator('[data-testid^="fret-"].bass-target-current')).toHaveCount(1);

		await page.getByRole('button', { name: 'Manual', exact: true }).click();

		// Still exactly one marker -- now sourced from the default pattern's
		// own active steps (manualTargetPath) rather than the generated plan.
		// This is the bug this test now guards against: the layer used to be
		// generated-only and vanished the instant Manual mode was selected.
		await expect(page.locator('[data-testid^="fret-"].bass-target-current')).toHaveCount(1);
	});

	test('a played (Live Input) note remains visible alongside the bass-target layer', async ({
		page
	}) => {
		await openGeneratedLine(page);
		await enableFakeInput(page);

		await playNote(page, 261.63); // C4

		// The played note's own layer still shows...
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-just-played/);
		// ...independent of whichever fret the bass-target layer marks.
		await expect(page.locator('[data-testid^="fret-"].bass-target-current')).toHaveCount(1);
	});
});
