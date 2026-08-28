import { expect, test } from '@playwright/test';

/**
 * Radio Mode (user-requested, 2026-08): the standalone, unlisted `/radio`
 * page an operator points OBS's Browser Source at for a 24/7 stream. Not
 * linked from anywhere in the app (AGENTS.md's two-destination doctrine
 * stays untouched) -- reached here by direct URL only, same as an operator
 * would. `forceRotate()` (installed via `installRadioTestHooks`, mirroring
 * `installLiveInputTestHooks`/`installPersistenceTestHooks`) proves a
 * rotation applies cleanly without waiting a real 90-180s. `getAcidBassState`
 * exists specifically because "I can't hear the bass playing" (user-
 * reported) had no visible UI signal on this chrome-free page to catch it --
 * a `GroovePreset`'s own baked-in `Groove` silently disabled Acid Bass on
 * every single rotation; fixed by re-asserting enabled/generated after every
 * `setGroove` call.
 */

declare global {
	interface Window {
		__fretfieldRadioTestHooks__?: {
			forceRotate(): void;
			getAcidBassState(): { enabled: boolean; mode: string };
		};
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

	test('Acid Bass stays enabled and in generated mode after starting and after every rotation (regression: "I can\'t hear the bass playing")', async ({
		page
	}) => {
		await page.goto('/radio');
		await page.getByRole('button', { name: /click to start/i }).click();

		await expect
			.poll(() => page.evaluate(() => window.__fretfieldRadioTestHooks__?.getAcidBassState()))
			.toEqual({ enabled: true, mode: 'generated' });

		for (let i = 0; i < 5; i++) {
			await page.evaluate(() => window.__fretfieldRadioTestHooks__?.forceRotate());
			const state = await page.evaluate(() =>
				window.__fretfieldRadioTestHooks__?.getAcidBassState()
			);
			expect(state).toEqual({ enabled: true, mode: 'generated' });
		}
	});

	test('the groove/genre is always trance (user-requested, 2026-08 -- "music should always be trance"), across every rotation', async ({
		page
	}) => {
		await page.goto('/radio');
		await page.getByRole('button', { name: /click to start/i }).click();

		const nowPlaying = page.locator('.now-playing');
		for (let i = 0; i < 5; i++) {
			await expect(nowPlaying).toContainText('Trance');
			await page.evaluate(() => window.__fretfieldRadioTestHooks__?.forceRotate());
		}
	});
});
