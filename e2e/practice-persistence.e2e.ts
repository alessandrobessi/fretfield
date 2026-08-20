import { expect, test } from '@playwright/test';
import { enableFakeInput, playNote } from './helpers';

/**
 * Local Practice Persistence (roadmap's deferred "local persistence" item):
 * Guided Practice session, Scale Practice config, and the last destination
 * all survive a reload via localStorage — see src/lib/stores/practice.svelte.ts,
 * scale-practice.svelte.ts, navigation.svelte.ts, and the lifetime
 * practiceHistory store in practice-history.svelte.ts.
 */

const BB2_HZ = 116.541;

async function startPractice(
	page: import('@playwright/test').Page,
	mode: 'find-interval' | 'find-chord-tone' | 'resolve-note' | 'follow-path',
	interval?: string
): Promise<void> {
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

async function seedHistory(
	page: import('@playwright/test').Page,
	partial: Record<string, unknown>
): Promise<void> {
	await page.waitForFunction(
		() =>
			(window as unknown as { __fretfieldPersistenceTestHooks__?: unknown })
				.__fretfieldPersistenceTestHooks__ !== undefined
	);
	await page.evaluate((partial) => {
		(
			window as unknown as {
				__fretfieldPersistenceTestHooks__: { seedHistory(partial: Record<string, unknown>): void };
			}
		).__fretfieldPersistenceTestHooks__.seedHistory(partial);
	}, partial);
}

test.describe('Local Practice Persistence: Guided Practice resume', () => {
	test('the same exercise and hint level survive a reload', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await enableFakeInput(page);
		await startPractice(page, 'find-interval', 'b7');
		await expect(page.locator('.guided-practice .prompt')).toContainText('Find b7');

		await page.getByLabel('Hint level').selectOption({ label: 'Interval' });
		await expect(page.getByLabel('Hint level')).toHaveValue('interval');

		await page.reload();

		await expect(page.locator('.guided-practice .prompt')).toContainText('Find b7');
		await expect(page.getByLabel('Hint level')).toHaveValue('interval');
	});

	test('recorded attempts survive a reload', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await enableFakeInput(page);
		await startPractice(page, 'find-interval', 'b7');
		await playNote(page, BB2_HZ);
		await expect(page.locator('.guided-practice .feedback')).toHaveAttribute(
			'data-result',
			'exact'
		);

		await page.reload();

		await expect(page.locator('.guided-practice')).toContainText('Attempts: 1');
	});
});

test.describe('Local Practice Persistence: Scale Practice resume', () => {
	test('root/scale/zone/bpm survive navigating away and reloading, metronome does not auto-resume', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Scales/ }).click();
		await page.getByLabel('Scale Practice root').selectOption({ label: 'D' });
		await page.getByLabel('Scale Practice scale').selectOption({ label: 'Dorian' });
		await page.getByLabel('Zone start fret').fill('2');
		await page.getByLabel('Zone end fret').fill('9');
		await page.getByLabel('Metronome BPM').fill('110');

		await page.getByRole('tab', { name: 'Explore', exact: true }).click();
		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		// Root/scale/zone are verified through the fretboard itself (the
		// established convention in scale-practice.e2e.ts) rather than reading
		// the root/scale <select> values directly, which are pitch-class
		// integers, not note-name strings.
		await expect(page.getByTestId('fret-D-0')).toHaveClass(/scale-practice-root/);
		await expect(page.getByTestId('fret-D-0').locator('.label')).toContainText('R');
		await expect(page.getByTestId('fret-A-0')).toHaveClass(/scale-practice-zone-dimmed/); // fret 0, outside the 2-9 zone
		await expect(page.getByTestId('fret-A-3')).not.toHaveClass(/scale-practice-zone-dimmed/); // fret 3, inside the 2-9 zone
		await expect(page.getByLabel('Zone start fret')).toHaveValue('2');
		await expect(page.getByLabel('Zone end fret')).toHaveValue('9');
		await expect(page.getByLabel('Metronome BPM')).toHaveValue('110');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});

test.describe('Local Practice Persistence: destination resume', () => {
	test('opening a preset lands on Explore, and a reload keeps you there', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();
		await page.getByRole('button', { name: /^Find the Sevenths/ }).click();
		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);

		await page.reload();

		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});
});

test.describe('Local Practice Persistence: lifetime history/streak', () => {
	test('a seeded streak shows on Practice home', async ({ page }) => {
		await page.goto('/');
		await seedHistory(page, {
			totalAttempts: 12,
			totalExercisesCompleted: 5,
			practicedDates: ['2026-08-08', '2026-08-09', '2026-08-10'],
			lastPracticedAt: '2026-08-10T12:00:00.000Z'
		});

		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.locator('.history-summary')).toContainText('exercises completed');
		await expect(page.locator('.streak')).toBeVisible();
	});

	test('opening a preset marks it as practiced on the presets list', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();
		await page.getByRole('button', { name: /^Find the Thirds/ }).click();

		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();

		await expect(
			page.getByRole('button', { name: /^Find the Thirds/ }).getByText('Practiced')
		).toBeVisible();
	});
});
