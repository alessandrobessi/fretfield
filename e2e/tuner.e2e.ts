import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * The Tuner tab (user-requested, 2026-08) -- BandPanel.svelte's own 'tuner'
 * tab, reading `liveInput` directly. Driven entirely through the
 * `FakeAudioSource` test hooks (`enableFakeInput`/`playNote`, see
 * `live-input.e2e.ts`'s own header comment) -- no real microphone or
 * getUserMedia permission is ever requested.
 */

/** Scoped to `TunerControls.svelte`'s own root -- the fretboard's own string-row labels (E/A/D/G) would otherwise collide with plain-text assertions like `getByText('E')` if run unscoped against the whole page. */
async function openTunerTab(
	page: import('@playwright/test').Page
): Promise<import('@playwright/test').Locator> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Tuner', exact: true }).click();
	return page.locator('.tuner');
}

const E1_HZ = 41.2034;
const A1_HZ = 55.0;

test.describe('Tuner', () => {
	test('shows a hint to enable Live Input before anything is detected', async ({ page }) => {
		const tuner = await openTunerTab(page);

		await expect(tuner.getByText('Enable Live Input above to tune your bass.')).toBeVisible();
	});

	test('playing an exact open string reads that string, in tune, at 0 cents', async ({ page }) => {
		const tuner = await openTunerTab(page);
		await enableFakeInput(page);
		await playNote(page, E1_HZ);

		await expect(tuner.getByText('E', { exact: true })).toBeVisible();
		await expect(tuner.getByText('In tune')).toBeVisible();
		await expect(tuner.getByText('0¢')).toBeVisible();
	});

	test('a flat open string reads that string, flat, with a negative cents readout', async ({
		page
	}) => {
		const tuner = await openTunerTab(page);
		await enableFakeInput(page);
		// ~30 cents flat of A1 (55Hz).
		await playNote(page, A1_HZ * 2 ** (-30 / 1200));

		await expect(tuner.getByText('A', { exact: true })).toBeVisible();
		await expect(tuner.getByText(/^(Slightly flat|Flat)$/)).toBeVisible();
		await expect(tuner.locator('.cents-readout')).toContainText('-');
	});

	test('a note far from any open string reads as a fretted note, not a tuning result', async ({
		page
	}) => {
		const tuner = await openTunerTab(page);
		await enableFakeInput(page);
		// C4 (261.6256Hz) -- 17 semitones above G2, the nearest open string.
		await playNote(page, 261.6256);

		await expect(
			tuner.getByText('Fretted note detected — play an open string to tune.')
		).toBeVisible();
		await expect(tuner.getByText('C', { exact: true })).toBeVisible();
		await expect(tuner.getByText('In tune')).not.toBeVisible();
	});

	test('disabling Live Input returns the tab to the hint state', async ({ page }) => {
		const tuner = await openTunerTab(page);
		await enableFakeInput(page);
		await playNote(page, E1_HZ);
		await expect(tuner.getByText('In tune')).toBeVisible();

		await page.evaluate(() => {
			(
				window as unknown as { __fretfieldTestHooks__: { disable(): void } }
			).__fretfieldTestHooks__.disable();
		});

		await expect(tuner.getByText('Enable Live Input above to tune your bass.')).toBeVisible();
	});
});
