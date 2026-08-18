import { expect, test } from '@playwright/test';

/**
 * Each Playwright test gets a fresh browser context (empty localStorage), so
 * these run as genuine first-visit scenarios without needing to clear
 * anything explicitly.
 */

test.describe('Contextual onboarding', () => {
	test('shows the intro hint before a root is chosen, then the root/chord hint after', async ({
		page
	}) => {
		await page.goto('/');

		await expect(page.getByText('Choose a note on the neck.')).toBeVisible();

		await page.getByTestId('fret-A-3').click(); // root C

		await expect(page.getByText('Choose a note on the neck.')).not.toBeVisible();
		await expect(page.getByText("That's your root")).toBeVisible();
		await expect(page.locator('.onboarding-hint')).toContainText('over C');
	});

	test('the root/chord hint dismisses permanently once the chord changes', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await expect(page.getByText("That's your root")).toBeVisible();

		await page.getByLabel('Chord').selectOption({ label: 'Dominant 7' });

		await expect(page.getByText("That's your root")).not.toBeVisible();

		// Never reappears, even switching back to a fresh root.
		await page.getByTestId('fret-E-1').click();
		await expect(page.getByText("That's your root")).not.toBeVisible();
	});

	test('Practice shows a bass-connection hint on first visit only', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByText('Connect a bass to practice with real notes.')).toBeVisible();

		await page.getByRole('tab', { name: 'Explore', exact: true }).click();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByText('Connect a bass to practice with real notes.')).not.toBeVisible();
	});
});
