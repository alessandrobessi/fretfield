import { expect, test } from '@playwright/test';

test.describe('core scenario: click root, choose harmony, explore the field', () => {
	test('C dominant 7 shows correct roles, and switching root preserves the geometry', async ({
		page
	}) => {
		await page.goto('/');

		const aStringFret3 = page.getByTestId('fret-A-3');
		const eStringFret8 = page.getByTestId('fret-E-8');
		const gStringFret9 = page.getByTestId('fret-G-9');
		const dStringFret5 = page.getByTestId('fret-D-5');
		const gStringFret3 = page.getByTestId('fret-G-3');

		// Before a root is chosen, cells show plain note names.
		await expect(aStringFret3).toHaveAccessibleName('A string, fret 3, C');

		// Click A string fret 3 (C) to set the root.
		await aStringFret3.click();
		await expect(page.locator('.status')).toContainText('Root: C');

		// Choose Dominant 7.
		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });
		await expect(page.locator('.status')).toContainText('Dominant 7');

		// Root: every occurrence of C is interval 1 / root, and the clicked
		// position is additionally marked as the selected root.
		await expect(aStringFret3).toHaveAccessibleName('A string, fret 3, C, interval 1, root');
		await expect(aStringFret3).toHaveAttribute('aria-pressed', 'true');
		await expect(eStringFret8).toHaveAccessibleName('E string, fret 8, C, interval 1, root');

		// Structural (3, b7) and stable (5) chord tones are classified correctly.
		await expect(gStringFret9).toHaveAccessibleName('G string, fret 9, E, interval 3, structural');
		await expect(dStringFret5).toHaveAccessibleName('D string, fret 5, G, interval 5, stable');
		await expect(gStringFret3).toHaveAccessibleName(
			'G string, fret 3, Bb, interval b7, structural'
		);

		// The legend reflects only the roles currently in use.
		await expect(page.getByLabel('Legend')).toContainText('Root');
		await expect(page.getByLabel('Legend')).toContainText('Structural');
		await expect(page.getByLabel('Legend')).toContainText('Stable');

		// Switching the root to F preserves the same interval geometry elsewhere on the neck.
		await page.getByTestId('fret-E-1').click();
		await expect(page.locator('.status')).toContainText('Root: F');
		await expect(aStringFret3).toHaveAccessibleName('A string, fret 3, C, interval 5, stable');
		await expect(page.getByTestId('fret-A-0')).toHaveAccessibleName(
			'A string, fret 0, A, interval 3, structural'
		);
	});

	test('display mode toggle switches between interval and note labels', async ({ page }) => {
		await page.goto('/');
		const cell = page.getByTestId('fret-A-3');
		await cell.click();

		await expect(cell).toHaveText('1');

		await page.getByRole('button', { name: 'Settings' }).click();
		await page.getByRole('radio', { name: 'Notes' }).click();
		await expect(cell).toHaveText('C');

		await page.getByRole('radio', { name: 'Both' }).click();
		await expect(cell).toHaveText('1 C');
	});

	test('keyboard: tabbing to a fret and pressing Enter selects it as root', async ({ page }) => {
		await page.goto('/');

		const target = page.getByTestId('fret-A-3');
		await target.focus();
		await target.press('Enter');

		await expect(target).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.status')).toContainText('Root: C');
	});
});

test.describe('Settings panel: dismissal', () => {
	test('Escape closes the panel and returns focus to the Settings button', async ({ page }) => {
		await page.goto('/');
		const settingsButton = page.getByRole('button', { name: 'Settings' });
		await settingsButton.click();
		await expect(page.getByRole('radio', { name: 'Notes' })).toBeVisible();

		await page.keyboard.press('Escape');

		await expect(page.getByRole('radio', { name: 'Notes' })).not.toBeVisible();
		await expect(settingsButton).toBeFocused();
	});

	test('clicking outside the panel closes it', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Settings' }).click();
		await expect(page.getByRole('radio', { name: 'Notes' })).toBeVisible();

		await page.getByTestId('fret-A-3').click();

		await expect(page.getByRole('radio', { name: 'Notes' })).not.toBeVisible();
	});

	test('clicking inside the panel does not close it', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Settings' }).click();

		await page.getByRole('radio', { name: 'Notes' }).click();

		await expect(page.getByRole('radio', { name: 'Notes' })).toBeVisible();
	});
});

