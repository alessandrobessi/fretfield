import { expect, test } from '@playwright/test';

/**
 * The footer (About/GitHub/Donate links, shared by the home page and the
 * About page itself) and the About page's own bio content -- user-requested,
 * 2026-08. No real-audio/DOM-internals assertions needed here, just that the
 * links exist with the right destinations and the page navigates correctly.
 */

test.describe('Footer', () => {
	test('is visible on the home page with About, GitHub, and Donate links', async ({ page }) => {
		await page.goto('/');

		const footer = page.locator('footer');
		await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', /about$/);
		await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
			'href',
			'https://github.com/alessandrobessi/fretfield'
		);
		await expect(footer.getByRole('link', { name: 'Donate' })).toHaveAttribute(
			'href',
			'https://paypal.me/bessimaestro'
		);
	});

	test('the About and Donate links open correctly (About same-tab, Donate/GitHub new tab)', async ({
		page
	}) => {
		await page.goto('/');

		const footer = page.locator('footer');
		await expect(footer.getByRole('link', { name: 'Donate' })).toHaveAttribute('target', '_blank');
		await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('target', '_blank');
		await expect(footer.getByRole('link', { name: 'About' })).not.toHaveAttribute('target');
	});
});

test.describe('About page', () => {
	test('navigating from the footer shows the author bio, a back link, and its own footer', async ({
		page
	}) => {
		await page.goto('/');
		await page.locator('footer').getByRole('link', { name: 'About' }).click();

		await expect(page).toHaveURL(/\/about$/);
		await expect(page.getByRole('heading', { name: 'About the Author' })).toBeVisible();
		await expect(page.getByText('Alessandro Bessi')).toHaveCount(2); // strong tag + prose mention
		await expect(page.getByRole('link', { name: /Back to FretField/ })).toBeVisible();
		await expect(page.locator('footer').getByRole('link', { name: 'Donate' })).toBeVisible();
	});

	test('the back link returns to the home page', async ({ page }) => {
		await page.goto('/about');
		await page.getByRole('link', { name: /Back to FretField/ }).click();

		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('tab', { name: 'Explore' })).toBeVisible();
	});

	test('has its own descriptive title, distinct from the home page', async ({ page }) => {
		await page.goto('/about');
		await expect(page).toHaveTitle(/About the Author/);

		await page.goto('/');
		await expect(page).toHaveTitle(/Interactive Bass Fretboard/);
	});
});
