import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * These tests drive Live Input entirely through the `FakeAudioSource`
 * injected via `window.__fretfieldTestHooks__` (see
 * src/lib/testing/live-input-test-hooks.ts) — no real microphone or
 * getUserMedia permission is ever requested, matching product spec §20's
 * requirement that CI never need real audio hardware.
 */

const E2_HZ = 82.4069;

test.describe('Live Input: Chord Field, played-pitch highlighting', () => {
	test('playing E2 highlights every physically valid position and stays ambiguous with no context', async ({
		page
	}) => {
		await page.goto('/');
		await enableFakeInput(page);
		await playNote(page, E2_HZ);

		const panel = page.locator('.live-input');
		await expect(panel).toContainText('Tracking');
		await expect(panel).toContainText('E2');

		// E2 is reachable at E-string fret 12, A-string fret 7, D-string fret 2.
		await expect(page.getByTestId('fret-E-12')).toHaveClass(/live-played/);
		await expect(page.getByTestId('fret-A-7')).toHaveClass(/live-played/);
		await expect(page.getByTestId('fret-D-2')).toHaveClass(/live-played/);

		// With no prior position to disambiguate, none of the three is singled
		// out as "most likely" — never guess a string.
		await expect(page.getByTestId('fret-E-12')).not.toHaveClass(/live-likely/);
		await expect(page.getByTestId('fret-A-7')).not.toHaveClass(/live-likely/);
		await expect(page.getByTestId('fret-D-2')).not.toHaveClass(/live-likely/);
	});

	test('disabling Live Input clears the played-position layer and resets the control', async ({
		page
	}) => {
		await page.goto('/');
		await enableFakeInput(page);
		await playNote(page, E2_HZ);
		await expect(page.getByTestId('fret-E-12')).toHaveClass(/live-played/);

		await page.evaluate(() => {
			(
				window as unknown as { __fretfieldTestHooks__: { disable(): void } }
			).__fretfieldTestHooks__.disable();
		});

		await expect(page.getByTestId('fret-E-12')).not.toHaveClass(/live-played/);
		await expect(page.getByRole('button', { name: 'Connect Bass' })).toBeVisible();
	});
});