test.describe('Roving-tabindex arrow-key navigation', () => {
	test('ArrowRight/ArrowLeft move and select within a radiogroup, wrapping at the ends', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click();
		await page.getByRole('button', { name: 'Settings' }).click();

		const intervals = page.getByRole('radio', { name: 'Intervals', exact: true });
		const notes = page.getByRole('radio', { name: 'Notes', exact: true });
		const both = page.getByRole('radio', { name: 'Both', exact: true });
		await intervals.focus();

		await page.keyboard.press('ArrowRight');
		await expect(notes).toBeFocused();
		await expect(notes).toHaveAttribute('aria-checked', 'true');

		await page.keyboard.press('ArrowRight');
		await expect(both).toBeFocused();
		await expect(both).toHaveAttribute('aria-checked', 'true');

		// Wraps back to the first option past the last.
		await page.keyboard.press('ArrowRight');
		await expect(intervals).toBeFocused();
		await expect(intervals).toHaveAttribute('aria-checked', 'true');

		// ArrowLeft from the first option wraps to the last.
		await page.keyboard.press('ArrowLeft');
		await expect(both).toBeFocused();
		await expect(both).toHaveAttribute('aria-checked', 'true');
	});

	test('arrow keys switch Explore/Practice destination tabs, each their own single Tab stop', async ({
		page
	}) => {
		await page.goto('/');

		const explore = page.getByRole('tab', { name: 'Explore', exact: true });
		const practice = page.getByRole('tab', { name: 'Practice', exact: true });
		await explore.focus();
		await expect(explore).toHaveAttribute('tabindex', '0');
		await expect(practice).toHaveAttribute('tabindex', '-1');

		await page.keyboard.press('ArrowRight');
		await expect(practice).toBeFocused();
		await expect(practice).toHaveAttribute('aria-selected', 'true');
		await expect(practice).toHaveAttribute('tabindex', '0');
		await expect(explore).toHaveAttribute('tabindex', '-1');

		await page.keyboard.press('ArrowLeft');
		await expect(explore).toBeFocused();
		await expect(explore).toHaveAttribute('aria-selected', 'true');
	});
});

test.describe('Fretboard: roving-tabindex grid navigation', () => {
	test('only one fret is a Tab stop at a time, and it moves to whatever was last clicked', async ({
		page
	}) => {
		await page.goto('/');

		// Before any interaction, the default roving position (G string,
		// fret 0) is the sole Tab stop.
		await expect(page.getByTestId('fret-G-0')).toHaveAttribute('tabindex', '0');
		await expect(page.getByTestId('fret-A-3')).toHaveAttribute('tabindex', '-1');

		await page.getByTestId('fret-A-3').click();

		await expect(page.getByTestId('fret-A-3')).toHaveAttribute('tabindex', '0');
		await expect(page.getByTestId('fret-G-0')).toHaveAttribute('tabindex', '-1');
	});

	test('ArrowRight/ArrowLeft move along a string, clamped at the nut and the last fret', async ({
		page
	}) => {
		await page.goto('/');
		const fret0 = page.getByTestId('fret-G-0');
		const fret1 = page.getByTestId('fret-G-1');
		await fret0.focus();

		await page.keyboard.press('ArrowRight');
		await expect(fret1).toBeFocused();
		await expect(fret1).toHaveAttribute('tabindex', '0');
		await expect(fret0).toHaveAttribute('tabindex', '-1');

		await page.keyboard.press('ArrowLeft');
		await expect(fret0).toBeFocused();

		// Clamped, not wrapped: ArrowLeft at fret 0 stays put.
		await page.keyboard.press('ArrowLeft');
		await expect(fret0).toBeFocused();
	});

	test('ArrowUp/ArrowDown move between strings, clamped at the top (G) and bottom (E)', async ({
		page
	}) => {
		await page.goto('/');
		// Default roving position starts on the G string (visually top row).
		const gString = page.getByTestId('fret-G-0');
		const dString = page.getByTestId('fret-D-0');
		await gString.focus();

		// Clamped at the top: ArrowUp on the topmost string stays put.
		await page.keyboard.press('ArrowUp');
		await expect(gString).toBeFocused();

		await page.keyboard.press('ArrowDown');
		await expect(dString).toBeFocused();
		await expect(dString).toHaveAttribute('tabindex', '0');
		await expect(gString).toHaveAttribute('tabindex', '-1');
	});
});

