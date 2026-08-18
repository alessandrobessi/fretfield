import { expect, test } from '@playwright/test';

/**
 * Block 1: C Ionian (Major) — C, D, E, F, G, A, B.
 * Block 2: F# Locrian — F#, G, A, B, D, E (our Locrian definition omits the 5th).
 *
 * Chosen so the overlap is genuinely partial, not identical or nested:
 *   C, F           -> block 1 only
 *   F#              -> block 2 only
 *   G, A, B, D, E   -> both
 *   Bb              -> neither
 */

async function addBlock(
	page: import('@playwright/test').Page,
	index: number,
	root: string,
	chord: string,
	scale: string
): Promise<void> {
	await page.getByRole('button', { name: 'Add block' }).click();
	await page.getByLabel(`Block ${index} root`).selectOption({ label: root });
	await page.getByLabel(`Block ${index} chord`).selectOption({ label: chord });
	await page.getByLabel(`Block ${index} scale`).selectOption({ label: scale });
}

test.describe('Scale Blocks', () => {
	test('one block highlights every fret in its scale, nothing else', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();

		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');

		// C is in C Ionian.
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();
		// Bb is not.
		await expect(page.getByTestId('fret-A-1').locator('[data-block="0"]')).not.toBeVisible();

		await expect(page.locator('.scale-block-legend')).toContainText('C');
		await expect(page.locator('.scale-block-legend')).toContainText('Ionian');

		// A single block has nothing to be "common" with.
		await expect(page.locator('.scale-block-common-notes')).toHaveCount(0);
	});

	test('a second block shows exclusive and overlapping chips correctly', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();

		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');
		await addBlock(page, 2, 'F#', 'Diminished', 'Locrian');

		// C: block 1 only.
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();
		await expect(page.getByTestId('fret-A-3').locator('[data-block="1"]')).not.toBeVisible();

		// F (E string fret 1): block 1 only.
		await expect(page.getByTestId('fret-E-1').locator('[data-block="0"]')).toBeVisible();
		await expect(page.getByTestId('fret-E-1').locator('[data-block="1"]')).not.toBeVisible();

		// F# (E string fret 2): block 2 only.
		await expect(page.getByTestId('fret-E-2').locator('[data-block="0"]')).not.toBeVisible();
		await expect(page.getByTestId('fret-E-2').locator('[data-block="1"]')).toBeVisible();

		// G (open G string): in both.
		await expect(page.getByTestId('fret-G-0').locator('[data-block="0"]')).toBeVisible();
		await expect(page.getByTestId('fret-G-0').locator('[data-block="1"]')).toBeVisible();

		// Bb (A string fret 1): in neither.
		await expect(page.getByTestId('fret-A-1').locator('[data-block="0"]')).not.toBeVisible();
		await expect(page.getByTestId('fret-A-1').locator('[data-block="1"]')).not.toBeVisible();
	});

	test('notes common to every configured block are shown in the legend and on the fretboard', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();

		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');
		await addBlock(page, 2, 'F#', 'Diminished', 'Locrian');

		const commonNotes = page.locator('.scale-block-common-notes');
		await expect(commonNotes).toContainText('Common to every block');
		for (const note of ['G', 'A', 'B', 'D', 'E']) {
			await expect(commonNotes).toContainText(note);
		}

		// G, A: in both blocks' scales.
		await expect(page.getByTestId('fret-G-0')).toHaveClass(/scale-block-common/);
		await expect(page.getByTestId('fret-A-0')).toHaveClass(/scale-block-common/);

		// C: block 1 only, not common to both.
		await expect(page.getByTestId('fret-A-3')).not.toHaveClass(/scale-block-common/);
		// F#: block 2 only, not common to both.
		await expect(page.getByTestId('fret-E-2')).not.toHaveClass(/scale-block-common/);
	});

	test('removing a block clears its chips and its row', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();

		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();

		await page.getByRole('button', { name: 'Remove block 1' }).click();

		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).not.toBeVisible();
		await expect(page.getByLabel('Block 1 root')).toHaveCount(0);
	});

	test('configured blocks persist across mode switches', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();
		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');

		await page.getByRole('tab', { name: 'Chord' }).click();
		await page.getByRole('tab', { name: 'Scale Blocks' }).click();

		await expect(page.getByLabel('Block 1 root')).toHaveValue(/./);
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();
		await expect(page.locator('.scale-block-legend')).toContainText('Ionian');
	});
});
