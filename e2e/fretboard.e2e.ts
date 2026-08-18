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

test.describe('Progression Field: resolved chords and transition-aware inspector', () => {
	test('C major ii-V-I resolves to Dm7 -> G7 -> Cmaj7, and F resolves to E into the next chord', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Progression Field' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		const strip = page.locator('.chords');
		await expect(strip).toContainText('Dm7');
		await expect(strip).toContainText('G7');
		await expect(strip).toContainText('Cmaj7');

		// Dm7 starts active.
		await expect(page.getByRole('button', { name: 'Dm7', exact: true })).toHaveAttribute(
			'aria-current',
			'true'
		);

		// Advance to G7 and confirm F (its b7) resolves to E (3 of Cmaj7), a half-step down.
		await page.getByRole('button', { name: 'G7', exact: true }).click();
		await expect(page.getByRole('button', { name: 'G7', exact: true })).toHaveAttribute(
			'aria-current',
			'true'
		);

		await page.getByTestId('fret-E-1').hover(); // E string, fret 1 = F
		const inspector = page.locator('.note-inspector');
		await expect(inspector).toContainText('F');
		await expect(inspector).toContainText('Best target:');
		await expect(inspector).toContainText('E');
		await expect(inspector).toContainText('Movement: -1 semitone');
	});
});

test.describe('Voice-Leading Paths: ranked paths and fretboard path markers', () => {
	test('selecting the top path marks its current step on the fretboard and advances with the chord', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Voice-Leading Paths' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		const paths = page.locator('.paths');
		await expect(paths.locator('.path')).toHaveCount(3);
		await expect(paths.locator('.path').first()).toHaveAttribute('aria-current', 'true');

		// Dm7 is active; the path's first step (E, open E string) is marked "current".
		await expect(page.getByTestId('fret-E-0')).toHaveAttribute('data-path-role', 'current');

		// Advance to G7: the path's second step (F, E string fret 1) becomes "current",
		// and the first step (E) becomes "previous".
		await page.getByRole('button', { name: 'G7', exact: true }).click();
		await expect(page.getByTestId('fret-E-1')).toHaveAttribute('data-path-role', 'current');
		await expect(page.getByTestId('fret-E-0')).toHaveAttribute('data-path-role', 'previous');
	});
});

test.describe('Local Fields: region navigator and neck ruler', () => {
	test('anchoring a region dims the fretboard outside it, and the ruler reflects the active region', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Local Fields' }).click();
		await page.getByRole('button', { name: 'Anchor to root' }).click();

		await expect(page.getByTestId('fret-A-3')).toHaveClass(/region-active/);
		// A fret far outside the anchored region should be dimmed.
		await expect(page.getByTestId('fret-A-20')).toHaveClass(/region-dimmed/);

		const ruler = page.locator('.neck-ruler');
		await expect(ruler.locator('.region-bracket')).toBeVisible();

		await page.getByRole('button', { name: 'Show overlap' }).click();
		await expect(ruler.locator('.overlap-bar')).toHaveCount(9);
		await expect(ruler.locator('.overlap-bar.active')).toHaveCount(1);
	});

	test('a custom fret range sets the region directly, independent of the suggested-region cycle', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Local Fields' }).click();

		await page.getByLabel('Position start fret').fill('7');
		await page.getByLabel('Position end fret').fill('11');
		await page.getByLabel('Position end fret').blur();

		await expect(page.getByTestId('fret-A-9')).toHaveClass(/region-active/);
		await expect(page.getByTestId('fret-A-20')).toHaveClass(/region-dimmed/);
		await expect(page.locator('.summary .range')).toHaveText('Frets 7–11');
	});
});

test.describe('Unified interaction: shared state persists across mode switches', () => {
	test('root, progression, region, and display mode all survive switching between every tab', async ({
		page
	}) => {
		await page.goto('/');

		// Set up state in Chord Field: root C, Notes display mode.
		await page.getByTestId('fret-A-3').click();
		await page.getByRole('button', { name: 'Settings' }).click();
		await page.getByRole('radio', { name: 'Notes' }).click();
		await expect(page.getByTestId('fret-A-3')).toHaveText('C');

		// Progression Field: pick a template.
		await page.getByRole('tab', { name: 'Progression Field' }).click();
		await expect(page.locator('.status')).toContainText('Tonic: C');
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await expect(page.locator('.chords')).toContainText('Dm7');
		// Display mode carried over from Chord Field: shows the plain note name "E", not
		// its interval over Dm7 (which would read "2/9").
		await expect(page.getByTestId('fret-E-0')).toHaveText('E');

		// Voice-Leading Paths: same progression is already selected (shared state, not re-chosen).
		await page.getByRole('tab', { name: 'Voice-Leading Paths' }).click();
		await expect(page.locator('.chords')).toContainText('Dm7');
		await expect(page.locator('.paths .path')).toHaveCount(3);

		// Local Fields: anchor a region.
		await page.getByRole('tab', { name: 'Local Fields' }).click();
		await page.getByRole('button', { name: 'Anchor to root' }).click();
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/region-active/);

		// Back to Chord Field: root, chord, display mode, and the region lens are all still active.
		await page.getByRole('tab', { name: 'Chord Field' }).click();
		await expect(page.locator('.status')).toContainText('Root: C');
		await expect(page.getByRole('radio', { name: 'Notes', exact: true })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/region-active/);

		// And the progression template chosen back in Progression Field is still selected there.
		await page.getByRole('tab', { name: 'Progression Field' }).click();
		await expect(page.locator('.chords')).toContainText('Dm7');
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
