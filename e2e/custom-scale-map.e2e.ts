import { expect, test } from '@playwright/test';

/**
 * Custom Scale Map is the manual multi-block editor, reached as an advanced
 * escape hatch nested inside Explore -> Progression -> Scales (not its own
 * top-level tab — see FieldModeSwitcher.svelte / ProgressionScales.svelte's
 * "Open Custom Scale Map" button).
 *
 * Block 1: C Ionian (Major) — C, D, E, F, G, A, B.
 * Block 2: F# Locrian — F#, G, A, B, D, E (our Locrian definition omits the 5th).
 *
 * Chosen so the overlap is genuinely partial, not identical or nested:
 *   C, F           -> block 1 only
 *   F#              -> block 2 only
 *   G, A, B, D, E   -> both
 *   Bb              -> neither
 */

// Deliberately does NOT call page.goto() itself — a caller re-navigating
// back into Custom Scale Map after switching away (see the "persist across
// mode switches" test below) must not reload the page, since that would
// wipe chordBlocks' in-memory, session-only state along with it.
async function navigateToCustomScaleMap(page: import('@playwright/test').Page): Promise<void> {
	await page.getByRole('tab', { name: /^Progression/ }).click();
	await page.getByRole('tab', { name: 'Scales', exact: true }).click();
	await page.getByRole('button', { name: 'Open Custom Scale Map' }).click();
}

async function openCustomScaleMap(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await navigateToCustomScaleMap(page);
}

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

test.describe('Custom Scale Map', () => {
	test('is reachable from Progression -> Scales even with no progression configured yet', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByRole('tab', { name: 'Scales', exact: true }).click();

		await expect(
			page.getByText('Choose a root and a progression to see suggested scales per chord.')
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Open Custom Scale Map' })).toBeVisible();

		await page.getByRole('button', { name: 'Open Custom Scale Map' }).click();

		await expect(page.getByRole('button', { name: 'Add block' })).toBeVisible();
		await expect(page.getByRole('button', { name: '← Back to suggested scales' })).toBeVisible();
	});

	test('one block highlights every fret in its scale, nothing else', async ({ page }) => {
		await openCustomScaleMap(page);

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
		await openCustomScaleMap(page);

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
		await openCustomScaleMap(page);

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
		await openCustomScaleMap(page);

		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();

		await page.getByRole('button', { name: 'Remove block 1' }).click();

		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).not.toBeVisible();
		await expect(page.getByLabel('Block 1 root')).toHaveCount(0);
	});

	test('configured blocks persist across mode switches', async ({ page }) => {
		await openCustomScaleMap(page);
		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');

		// chordBlocks state itself is session-only but mode-independent; mode
		// (unlike chordBlocks) gets clobbered by switching to Chord and back,
		// so re-entry has to redo the whole nested sequence, not one tab click
		// — but must NOT reload the page, or chordBlocks itself would be wiped.
		await page.getByRole('tab', { name: 'Chord' }).click();
		await navigateToCustomScaleMap(page);

		await expect(page.getByLabel('Block 1 root')).toHaveValue(/./);
		await expect(page.getByTestId('fret-A-3').locator('[data-block="0"]')).toBeVisible();
		await expect(page.locator('.scale-block-legend')).toContainText('Ionian');
	});

	test('the "← Back to suggested scales" button returns to the auto-suggested Scales lens', async ({
		page
	}) => {
		await openCustomScaleMap(page);
		await addBlock(page, 1, 'C', 'Major', 'Major (Ionian)');

		await page.getByRole('button', { name: '← Back to suggested scales' }).click();

		await expect(page.getByRole('button', { name: 'Add block' })).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Open Custom Scale Map' })).toBeVisible();
		// Custom Scale Map's own configured blocks don't leak into the
		// auto-suggested view — they're independent engines sharing only the
		// underlying chip/highlight machinery, not the same block list.
		await expect(page.getByText('Choose a root and a progression')).toBeVisible();
	});

	test('inspecting a fret while browsing the auto-suggested Scales lens does not throw and shows the correct block', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await page.getByRole('tab', { name: 'Scales', exact: true }).click();

		// C major ii-V-I's first chord (Dm7) defaults to D Minor Pentatonic,
		// which contains C -- inspecting it must read progressionScaleBlocks,
		// not the (empty, unrelated) manual chordBlocks list.
		await page.getByTestId('fret-A-3').click();

		await expect(page.locator('.note-inspector')).toContainText('In block 1');
		await expect(page.locator('.note-inspector')).toContainText('Dm7');
		await expect(page.locator('.note-inspector')).toContainText('Minor Pentatonic');
	});
});
