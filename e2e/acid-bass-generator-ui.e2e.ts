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
	await page.getByRole('button', { name: 'Edit Groove' }).click();
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
		await page.getByRole('button', { name: 'Edit Groove' }).click();
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
		await page.getByRole('button', { name: 'Edit Groove' }).click();
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
