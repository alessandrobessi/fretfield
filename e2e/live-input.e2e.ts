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
const F2_HZ = 87.3071;

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

		// With no Voice-Leading Path/Local Field/prior position to disambiguate,
		// none of the three is singled out as "most likely" — never guess a string.
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

test.describe('Live Input: Progression Field, existing connection engine', () => {
	test('playing F over G7 shows F as played and E lit up as the resolution target', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await page.getByRole('button', { name: 'G7', exact: true }).click();

		await enableFakeInput(page);
		await playNote(page, F2_HZ);

		const panel = page.locator('.live-input');
		await expect(panel).toContainText('F2');
		await expect(panel).toContainText('Best resolution: E');

		// F2 is reachable at E-string fret 13, A-string fret 8, D-string fret 3.
		await expect(page.getByTestId('fret-E-13')).toHaveClass(/live-played/);

		// The existing connection engine's best target (E, a half-step below F)
		// is emphasized on the board too — every E on the neck, not just one.
		await expect(page.getByTestId('fret-E-0')).toHaveClass(/live-next-target/);
	});
});

test.describe('Live Input: Voice-Leading Paths, target matching', () => {
	test('playing the current step’s expected note shows a matched state', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByRole('tab', { name: 'Paths', exact: true }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		// Dm7 is active; the top path's first step is E (open E string).
		await expect(page.getByTestId('fret-E-0')).toHaveAttribute('data-path-role', 'current');

		await enableFakeInput(page);
		await playNote(page, E2_HZ);

		const panel = page.locator('.live-input');
		await expect(panel).toContainText('Expected E');
		await expect(panel).toContainText('matched');
	});
});
