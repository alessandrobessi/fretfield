import { expect, test } from '@playwright/test';
import { enableFakeInput } from './helpers';

/**
 * Saved Material Library: Scale Maps, Favorite Chords, user-defined
 * Progressions, and My Presets — all local-only save/rename/delete over the
 * shared createSavedCollectionStore factory (src/lib/stores/saved-collection.svelte.ts).
 */

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

test.describe('Saved Material Library: Scale Maps', () => {
	test('save, load, and delete a Scale Map', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByRole('tab', { name: 'Scales', exact: true }).click();
		await page.getByRole('button', { name: 'Open Custom Scale Map' }).click();

		const editor = page.locator('.scale-block-controls');
		await editor.getByRole('button', { name: '+ Add block' }).click();
		await page.getByLabel('Block 1 root').selectOption({ label: 'C' });
		await page.getByLabel('Block 1 chord').selectOption({ label: 'Major' });
		await page.getByLabel('Block 1 scale').selectOption({ label: 'Major Pentatonic' });

		await editor.getByRole('button', { name: /^Save as/ }).click();
		await page.getByLabel('Scale map name').fill('E2E Scale Map');
		await editor.getByRole('button', { name: 'Save', exact: true }).click();

		await expect(editor.getByText('E2E Scale Map')).toBeVisible();

		await editor.getByRole('button', { name: 'Remove block 1' }).click();
		await expect(editor.getByText('Add a block, then choose')).toBeVisible();

		await editor.getByRole('button', { name: 'Load' }).click();
		await expect(page.getByLabel('Block 1 root')).toHaveValue('0');
		await expect(page.getByLabel('Block 1 scale')).toHaveValue('major-pentatonic');

		await editor.getByRole('button', { name: 'Delete E2E Scale Map' }).click();
		await expect(editor.getByText('E2E Scale Map')).not.toBeVisible();
	});
});

test.describe('Saved Material Library: Favorite Chords', () => {
	test('favorite a chord, reload, and recall it', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-G-0').click(); // root G, default chord Major

		const favoriteToggle = page.getByRole('button', { name: /Favorite/ });
		await expect(favoriteToggle).toBeEnabled();
		await favoriteToggle.click();
		await expect(favoriteToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'G Major', exact: true })).toBeVisible();

		await page.reload();
		await expect(page.getByRole('button', { name: 'G Major', exact: true })).toBeVisible();

		await page.getByTestId('fret-A-3').click(); // root C -- no longer favorited
		await expect(favoriteToggle).toHaveAttribute('aria-pressed', 'false');

		await page.getByRole('button', { name: 'G Major', exact: true }).click();
		await expect(favoriteToggle).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Saved Material Library: custom Progressions', () => {
	test('build, save, and select a custom progression', async ({ page }) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await page.getByRole('tab', { name: /^Progression/ }).click();
		await page.getByRole('button', { name: '+ Build your own' }).click();

		await page.getByLabel('Step 1 interval').selectOption({ label: '1' });
		await page.getByLabel('Step 1 chord').selectOption({ label: 'Major' });
		await page.getByRole('button', { name: '+ Add step' }).click();
		await page.getByLabel('Step 2 interval').selectOption({ label: 'b7' });
		await page.getByLabel('Step 2 chord').selectOption({ label: 'Dominant 7' });

		await page.getByLabel('Progression name').fill('E2E Progression');
		await page
			.locator('.progression-builder')
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		// Scoped to the outer <label> specifically -- the builder's own
		// interval/chord <select>s live in a sibling, not this label.
		await page
			.locator('.progression-selector > label select')
			.selectOption({ label: 'E2E Progression' });

		const strip = page.locator('.chords');
		await expect(strip).toContainText('C');
		await expect(strip).toContainText('Bb7');
	});
});

test.describe('Saved Material Library: My Presets', () => {
	test('save a Guided Practice preset from an active session and reopen it via My Presets', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByTestId('fret-A-3').click(); // root C
		await enableFakeInput(page);
		await startPractice(page, 'find-interval', 'b7');

		const guided = page.locator('.guided-practice');
		await guided.getByRole('button', { name: /^Save as preset/ }).click();
		await page.getByLabel('Preset name').fill('E2E Guided Preset');
		await guided.getByRole('button', { name: 'Save', exact: true }).click();

		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();
		await expect(
			page.getByRole('button', { name: 'E2E Guided Preset', exact: true })
		).toBeVisible();

		await page.getByRole('button', { name: 'E2E Guided Preset', exact: true }).click();
		await expect(page.getByRole('tab', { name: 'Explore', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.locator('.guided-practice .prompt')).toContainText('relative to C');
	});

	test('save a Scale Practice preset and reopen it via My Presets', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: /^Scales/ }).click();
		await page.getByLabel('Scale Practice root').selectOption({ label: 'D' });
		await page.getByLabel('Scale Practice scale').selectOption({ label: 'Dorian' });

		const scaleControls = page.locator('.scale-practice-controls');
		await scaleControls.getByRole('button', { name: /^Save as preset/ }).click();
		await page.getByLabel('Preset name').fill('E2E Scale Preset');
		await scaleControls.getByRole('button', { name: 'Save', exact: true }).click();

		await page.getByRole('button', { name: '← Back to Practice' }).click();
		await page.getByRole('button', { name: /^Presets/ }).click();
		await expect(page.getByRole('button', { name: 'E2E Scale Preset', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'E2E Scale Preset', exact: true }).click();
		await expect(page.getByLabel('Scale Practice root')).toHaveValue('2');
		await expect(page.getByLabel('Scale Practice scale')).toHaveValue('dorian');
	});
});
