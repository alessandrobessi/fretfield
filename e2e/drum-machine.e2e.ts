import { expect, test } from '@playwright/test';

/**
 * Scale Practice's drum machine (replacing the old single-click metronome —
 * see the "Drum Machine for Scale Practice" plan). No real-audio assertions
 * here, matching this app's existing testing boundary — the prior metronome
 * tests never asserted actual sound either, only UI/state.
 */

async function openScalePractice(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: /^Scales/ }).click();
}

test.describe('Drum Machine', () => {
	test('toggling a step updates the grid', async ({ page }) => {
		await openScalePractice(page);

		const step = page.getByLabel('Open Hat step 5', { exact: true });
		await expect(step).toHaveAttribute('aria-pressed', 'false');
		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'true');
		await step.click();
		await expect(step).toHaveAttribute('aria-pressed', 'false');
	});

	test('selecting a genre preset overwrites the whole grid and swing together', async ({
		page
	}) => {
		await openScalePractice(page);

		await expect(page.getByLabel('Swing')).toHaveValue('0');
		await page.getByLabel('Groove preset').selectOption({ label: 'Blues Shuffle' });

		await expect(page.getByLabel('Swing')).toHaveValue('65');
		await expect(page.getByLabel('Kick step 1', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByLabel('Kick step 9', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByLabel('Snare step 5', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('swing and tempo survive a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Groove preset').selectOption({ label: 'Jazz Swing' });
		// fill() only dispatches an 'input' event; the store's onchange handler
		// needs a real 'change' (fired on blur/commit), so move focus away
		// before reloading -- otherwise the typed BPM never gets persisted.
		await page.getByLabel('Metronome BPM').fill('110');
		await page.keyboard.press('Tab');

		await page.reload();
		// destination ('practice') and fretfield.mode ('scale-practice') both
		// persist, so ScalePracticeSession renders directly on reload -- no
		// "Scales" card to click through again (see Local Practice Persistence's
		// own equivalent test for the same reasoning).
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByLabel('Swing')).toHaveValue('70');
		await expect(page.getByLabel('Metronome BPM')).toHaveValue('110');
		await expect(page.getByLabel('Open Hat step 1', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('Start/Stop toggles the drum machine', async ({ page }) => {
		await openScalePractice(page);

		const toggle = page.getByRole('button', { name: 'Play' });
		await toggle.click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
		await expect(page.getByText(/♩ = \d+/)).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('save a custom groove and reload it via My Grooves', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Kick step 3', { exact: true }).click();

		await page.getByRole('button', { name: 'Save as…', exact: true }).click();
		await page.getByLabel('Groove name').fill('E2E Test Groove');
		await page.locator('.drum-machine').getByRole('button', { name: 'Save', exact: true }).click();

		await expect(page.getByRole('button', { name: 'E2E Test Groove', exact: true })).toBeVisible();

		// Switch to a curated preset, then load the saved groove back.
		await page.getByLabel('Groove preset').selectOption({ label: 'Funk' });
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);

		await page.getByRole('button', { name: 'E2E Test Groove', exact: true }).click();
		await expect(page.getByLabel('Kick step 3', { exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByRole('button', { name: 'Delete E2E Test Groove' }).click();
		await expect(
			page.getByRole('button', { name: 'E2E Test Groove', exact: true })
		).not.toBeVisible();
	});
});
