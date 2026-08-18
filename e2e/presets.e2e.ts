import { expect, test } from '@playwright/test';

test.describe('Practice Presets', () => {
	test('the Presets card shows the curated library', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();

		await expect(page.getByRole('button', { name: /^Find the Thirds/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Blues Scale/ })).toBeVisible();

		await page.getByRole('button', { name: '← Back to Practice' }).click();
		await expect(page.getByText('Pick something to practice.')).toBeVisible();
	});

	test('a Guided Practice preset configures context, pins the target, and starts on Explore', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();

		await page.getByRole('button', { name: /^Find the Sevenths/ }).click();

		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.guided-practice .prompt')).toContainText('Find b7');
		await expect(page.locator('.status')).toContainText('Root: C');
		await expect(page.locator('.status')).toContainText('Dominant 7');
	});

	test('a Follow Path preset configures the progression, path preset, and position constraint', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();

		await page.getByRole('button', { name: /^Stay Within Five Frets/ }).click();

		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.guided-practice .prompt')).toContainText('Step 1 of 3');
		// Local Field only, constrained to frets 0-5.
		await expect(page.locator('.guided-practice input[type="checkbox"]')).toBeChecked();
	});

	test('a Scales preset opens Scale Practice right under Practice, zone included', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();

		await page.getByRole('button', { name: /^Major Scale in One Position/ }).click();

		await expect(page.getByRole('tab', { name: 'Practice', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByLabel('Scale Practice root')).toHaveValue(/./);
		await expect(page.getByLabel('Zone start fret')).toHaveValue('0');
		await expect(page.getByLabel('Zone end fret')).toHaveValue('5');
		// C is in C Ionian, at A-string fret 3.
		await expect(page.getByTestId('fret-A-3')).toHaveClass(/scale-practice-note/);
	});
});
