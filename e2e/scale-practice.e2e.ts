import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * C major pentatonic (root=C) — C, D, E, G, A. C is reachable at A-string
 * fret 3, D at open D string, Bb (not in the scale) at A-string fret 1 —
 * matching the rest of the suite's existing fret-position conventions.
 *
 * A scale only ever comes from the active progression chord now (there's no
 * standalone manual scale) — `selectScalePractice` picks the I–IV–V
 * progression (chord 1 is the tonic itself, a plain major chord) and
 * explicitly sets chord 1's scale, so `root`/`scale` mean exactly what they
 * meant before this helper existed.
 */

async function selectScalePractice(
	page: import('@playwright/test').Page,
	root: string,
	scale: string
): Promise<void> {
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByLabel('Scale Practice root').selectOption({ label: root });
	await page.getByLabel('Progression').selectOption({ label: 'I–IV–V' });
	// Per-chord scale pickers live in the Band panel's Harmony tab; chord 1 is
	// the active chord by default, so its own picker is already expanded.
	await page.getByRole('button', { name: 'Harmony', exact: true }).click();
	await page.getByLabel('Chord 1 scale').selectOption({ label: scale });
}

test.describe('Scale Practice', () => {
	test('choosing a root and scale highlights every note of the scale, with no metronome running', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		// C is in C major pentatonic.
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
		// Bb is not.
		await expect(page.getByTestId('fret-A-1')).not.toHaveClass(/scale-practice-note/);

		await expect(
			page.locator('.practice-session-bar').getByRole('button', { name: 'Play' })
		).toBeVisible();
	});

	test('the root gets its own color, distinct from the rest of the scale', async ({ page }) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		// C (the root) is in the scale AND gets the root-specific class.
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-root/);

		// D is in the scale but is not the root.
		await expect(page.getByTestId('fret-D-0')).toHaveClass(/scale-practice-note/);
		await expect(page.getByTestId('fret-D-0')).not.toHaveClass(/scale-practice-root/);

		const rootBackground = await page
			.getByTestId('fret-A-3')
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		const nonRootBackground = await page
			.getByTestId('fret-D-0')
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(rootBackground).not.toBe(nonRootBackground);
	});

	test('playing a note highlights it in real time, independent of the metronome', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');
		await enableFakeInput(page);

		await expect(page.getByTestId('fret-A-3')).not.toHaveClass(/scale-practice-just-played/);

		await playNote(page, 261.63); // C4

		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-just-played/);
		// Still in the scale too — the two layers compose.
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
	});

	test('a played note outside the scale is still highlighted as played, without the scale tint', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');
		await enableFakeInput(page);

		await playNote(page, 233.08); // Bb3 — not in C major pentatonic

		await expect(page.getByTestId('fret-A-1')).toHaveClass(/scale-practice-just-played/);
		await expect(page.getByTestId('fret-A-1')).not.toHaveClass(/scale-practice-note/);
	});

	test('Start/Stop only toggles the metronome — the scale highlight is unaffected either way', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);

		const toggle = page.locator('.practice-session-bar .toggle');
		await toggle.click();
		await expect(toggle).toHaveText('Stop');
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);

		await toggle.click();
		await expect(toggle).toHaveText('Play');
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
	});

	test('every fret shows its interval relative to the chosen root alongside the note name', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		// The root itself is labeled "R", not "1" — the app's usual convention elsewhere.
		await expect(page.getByTestId('fret-A-3').locator('.label')).toHaveText('R\nC');
		// The 2nd degree, in the scale.
		await expect(page.getByTestId('fret-D-0').locator('.label')).toHaveText('2/9\nD');
		// Bb (b7) is not in C major pentatonic, but its interval still shows —
		// every fret is labeled, not just the ones in the scale.
		await expect(page.getByTestId('fret-A-1').locator('.label')).toHaveText('b7\nBb');
	});

	test('every note of the scale is shown in bold, distinguishing it from chromatic notes', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		// C is in the scale.
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
		const inScaleWeight = await page
			.getByTestId('fret-A-3')
			.locator('.label')
			.evaluate((el) => getComputedStyle(el).fontWeight);
		// Bb is not in the scale.
		await expect(page.getByTestId('fret-A-1')).not.toHaveClass(/scale-practice-note/);
		const outOfScaleWeight = await page
			.getByTestId('fret-A-1')
			.locator('.label')
			.evaluate((el) => getComputedStyle(el).fontWeight);

		expect(Number(inScaleWeight)).toBeGreaterThan(Number(outOfScaleWeight));
	});

	test('a zone that excludes every note of the scale shows a hint instead of highlighting nothing silently', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		// Past the fretboard entirely — guaranteed zero positions for any scale.
		await page.getByLabel('Zone start fret').fill('21');
		await page.getByLabel('Zone end fret').fill('21');
		await page.getByLabel('Zone end fret').blur();

		await expect(
			page.getByText('No notes of this scale fall inside the chosen zone')
		).toBeVisible();
	});

	test('switching away from the tab while the metronome is running stops it', async ({ page }) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		await page.locator('.practice-session-bar').getByRole('button', { name: 'Play' }).click();
		await expect(
			page.locator('.practice-session-bar').getByRole('button', { name: 'Stop' })
		).toBeVisible();

		await page.getByRole('tab', { name: 'Explore', exact: true }).click();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(
			page.locator('.practice-session-bar').getByRole('button', { name: 'Play' })
		).toBeVisible();
	});
});

test.describe('Scale Practice: live harmonic context', () => {
	test('shows the active chord and scale, and adds a bar position only while running', async ({
		page
	}) => {
		await page.goto('/');
		await selectScalePractice(page, 'C', 'Major Pentatonic');

		const context = page.locator('.harmonic-context');
		await expect(context).toContainText('C');
		await expect(context).toContainText('Major Pentatonic');
		await expect(context).not.toContainText('Bar');

		await page.getByRole('button', { name: 'Drums', exact: true }).click();
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });
		await page.locator('.practice-session-bar').getByRole('button', { name: 'Play' }).click();
		await expect(context).toContainText(/Bar \d+\/\d+/);

		await page.locator('.practice-session-bar').getByRole('button', { name: 'Stop' }).click();
		await expect(context).not.toContainText('Bar');
	});
});
