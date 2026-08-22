import { expect, test } from '@playwright/test';

/**
 * Local Practice Persistence (roadmap's deferred "local persistence" item):
 * Scale Practice config survives a reload via localStorage — see
 * src/lib/stores/scale-practice.svelte.ts.
 */

test.describe('Local Practice Persistence: Scale Practice resume', () => {
	test('root/progression/zone/bpm survive navigating away and reloading, metronome does not auto-resume', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		// Progression/Bars-per-chord live behind the Groove Editor disclosure,
		// collapsed by default (see AGENTS.md's compact Practice UI).
		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByLabel('Scale Practice root').selectOption({ label: 'D' });
		// Chord 1 of I–IV–V is the tonic itself (D), so its default suggested
		// scale (Major Pentatonic) is what's expected to still be showing after
		// reload -- per-chord scale overrides are deliberately session-only
		// (see AGENTS.md), unlike root/progression/zone/bpm.
		await page.getByLabel('Progression').selectOption({ label: 'I–IV–V' });
		await page.getByLabel('Zone start fret').fill('2');
		await page.getByLabel('Zone end fret').fill('9');
		await page.getByLabel('Metronome BPM').fill('110');

		await page.getByRole('tab', { name: 'Explore', exact: true }).click();
		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Editor', exact: true }).click();

		// Root/zone are verified through the fretboard itself (the established
		// convention in scale-practice.e2e.ts) rather than reading the root
		// <select> value directly, which is a pitch-class integer, not a
		// note-name string.
		await expect(page.getByTestId('fret-D-0')).toHaveClass(/scale-practice-root/);
		await expect(page.getByTestId('fret-D-0').locator('.label')).toContainText('R');
		await expect(page.getByTestId('fret-A-0')).toHaveClass(/scale-practice-zone-dimmed/); // fret 0, outside the 2-9 zone
		await expect(page.getByTestId('fret-A-3')).not.toHaveClass(/scale-practice-zone-dimmed/); // fret 3, inside the 2-9 zone
		await expect(page.getByLabel('Zone start fret')).toHaveValue('2');
		await expect(page.getByLabel('Zone end fret')).toHaveValue('9');
		await expect(page.getByLabel('Metronome BPM')).toHaveValue('110');
		await expect(page.getByLabel('Progression')).toHaveValue('i-iv-v');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});
