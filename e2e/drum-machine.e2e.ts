import { expect, test } from '@playwright/test';

/**
 * Scale Practice's drum machine (replacing the old single-click metronome —
 * see the "Drum Machine for Scale Practice" plan). No real-audio assertions
 * here, matching this app's existing testing boundary — the prior metronome
 * tests never asserted actual sound either, only UI/state.
 */

async function openScalePractice(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
}

test.describe('Drum Machine', () => {
	test('toggling a step updates the grid', async ({ page }) => {
		await openScalePractice(page);

		const step = page.getByLabel('Open Hat step 5', { exact: true });
		await expect(step).toHaveAttribute('aria-pressed', 'false');
		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'true');
		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'false');
	});

	test('selecting a genre preset overwrites the whole grid and swing together', async ({
		page
	}) => {
		await openScalePractice(page);

		await expect(page.getByLabel('Swing')).toHaveValue('0');
		await page.getByLabel('Groove preset').selectOption({ label: 'Blues Shuffle' });

		await expect(page.getByLabel('Swing')).toHaveValue('65');
		await expect(page.getByLabel('Kick step 1', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByLabel('Kick step 9', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByLabel('Snare step 5', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('swing and tempo survive a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Groove preset').selectOption({ label: 'Jazz Swing' });
		// fill() only dispatches an 'input' event; the store's onchange handler
		// needs a real 'change' (fired on blur/commit), so move focus away
		// before reloading -- otherwise the typed BPM never gets persisted.
		await page.getByLabel('Metronome BPM').fill('110');
		await page.keyboard.press('Tab');

		await page.reload();
		// destination ('practice') and fretfield.mode ('scale-practice') both
		// persist, so ScalePracticeSession renders directly on reload -- no
		// "Scales" card to click through again (see Local Practice Persistence's
		// own equivalent test for the same reasoning).
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByLabel('Swing')).toHaveValue('70');
		await expect(page.getByLabel('Metronome BPM')).toHaveValue('110');
		await expect(page.getByLabel('Open Hat step 1', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('Start/Stop toggles the drum machine', async ({ page }) => {
		await openScalePractice(page);
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });

		const toggle = page.getByRole('button', { name: 'Play' });
		await toggle.click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
		await expect(page.getByText(/♩ = \d+/)).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('a count-in plays before the tempo readout appears, and Stop cancels it', async ({
		page
	}) => {
		await openScalePractice(page);
		await expect(page.getByLabel('Count-in')).toHaveValue('1-bar');

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByText('Count-in…')).toBeVisible();
		await expect(page.getByText(/♩ = \d+/)).not.toBeVisible();

		await expect(page.getByText(/♩ = \d+/)).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('Count-in…')).not.toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('save a custom groove and reload it via My Grooves', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Kick step 3', { exact: true }).click();

		await page.getByRole('button', { name: 'Save as…', exact: true }).click();
		await page.getByLabel('Groove name').fill('E2E Test Groove');
		await page.locator('.drum-machine').getByRole('button', { name: 'Save', exact: true }).click();

		await expect(page.getByRole('button', { name: 'E2E Test Groove', exact: true })).toBeVisible();

		// Switch to a curated preset, then load the saved groove back.
		await page.getByLabel('Groove preset').selectOption({ label: 'Funk' });
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);

		await page.getByRole('button', { name: 'E2E Test Groove', exact: true }).click();
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByRole('button', { name: 'Delete E2E Test Groove' }).click();
		await expect(
			page.getByRole('button', { name: 'E2E Test Groove', exact: true })
		).not.toBeVisible();
	});
});

test.describe('Drum Machine: chord-progression backing', () => {
	test('a chosen progression and bars-per-chord survive a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		// fill() only dispatches an 'input' event; the store's onchange handler
		// needs a real 'change' (fired on blur/commit), so move focus away
		// before reloading -- same gotcha as the BPM field above.
		await page.getByLabel('Bars per chord').fill('1');
		await page.keyboard.press('Tab');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByLabel('Progression')).toHaveValue('major-ii-v-i');
		await expect(page.getByLabel('Bars per chord')).toHaveValue('1');
	});

	test('choosing "None" turns the chord backing off', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await expect(page.getByLabel('Progression')).toHaveValue('major-ii-v-i');

		await page.getByLabel('Progression').selectOption({ label: 'Choose a progression…' });
		await expect(page.getByLabel('Progression')).toHaveValue('');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await expect(page.getByLabel('Progression')).toHaveValue('');
	});

	test('playback advances the highlighted chord and freezes on it when stopped', async ({
		page
	}) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		// A fast tempo, one bar per chord, and no count-in keeps the wait for
		// the first highlight change short and deterministic.
		await page.getByLabel('Metronome BPM').fill('240');
		await page.getByLabel('Bars per chord').fill('1');
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });
		await page.keyboard.press('Tab');

		const strip = page.locator('.chord-strip');
		await expect(strip.locator('.chord-chip')).toHaveCount(3);
		// Chord 1 previews as soon as the progression is picked, before Play.
		await expect(strip.locator('.chord-chip.active')).toHaveText('Dm7');

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(strip.locator('.chord-chip.active')).toHaveText('G7', { timeout: 2000 });

		await page.getByRole('button', { name: 'Stop' }).click();
		// Frozen on the last-sounding chord, not cleared.
		await expect(strip.locator('.chord-chip.active')).toHaveCount(1);
		await expect(strip.locator('.chord-chip.active')).toHaveText('G7');
	});
});

test.describe('Drum Machine: per-chord scales', () => {
	test("picking a progression immediately previews chord 1's suggested scale, before any Play", async ({
		page
	}) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		// Chord 1 is Dm7 -- its suggested default is D Minor Pentatonic, so the
		// root marker moves to D even though playback never started.
		await expect(page.getByTestId('fret-D-0')).toHaveClass(/scale-practice-root/);
		await expect(page.getByTestId('fret-D-0').locator('.label')).toContainText('R');
		await expect(page.locator('.chord-strip .chord-chip.active')).toHaveText('Dm7');
	});

	test('clicking a chord row moves the fretboard preview to that chord', async ({ page }) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		await page.locator('.chord-strip').getByRole('button', { name: 'G7', exact: true }).click();

		await expect(page.getByTestId('fret-G-0')).toHaveClass(/scale-practice-root/);
		await expect(page.locator('.chord-strip .chord-chip.active')).toHaveText('G7');
	});

	test("changing a chord's scale changes what's highlighted for it", async ({ page }) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		// Chord 1 (Dm7) defaults to D Minor Pentatonic, which excludes E.
		await expect(page.getByTestId('fret-E-0')).not.toHaveClass(/scale-practice-note/);

		await page.getByLabel('Chord 1 scale').selectOption({ label: 'Dorian' });

		// D Dorian includes E as its 2nd degree.
		await expect(page.getByTestId('fret-E-0')).toHaveClass(/scale-practice-note/);
	});
});
