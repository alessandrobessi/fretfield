import { expect, test } from '@playwright/test';

/**
 * Scale Practice's drum machine (replacing the old single-click metronome —
 * see the "Drum Machine for Scale Practice" plan). No real-audio assertions
 * here, matching this app's existing testing boundary — the prior metronome
 * tests never asserted actual sound either, only UI/state.
 */

/**
 * Navigates to Scale Practice and expands the Groove Editor disclosure --
 * most of these tests exercise progression/genre/arrangement/step-grid
 * controls, which live behind "Edit Groove" and are collapsed by default
 * (see AGENTS.md's compact Practice UI).
 */
async function openScalePractice(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Edit Groove' }).click();
}

test.describe('Drum Machine', () => {
	test('clicking a step cycles off -> ghost -> normal -> accent -> off', async ({ page }) => {
		await openScalePractice(page);

		const step = page.getByLabel('Open Hat step 5', { exact: true });
		await expect(step).toHaveAttribute('aria-pressed', 'false');
		await expect(step).toHaveAttribute('data-velocity', '0');

		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'true');
		await expect(step).toHaveAttribute('data-velocity', '0.35');

		await step.click();
		await expect(step).toHaveAttribute('data-velocity', '0.7');

		await step.click();
		await expect(step).toHaveAttribute('data-velocity', '1');

		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'false');
		await expect(step).toHaveAttribute('data-velocity', '0');
	});

	test('Shift-click jumps straight to accent; Alt-click clears to off', async ({ page }) => {
		await openScalePractice(page);

		const step = page.getByLabel('Open Hat step 5', { exact: true });
		await step.click({ modifiers: ['Shift'] });
		await expect(step).toHaveAttribute('data-velocity', '1');

		await step.click({ modifiers: ['Alt'] });
		await expect(step).toHaveAttribute('data-velocity', '0');
	});

	test('selecting a genre preset overwrites the whole grid and feel together', async ({ page }) => {
		await openScalePractice(page);

		await expect(page.getByLabel('Feel')).toHaveValue('straight');
		await expect(page.getByLabel('Amount')).toHaveValue('0');
		await page.getByLabel('Groove preset').selectOption({ label: 'Blues Shuffle' });

		await expect(page.getByLabel('Feel')).toHaveValue('shuffle');
		await expect(page.getByLabel('Amount')).toHaveValue('65');
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

	test('feel and tempo survive a reload', async ({ page }) => {
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
		// own equivalent test for the same reasoning). The Groove Editor
		// disclosure itself is plain component state, though, so it collapses
		// again and needs re-opening.
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Edit Groove' }).click();

		await expect(page.getByLabel('Feel')).toHaveValue('swing');
		await expect(page.getByLabel('Amount')).toHaveValue('70');
		await expect(page.getByLabel('Metronome BPM')).toHaveValue('110');
		await expect(page.getByLabel('Ride step 1', { exact: true })).toHaveAttribute(
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
		await page.getByRole('button', { name: 'Edit Groove' }).click();

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
		await page.getByRole('button', { name: 'Edit Groove' }).click();
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

	test("each chord row shows its selected scale's notes next to the picker", async ({ page }) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		const rows = page.locator('.chord-row');
		// Dm7 defaults to D Minor Pentatonic: D F G A C.
		await expect(rows.nth(0).locator('.scale-notes')).toHaveText('D F G A C');

		await page.getByLabel('Chord 1 scale').selectOption({ label: 'Dorian' });
		// D Dorian: D E F G A B C.
		await expect(rows.nth(0).locator('.scale-notes')).toHaveText('D E F G A B C');

		await page.getByLabel('Chord 1 scale').selectOption({ label: '—' });
		await expect(rows.nth(0).locator('.scale-notes')).not.toBeAttached();
	});
});

test.describe('Drum Machine: multi-bar arrangement', () => {
	test('assigning a bar to pattern B switches the grid to editing B, leaving A untouched', async ({
		page
	}) => {
		await openScalePractice(page);

		await page.getByRole('button', { name: 'Add bar' }).click();
		await expect(page.getByLabel('Bar 1 pattern')).toHaveValue('A');
		await expect(page.getByLabel('Bar 2 pattern')).toHaveValue('A');

		await page.getByLabel('Bar 2 pattern').selectOption('B');
		await expect(page.getByRole('button', { name: 'B', exact: true })).toHaveClass(/active/);

		await page.getByLabel('Kick step 3', { exact: true }).click();
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByRole('button', { name: 'A', exact: true }).click();
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	test('Remove bar is disabled at a single bar and re-enabled once grown', async ({ page }) => {
		await openScalePractice(page);

		const removeBar = page.getByRole('button', { name: 'Remove last bar' });
		await expect(removeBar).toBeDisabled();

		await page.getByRole('button', { name: 'Add bar' }).click();
		await expect(removeBar).toBeEnabled();

		await removeBar.click();
		await expect(page.getByLabel('Bar 2 pattern')).not.toBeVisible();
		await expect(removeBar).toBeDisabled();
	});
});

test.describe('Drum Machine: flagship 12-bar blues groove', () => {
	test('choosing the Chicago Shuffle preset builds a 12-bar A/B/F/T arrangement', async ({
		page
	}) => {
		await openScalePractice(page);

		await page
			.getByLabel('Groove preset')
			.selectOption({ label: 'Chicago Shuffle — 12-Bar Blues' });

		await expect(page.getByLabel('Feel')).toHaveValue('shuffle');
		await expect(page.getByLabel('Amount')).toHaveValue('65');
		const expectedRoles = ['A', 'A', 'A', 'B', 'A', 'A', 'B', 'F', 'A', 'B', 'T', 'F'];
		for (let bar = 0; bar < expectedRoles.length; bar++) {
			await expect(page.getByLabel(`Bar ${bar + 1} pattern`)).toHaveValue(expectedRoles[bar]);
		}
		await expect(page.getByLabel('Bar 13 pattern')).not.toBeVisible();
	});

	test('paired with the 12-Bar Dominant Blues progression at 1 bar/chord, each arrangement bar shows its chord', async ({
		page
	}) => {
		await openScalePractice(page);
		await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
		await page
			.getByLabel('Groove preset')
			.selectOption({ label: 'Chicago Shuffle — 12-Bar Blues' });
		await page.getByLabel('Progression').selectOption({ label: '12-Bar Dominant Blues' });
		await page.getByLabel('Bars per chord').fill('1');
		await page.keyboard.press('Tab');

		const expectedChords = ['C7', 'F7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7'];
		for (let bar = 0; bar < expectedChords.length; bar++) {
			await expect(page.locator('.arrangement-strip .bar-chord').nth(bar)).toHaveText(
				expectedChords[bar]
			);
		}
	});
});

test.describe('Drum Machine: Feel + Intensity', () => {
	test('Amount is disabled when Feel is Straight, enabled otherwise', async ({ page }) => {
		await openScalePractice(page);

		await expect(page.getByLabel('Feel')).toHaveValue('straight');
		await expect(page.getByLabel('Amount')).toBeDisabled();

		await page.getByLabel('Feel').selectOption('shuffle');
		await expect(page.getByLabel('Amount')).toBeEnabled();
	});

	test('Intensity persists across a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Intensity').fill('40');
		await page.keyboard.press('Tab');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByLabel('Intensity')).toHaveValue('40');
	});
});

test.describe('Drum Machine: time signature', () => {
	test('changing the time signature resizes the step grid', async ({ page }) => {
		await openScalePractice(page);

		const kickSteps = page.getByRole('group', { name: 'Kick steps' }).locator('.step');
		await expect(kickSteps).toHaveCount(16);

		await page.getByLabel('Time Signature').selectOption('12/8');
		await expect(kickSteps).toHaveCount(24);

		await page.getByLabel('Time Signature').selectOption('3/4');
		await expect(kickSteps).toHaveCount(12);

		await page.getByLabel('Time Signature').selectOption('5/4');
		await expect(kickSteps).toHaveCount(20);
	});

	test('beat-start dividers land every 4 steps for a simple meter, every 6 for a compound one', async ({
		page
	}) => {
		await openScalePractice(page);

		// 4/4 (simple, default): dividers at steps 1, 5, 9, 13.
		for (const step of [1, 5, 9, 13]) {
			await expect(page.getByLabel(`Kick step ${step}`, { exact: true })).toHaveClass(/beat-start/);
		}
		await expect(page.getByLabel('Kick step 2', { exact: true })).not.toHaveClass(/beat-start/);

		await page.getByLabel('Time Signature').selectOption('12/8');
		// 12/8 (compound): dividers at steps 1, 7, 13, 19.
		for (const step of [1, 7, 13, 19]) {
			await expect(page.getByLabel(`Kick step ${step}`, { exact: true })).toHaveClass(/beat-start/);
		}
		await expect(page.getByLabel('Kick step 5', { exact: true })).not.toHaveClass(/beat-start/);
	});

	test('Amount disables for a compound meter regardless of Feel, and re-enables when the meter goes back to simple', async ({
		page
	}) => {
		await openScalePractice(page);

		await page.getByLabel('Feel').selectOption('shuffle');
		await expect(page.getByLabel('Amount')).toBeEnabled();

		await page.getByLabel('Time Signature').selectOption('12/8');
		await expect(page.getByLabel('Amount')).toBeDisabled();
		await expect(page.getByLabel('Amount')).toHaveAttribute(
			'title',
			"12/8 already has its own compound feel -- swing doesn't apply"
		);

		await page.getByLabel('Time Signature').selectOption('3/4');
		await expect(page.getByLabel('Amount')).toBeEnabled();
	});

	test('the chosen time signature and its resized grid survive a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Kick step 3', { exact: true }).click();
		await page.getByLabel('Time Signature').selectOption('5/4');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Edit Groove' }).click();

		await expect(page.getByLabel('Time Signature')).toHaveValue('5/4');
		await expect(page.getByRole('group', { name: 'Kick steps' }).locator('.step')).toHaveCount(20);
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('choosing a genre preset keeps the current time signature instead of resetting to 4/4', async ({
		page
	}) => {
		await openScalePractice(page);

		await page.getByLabel('Time Signature').selectOption('3/4');
		const kickSteps = page.getByRole('group', { name: 'Kick steps' }).locator('.step');
		await expect(kickSteps).toHaveCount(12);

		await page.getByLabel('Groove preset').selectOption({ label: 'Jazz Swing' });

		await expect(page.getByLabel('Time Signature')).toHaveValue('3/4');
		await expect(kickSteps).toHaveCount(12);
		await expect(page.getByLabel('Feel')).toHaveValue('swing');
	});
});

test.describe('Drum Machine: compact Practice UI', () => {
	test('the Groove Editor (progression/genre/arrangement/step grid) is collapsed by default, and toggles open/closed', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		// Always visible: transport/feel/intensity, not the editing surface.
		await expect(page.getByLabel('Metronome BPM')).toBeVisible();
		await expect(page.getByLabel('Feel')).toBeVisible();
		await expect(page.getByLabel('Intensity')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		await expect(page.getByLabel('Progression')).not.toBeVisible();
		await expect(page.getByLabel('Groove preset')).not.toBeVisible();
		await expect(page.getByLabel('Kick step 1', { exact: true })).not.toBeVisible();

		const toggle = page.getByRole('button', { name: 'Edit Groove' });
		await toggle.click();
		await expect(page.getByLabel('Progression')).toBeVisible();
		await expect(page.getByLabel('Groove preset')).toBeVisible();
		await expect(page.getByLabel('Kick step 1', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Hide Groove Editor' }).click();
		await expect(page.getByLabel('Progression')).not.toBeVisible();
	});

	test('the compact row shows which pattern and bar is currently playing', async ({ page }) => {
		await openScalePractice(page);
		await page
			.getByLabel('Groove preset')
			.selectOption({ label: 'Chicago Shuffle — 12-Bar Blues' });
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });

		const readout = page.locator('.pattern-readout');
		await expect(readout).toHaveText('Pattern A');

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(readout).toHaveText(/Pattern \w.*Bar \d+\/12/);

		await page.getByRole('button', { name: 'Stop' }).click();
	});
});
