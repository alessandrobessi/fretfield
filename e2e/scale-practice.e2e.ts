import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * Real BPM timing would make these tests slow and flaky, so every beat is
 * driven by `window.__fretfieldScalePracticeTestHooks__` instead of the real
 * scheduler — see `src/lib/testing/scale-practice-test-hooks.ts`. `start()`
 * silences the real `setTimeout` loop as part of the hook itself, so only
 * `advanceBeat()` ever moves the session forward here.
 *
 * C major pentatonic (root=0) across frets 0-12 steps C D E G A G E D,
 * looping — C is reachable at A-string fret 3, D at open D string, matching
 * the rest of the suite's existing fret-position conventions.
 */

const C_ROOT = 0;

async function waitForScalePracticeHooks(page: import('@playwright/test').Page): Promise<void> {
	await page.waitForFunction(
		() =>
			(window as unknown as { __fretfieldScalePracticeTestHooks__?: unknown })
				.__fretfieldScalePracticeTestHooks__ !== undefined
	);
}

async function configureAndStart(
	page: import('@playwright/test').Page,
	root: number,
	scaleId: string,
	minFret: number,
	maxFret: number
): Promise<void> {
	await waitForScalePracticeHooks(page);
	await page.evaluate(
		({ root, scaleId, minFret, maxFret }) => {
			const hooks = (
				window as unknown as {
					__fretfieldScalePracticeTestHooks__: {
						configure(root: number, scaleId: string): void;
						setZone(minFret: number, maxFret: number): void;
						start(): void;
					};
				}
			).__fretfieldScalePracticeTestHooks__;
			hooks.configure(root, scaleId);
			hooks.setZone(minFret, maxFret);
			hooks.start();
		},
		{ root, scaleId, minFret, maxFret }
	);
}

async function advanceBeat(page: import('@playwright/test').Page): Promise<void> {
	await page.evaluate(() =>
		(
			window as unknown as { __fretfieldScalePracticeTestHooks__: { advanceBeat(): void } }
		).__fretfieldScalePracticeTestHooks__.advanceBeat()
	);
}

async function stopSession(page: import('@playwright/test').Page): Promise<void> {
	await page.evaluate(() =>
		(
			window as unknown as { __fretfieldScalePracticeTestHooks__: { stop(): void } }
		).__fretfieldScalePracticeTestHooks__.stop()
	);
}

test.describe('Scale Practice', () => {
	test('steps through the scale on each beat and marks a correctly-played note', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Practice' }).click();
		await enableFakeInput(page);
		await configureAndStart(page, C_ROOT, 'major-pentatonic', 0, 12);

		// Step 0's target is the root, C.
		await expect(
			page.getByTestId('fret-A-3').locator('.scale-practice-target-marker')
		).toBeVisible();

		await playNote(page, 261.63); // C4
		await advanceBeat(page);

		await expect(page.getByTestId('fret-A-3')).toHaveAttribute(
			'data-scale-practice-result',
			/^correct-/
		);
		// Step 1's target is D.
		await expect(
			page.getByTestId('fret-D-0').locator('.scale-practice-target-marker')
		).toBeVisible();
	});

	test('a wrong note is marked incorrect, not missed', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Practice' }).click();
		await enableFakeInput(page);
		await configureAndStart(page, C_ROOT, 'major-pentatonic', 0, 12);

		await playNote(page, 246.94); // B3 — not in C major pentatonic
		await advanceBeat(page);

		await expect(page.getByTestId('fret-A-3')).toHaveAttribute(
			'data-scale-practice-result',
			'incorrect'
		);
	});

	test('a beat with nothing played is marked missed', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Practice' }).click();
		await enableFakeInput(page);
		await configureAndStart(page, C_ROOT, 'major-pentatonic', 0, 12);

		await advanceBeat(page);

		await expect(page.getByTestId('fret-A-3')).toHaveAttribute(
			'data-scale-practice-result',
			'missed'
		);
	});

	test('stopping clears every target and result marker', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Practice' }).click();
		await enableFakeInput(page);
		await configureAndStart(page, C_ROOT, 'major-pentatonic', 0, 12);
		await advanceBeat(page);

		await stopSession(page);

		await expect(
			page.getByTestId('fret-A-3').locator('.scale-practice-target-marker')
		).not.toBeVisible();
		await expect(page.getByTestId('fret-A-3')).not.toHaveAttribute('data-scale-practice-result');
	});

	test('switching away from the tab while running stops the session', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Scale Practice' }).click();
		await enableFakeInput(page);
		await configureAndStart(page, C_ROOT, 'major-pentatonic', 0, 12);

		await expect(
			page.getByTestId('fret-A-3').locator('.scale-practice-target-marker')
		).toBeVisible();

		await page.getByRole('tab', { name: 'Chord Field' }).click();
		await page.getByRole('tab', { name: 'Scale Practice' }).click();

		await expect(
			page.locator('.scale-practice-controls').getByRole('button', { name: 'Start' })
		).toBeVisible();
		await expect(
			page.getByTestId('fret-A-3').locator('.scale-practice-target-marker')
		).not.toBeVisible();
	});
});