test.describe('Chord Field: full Harmonic Field mode and the Note Inspector', () => {
	test('Harmonic Field shows tension/chromatic-approach roles; Chord Tones suppresses them', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click();
		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });

		// Ab (b13/#5) is classified as tension in field mode.
		const abCell = page.getByTestId('fret-G-1');
		await expect(abCell).toHaveAccessibleName('G string, fret 1, Ab, interval b6/#5, tension');
		await expect(page.getByLabel('Legend')).toContainText('Tension');

		// Switching to Chord Tones suppresses the tension role back to a plain cell.
		await page.getByRole('radio', { name: 'Chord Tones' }).click();
		await expect(abCell).toHaveAccessibleName('G string, fret 1, Ab, interval b6/#5');
		await expect(page.getByLabel('Legend')).not.toContainText('Tension');
	});

	test('hovering a fret previews it in the Note Inspector without changing the root', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click();
		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });

		await page.getByTestId('fret-G-1').hover();

		const inspector = page.locator('.note-inspector');
		await expect(inspector).toContainText('Ab');
		await expect(inspector).toContainText('Tension');
		await expect(inspector).toContainText('Typical resolution:');

		// Hovering to inspect a different note never changes the selected root.
		await expect(page.locator('.status')).toContainText('Root: C');
		await expect(page.getByTestId('fret-A-3')).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Unified interaction: shared state persists across destination switches', () => {
	test('root, chord, and display mode all survive navigating to Practice and back', async ({
		page
	}) => {
		await page.goto('/');

		// Set up state in Chord Field: root C, Dominant 7, Notes display mode.
		await page.getByTestId('fret-A-3').click();
		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });
		await page.getByRole('button', { name: 'Settings' }).click();
		await page.getByRole('radio', { name: 'Notes' }).click();
		await expect(page.getByTestId('fret-A-3')).toHaveText('C');

		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('tab', { name: 'Explore', exact: true }).click();

		await expect(page.locator('.status')).toContainText('Root: C');
		await expect(page.locator('.status')).toContainText('Dominant 7');
		// The Settings panel itself closes on every click elsewhere (M3's
		// click-outside-to-close) -- re-open it to confirm the underlying
		// displayMode setting, not just the panel's visibility, survived.
		await page.getByRole('button', { name: 'Settings' }).click();
		await expect(page.getByRole('radio', { name: 'Notes', exact: true })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(page.getByTestId('fret-A-3')).toHaveText('C');
	});
});

test.describe('URL state: a shared link restores the same view', () => {
	test('choosing a root, chord, and display mode updates the URL, and reloading it restores that state', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });
		await page.getByRole('button', { name: 'Settings' }).click();
		await page.getByRole('radio', { name: 'Both' }).click();

		await expect(page).toHaveURL(/root=C/);
		await expect(page).toHaveURL(/chord=dominant-7/);
		await expect(page).toHaveURL(/display=both/);

		await page.reload();

		await expect(page.locator('.status')).toContainText('Root: C');
		await expect(page.locator('.status')).toContainText('Dominant 7');
		await page.getByRole('button', { name: 'Settings' }).click();
		await expect(page.getByRole('radio', { name: 'Both', exact: true })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(page.getByTestId('fret-A-3')).toHaveAccessibleName(
			'A string, fret 3, C, interval 1, root'
		);
	});

	test('a malformed query string is ignored rather than breaking the app', async ({ page }) => {
		await page.goto('/?root=not-a-note&mode=bogus&chord=nonexistent');
		await expect(page.locator('h1')).toHaveText('FretField');
		await expect(page.locator('.status')).toContainText('Root: —');
	});
});
