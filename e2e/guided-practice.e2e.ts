import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * These tests drive Guided Practice through the same `FakeAudioSource` used
 * by the Live Input tests, plus `window.__fretfieldPracticeTestHooks__` (see
 * src/lib/testing/practice-test-hooks.ts) to pin which target an exercise
 * generates — otherwise which interval/starting-note gets picked is
 * intentionally randomized, which e2e tests can't depend on.
 */

// Standard equal-temperament frequencies (A4 = 440 Hz), well within the
// detector's bass range.
const C3_HZ = 130.813;
const E3_HZ = 164.814;
const F3_HZ = 174.614;
const BB2_HZ = 116.541;

async function startPractice(
	page: import('@playwright/test').Page,
	mode: 'find-interval' | 'find-chord-tone' | 'resolve-note' | 'follow-path',
	interval?: string
): Promise<void> {
	// See helpers.ts's waitForTestHooks: `page.goto()` resolving doesn't mean
	// +page.svelte's script (which installs this hook) has run yet.
	await page.waitForFunction(
		() =>
			(window as unknown as { __fretfieldPracticeTestHooks__?: unknown })
				.__fretfieldPracticeTestHooks__ !== undefined
	);
	await page.evaluate(
		({ mode, interval }) => {
			(
				window as unknown as {
					__fretfieldPracticeTestHooks__: { startPractice(mode: string, interval?: string): void };
				}
			).__fretfieldPracticeTestHooks__.startPractice(mode, interval);
		},
		{ mode, interval }
	);
}

test.describe('Guided Practice: Find Interval', () => {
	test('playing the pinned target pitch shows correct feedback', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await enableFakeInput(page);
		await startPractice(page, 'find-interval', 'b7');

		await expect(page.locator('.guided-practice .prompt')).toContainText('Find b7');
		await expect(page.locator('.guided-practice .hint')).toContainText('Target interval: b7');

		await playNote(page, BB2_HZ);

		const feedback = page.locator('.guided-practice .feedback');
		await expect(feedback).toHaveAttribute('data-result', 'exact');
		await expect(feedback).toContainText('Correct');
	});

	test('playing an unrelated note shows a restrained, non-exact result', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await enableFakeInput(page);
		await startPractice(page, 'find-interval', '5');

		await playNote(page, C3_HZ); // root, not the requested 5th

		const feedback = page.locator('.guided-practice .feedback');
		await expect(feedback).toHaveAttribute(
			'data-result',
			/incorrect|strong-alternative|valid-alternative/
		);
		await expect(feedback).not.toContainText('Correct');
	});
});

test.describe('Guided Practice: Resolve Note', () => {
	test('G7 -> Cmaj7: the pinned starting note resolving correctly is a strong resolution', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Progression Field' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await page.getByRole('button', { name: 'G7', exact: true }).click();

		await enableFakeInput(page);
		await startPractice(page, 'resolve-note', 'b7'); // F, the b7 of G7

		await expect(page.locator('.guided-practice .prompt')).toContainText('G7 → Cmaj7');
		await expect(page.locator('.guided-practice .prompt')).toContainText("you're on F");

		await playNote(page, E3_HZ); // F -> E, the emergent strong resolution

		const feedback = page.locator('.guided-practice .feedback');
		await expect(feedback).toHaveAttribute('data-result', 'exact');
	});
});

test.describe('Guided Practice: Follow Path', () => {
	test('injecting each expected pitch advances through the path to completion', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Voice-Leading Paths' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		await enableFakeInput(page);
		await startPractice(page, 'follow-path');

		const panel = page.locator('.guided-practice');
		const next = panel.getByRole('button', { name: 'Next' });

		// The top path for Dm7 -> G7 -> Cmaj7 is E -> F -> E.
		await expect(panel.locator('.prompt')).toContainText('Step 1 of 3');
		await playNote(page, E3_HZ);
		await expect(panel.locator('.feedback')).toHaveAttribute('data-result', 'exact');
		await next.click();

		await expect(panel.locator('.prompt')).toContainText('Step 2 of 3');
		await playNote(page, F3_HZ);
		await expect(panel.locator('.feedback')).toHaveAttribute('data-result', 'exact');
		await next.click();

		await expect(panel.locator('.prompt')).toContainText('Step 3 of 3');
		await playNote(page, E3_HZ);
		await expect(panel.locator('.feedback')).toHaveAttribute('data-result', 'exact');
		await next.click();

		await expect(panel.locator('.prompt')).toContainText('Path complete');
	});

	test('a repeated wrong note does not skip past the current step', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Voice-Leading Paths' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		await enableFakeInput(page);
		await startPractice(page, 'follow-path');

		const panel = page.locator('.guided-practice');
		const next = panel.getByRole('button', { name: 'Next' });

		await expect(panel.locator('.prompt')).toContainText('Step 1 of 3');

		// F is wrong for step 1 (expects E) — must not advance, even after "Next".
		await playNote(page, F3_HZ);
		await expect(panel.locator('.feedback')).toHaveAttribute('data-result', 'incorrect');
		await next.click();
		await expect(panel.locator('.prompt')).toContainText('Step 1 of 3');
	});
});

test.describe('Guided Practice: stale context reset', () => {
	test('switching the progression mid-exercise resets the stale exercise', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: 'Progression Field' }).click();
		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
		await page.getByRole('button', { name: 'G7', exact: true }).click();

		await startPractice(page, 'resolve-note', 'b7');
		await expect(page.locator('.guided-practice .prompt')).toContainText('G7 → Cmaj7');

		await page.getByLabel('Progression').selectOption({ label: 'I–IV–V' });

		await expect(page.locator('.guided-practice .prompt')).not.toContainText('G7 → Cmaj7');
	});
});
