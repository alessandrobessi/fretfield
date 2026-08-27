import { expect, test } from '@playwright/test';

/**
 * Radio Mode (user-requested, 2026-08): the standalone, unlisted `/radio`
 * page an operator points OBS's Browser Source at for a 24/7 stream. Not
 * linked from anywhere in the app (AGENTS.md's two-destination doctrine
 * stays untouched) -- reached here by direct URL only, same as an operator
 * would. `forceRotate()` (installed via `installRadioTestHooks`, mirroring
 * `installLiveInputTestHooks`/`installPersistenceTestHooks`) proves a
 * rotation applies cleanly without waiting a real 90-180s.
 */

declare global {
	interface Window {
		__fretfieldRadioTestHooks__?: { forceRotate(): void };
	}
}

test.describe('Radio Mode', () => {
	test('is excluded from search (noindex, nofollow)', async ({ page }) => {
		await page.goto('/radio');

		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow'
		);
	});

	test('shows a click-to-start overlay before anything plays', async ({ page }) => {
		await page.goto('/radio');

		await expect(page.getByRole('button', { name: /click to start/i })).toBeVisible();
	});

	test('clicking start begins playback and shows the visualizer with now-playing text', async ({
		page
	}) => {
		const pageErrors: Error[] = [];
		page.on('pageerror', (error) => pageErrors.push(error));

		await page.goto('/radio');
		await page.getByRole('button', { name: /click to start/i }).click();

		await expect(page.getByRole('button', { name: /click to start/i })).not.toBeVisible();
		await expect(page.locator('canvas')).toBeVisible();

		const nowPlaying = page.locator('.now-playing');
		await expect(nowPlaying).toBeVisible();
		await expect(nowPlaying).not.toHaveText('');

		expect(pageErrors).toEqual([]);
	});

	test('a forced rotation applies a new combo and keeps playback running, without errors', async ({
		page
	}) => {
		const pageErrors: Error[] = [];
		page.on('pageerror', (error) => pageErrors.push(error));

		await page.goto('/radio');
		await page.getByRole('button', { name: /click to start/i }).click();

		const nowPlaying = page.locator('.now-playing');
		const before = await nowPlaying.innerText();

		await page.evaluate(() => window.__fretfieldRadioTestHooks__?.forceRotate());

		await expect(nowPlaying).not.toHaveText(before);
		await expect(page.locator('canvas')).toBeVisible();
		expect(pageErrors).toEqual([]);
	});
});
