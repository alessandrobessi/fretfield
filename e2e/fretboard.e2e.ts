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
