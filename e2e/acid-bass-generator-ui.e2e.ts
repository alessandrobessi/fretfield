import { expect, test } from '@playwright/test';

/**
 * Acid Bass Intelligence V4 M11: the generation controls (Style/Harmony/
 * Register/Density/Chromatic/Movement/Playability/Intelligence/New
 * Variation) and the generated bar selector + step inspector, all living in
 * Groove Editor's "Bass Steps" tab (co-located with the pattern content
 * itself, not a disconnected panel). No real-audio assertions, matching
 * this app's existing testing boundary -- only UI/state.
 */

async function openGeneratedLine(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
	await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
	await page.getByRole('button', { name: 'Editor', exact: true }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
	await page.getByRole('button', { name: 'Generated', exact: true }).click();
}

test.describe('Acid Bass Intelligence V4: LINE controls', () => {
	test('Style, Harmony, and Register pickers select independently', async ({ page }) => {
		await openGeneratedLine(page);

		const style = page.getByRole('group', { name: 'Style', exact: true });
		await expect(style.getByRole('button', { name: 'Acid', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await style.getByRole('button', { name: 'Walking', exact: true }).click();
		await expect(style.getByRole('button', { name: 'Walking', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(style.getByRole('button', { name: 'Acid', exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);

		const harmony = page.getByRole('group', { name: 'Harmony', exact: true });
		await expect(harmony.getByRole('button', { name: 'Chord', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await harmony.getByRole('button', { name: 'Voice Lead', exact: true }).click();
		await expect(harmony.getByRole('button', { name: 'Voice Lead', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		const register = page.getByRole('group', { name: 'Register', exact: true });
		await expect(register.getByRole('button', { name: 'Zone', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await register.getByRole('button', { name: 'Low', exact: true }).click();
		await expect(register.getByRole('button', { name: 'Low', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('the five generation knobs (Density/Chromatic/Movement/Playability/Intelligence) update state', async ({
		page
	}) => {
		await openGeneratedLine(page);

		const density = page.getByRole('slider', { name: 'Density' });
		await density.focus();
		await density.press('Home');
		for (let i = 0; i < 3; i++) {
			await density.press('PageUp');
		}
		await expect(density).toHaveAttribute('aria-valuenow', '30');

		const intelligence = page.getByRole('slider', { name: 'Intelligence' });
		await intelligence.focus();
		await intelligence.press('End');
		await expect(intelligence).toHaveAttribute('aria-valuenow', '100');
	});

	test('generation settings survive a reload', async ({ page }) => {
		await openGeneratedLine(page);
		await page
			.getByRole('group', { name: 'Style', exact: true })
			.getByRole('button', { name: 'Melodic', exact: true })
			.click();

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
		await expect(
			page
				.getByRole('group', { name: 'Style', exact: true })
				.getByRole('button', { name: 'Melodic', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Acid Bass Intelligence V4: generation unavailable messaging', () => {
	test('explains why generation is unavailable when no root/progression is selected', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
		await page.getByRole('button', { name: 'Generated', exact: true }).click();

		await expect(
			page.getByText('Choose a root and progression above to generate a bassline.')
		).toBeVisible();
	});
});

test.describe('Acid Bass Intelligence V4: generated bar selector and step inspector', () => {
	test('New Variation changes the generated line without throwing', async ({ page }) => {
		await openGeneratedLine(page);

		const stepGrid = page.getByRole('group', { name: /^Bar 1 steps$/ });
		await expect(stepGrid).toBeVisible();
		const before = await stepGrid.innerText();

		await page.getByRole('button', { name: 'New Variation' }).click();
		await expect(stepGrid).toBeVisible();
		const after = await stepGrid.innerText();
		expect(after).not.toBe(before);
	});

	test('accented and sliding steps show an explicit "A"/"→" marker, not just a subtle border change (user-reported: accent alone was effectively invisible)', async ({
		page
	}) => {
		await openGeneratedLine(page);
		// Acid style explicitly features "repeated motifs, chromatic
		// approaches, slides and accents" (styles.ts's own description) --
		// picking it makes both markers reliably present.
		await page
			.getByRole('group', { name: 'Style', exact: true })
			.getByRole('button', { name: 'Acid', exact: true })
			.click();

		// Not every bar has both a slide and an accent -- scan the whole
		// arrangement rather than assuming bar 1 specifically does.
		const barButtons = page.getByRole('group', { name: 'Generated bar' }).getByRole('button');
		const barCount = await barButtons.count();
		let sawAccent = false;
		let sawSlide = false;
		for (let i = 0; i < barCount && !(sawAccent && sawSlide); i++) {
			await barButtons.nth(i).click();
			const stepGrid = page.getByRole('group', { name: /^Bar \d+ steps$/ });
			if (!sawAccent && (await stepGrid.locator('.generated-step.accent').count()) > 0) {
				await expect(stepGrid.locator('.generated-step.accent').first()).toContainText('A');
				sawAccent = true;
			}
			if (!sawSlide && (await stepGrid.locator('.generated-step.slide').count()) > 0) {
				await expect(stepGrid.locator('.generated-step.slide').first()).toContainText('→');
				sawSlide = true;
			}
		}
		expect(sawAccent).toBe(true);
		expect(sawSlide).toBe(true);
	});

	test('the bar strip switches which bar the step grid and inspector show', async ({ page }) => {
		await openGeneratedLine(page);

		const barTwo = page.getByRole('group', { name: 'Generated bar' }).getByRole('button', {
			name: '2',
			exact: true
		});
		await barTwo.click();
		await expect(barTwo).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('group', { name: /^Bar 2 steps$/ })).toBeVisible();
	});

	test('selecting an active step shows note, interval, function, explanation, and position', async ({
		page
	}) => {
		await openGeneratedLine(page);

		// Step 1 (the downbeat) is always active (rhythm.ts's own anchor rule).
		await page
			.getByRole('group', { name: /^Bar 1 steps$/ })
			.getByRole('button', {
				name: /^Step 1,/
			})
			.click();

		await expect(page.getByText('Note', { exact: true })).toBeVisible();
		await expect(page.getByText('Interval', { exact: true })).toBeVisible();
		await expect(page.getByText('Function', { exact: true })).toBeVisible();
		await expect(page.getByText('Position', { exact: true })).toBeVisible();
		await expect(page.getByText(/String \d+ · Fret \d+/)).toBeVisible();
	});
});

test.describe('Acid Bass Intelligence V4: Generated-mode glossary', () => {
	test('is hidden by default, absent in Manual mode, and the toggle shows/hides a GLOSSARY panel covering every section', async ({
		page
	}) => {
		await openGeneratedLine(page);

		await expect(page.getByRole('region', { name: 'GLOSSARY' })).toHaveCount(0);

		const toggle = page.getByRole('button', { name: 'Generated bassline glossary' });
		await expect(toggle).toHaveText('Show Glossary');
		await toggle.click();
		await expect(toggle).toHaveText('Hide Glossary');

		const glossary = page.getByRole('region', { name: 'GLOSSARY' });
		await expect(glossary).toBeVisible();
		for (const section of ['MODE', 'GENERATION', 'STEP INSPECTOR']) {
			await expect(glossary.getByText(section, { exact: true })).toBeVisible();
		}
		await expect(glossary.getByText('Style', { exact: true })).toBeVisible();
		await expect(glossary.getByText('Playability', { exact: true })).toBeVisible();

		await toggle.click();
		await expect(toggle).toHaveText('Show Glossary');
		await expect(page.getByRole('region', { name: 'GLOSSARY' })).toHaveCount(0);

		// Not part of the Manual-mode UI at all -- this glossary is specific to
		// Generated mode's own controls.
		await page.getByRole('button', { name: 'Manual', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Generated bassline glossary' })).toHaveCount(0);
	});
});
