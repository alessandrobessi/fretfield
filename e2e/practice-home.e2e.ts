import { expect, test } from '@playwright/test';

test.describe('Practice home', () => {
	test('shows a Quick Start card for each Guided Practice mode plus Scales', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		for (const title of ['Find Interval', 'Find Chord Tone', 'Resolve Note', 'Follow Path']) {
			await expect(page.getByRole('button', { name: new RegExp(`^${title}`) })).toBeVisible();
		}
		await expect(page.getByRole('button', { name: /^Scales/ })).toBeVisible();
	});

	test('starting a Guided Practice card jumps to Explore with that exercise running', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C, needed for the exercise to have context
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await page.getByRole('button', { name: /^Find Interval/ }).click();

		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.guided-practice')).toHaveClass(/active/);
	});

	test('starting the Scales card opens Scale Practice right here under Practice', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await page.getByRole('button', { name: /^Scales/ }).click();

		// Stays on Practice -- Scale Practice has its own fretboard here now,
		// unlike Guided Practice which still jumps to Explore (M9/M10 note).
		await expect(page.getByRole('tab', { name: 'Practice', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.scale-practice-controls')).toBeVisible();
		await expect(page.getByTestId('fret-A-3')).toBeVisible();

		await page.getByRole('button', { name: '← Back to Practice' }).click();
		await expect(page.getByText('Pick something to practice.')).toBeVisible();
	});
});
