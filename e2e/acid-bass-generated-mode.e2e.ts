import { expect, test } from '@playwright/test';

/**
 * Acid Bass Intelligence V4 M10: the minimal Manual/Generated mode toggle
 * and generated-mode playback wiring (scale-practice.svelte.ts's
 * `scheduleGeneratedBassStep`). The Mode toggle lives in Groove Editor's
 * "Bass Steps" tab -- co-located with the pattern content itself (manual
 * steps or, once Generated is selected, the read-only generated view), not
 * off in a disconnected panel. No real-audio assertions here, matching this
 * app's existing testing boundary (see acid-bass.e2e.ts) -- only UI/state.
 */

async function openBassStepsTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Editor', exact: true }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
}

async function selectRootAndProgression(page: import('@playwright/test').Page): Promise<void> {
	await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
	await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });
}

/**
 * Root/progression + a fast, count-in-free transport, then opens Bass Steps
 * and switches to Generated mode and turns Bass on -- the common setup
 * every playback test below needs before pressing Play. Ends on the Band
 * panel's own "Bass" tab (not the Editor tab the Bass Steps setup itself
 * used) -- that's what makes the "Acid Bass" region (and its "Playing"
 * indicator) visible at all, so playback tests can observe it. The Editor
 * and Bass tabs are mutually exclusive now that the Groove Editor lives in
 * its own tab, so a test needing both switches between them explicitly.
 */
async function setUpGeneratedModeReadyToPlay(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await selectRootAndProgression(page);
	await page.getByLabel('Count-in').selectOption({ label: 'Off' });
	await page.getByLabel('Metronome BPM').fill('240');
	await page.keyboard.press('Tab');

	await page.getByRole('button', { name: 'Editor', exact: true }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
	await page.getByRole('button', { name: 'Generated', exact: true }).click();
	await page.getByRole('button', { name: 'Bass', exact: true }).click();
	const bassToggle = page.getByRole('button', { name: /^Bass (On|Off)$/ });
	if ((await bassToggle.textContent())?.includes('Off')) {
		await bassToggle.click();
	}
	await expect(bassToggle).toHaveText('Bass On');
}

test.describe('Acid Bass Intelligence V4: Generated mode toggle', () => {
	test('defaults to Manual, and the Mode picker switches to Generated and back', async ({
		page
	}) => {
		await openBassStepsTab(page);

		const manual = page.getByRole('button', { name: 'Manual', exact: true });
		const generated = page.getByRole('button', { name: 'Generated', exact: true });

		await expect(manual).toHaveAttribute('aria-pressed', 'true');
		await expect(generated).toHaveAttribute('aria-pressed', 'false');

		await generated.click();
		await expect(generated).toHaveAttribute('aria-pressed', 'true');
		await expect(manual).toHaveAttribute('aria-pressed', 'false');

		await manual.click();
		await expect(manual).toHaveAttribute('aria-pressed', 'true');
		await expect(generated).toHaveAttribute('aria-pressed', 'false');
	});

	test('the mode setting survives a reload', async ({ page }) => {
		await openBassStepsTab(page);
		await page.getByRole('button', { name: 'Generated', exact: true }).click();

		await page.reload();
		await openBassStepsTab(page);
		await expect(page.getByRole('button', { name: 'Generated', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});
});

test.describe('Acid Bass Intelligence V4: Generated mode playback', () => {
	test('plays without crashing once a root and progression are selected', async ({ page }) => {
		await setUpGeneratedModeReadyToPlay(page);

		await page.getByRole('button', { name: 'Play' }).click();

		const bassPanel = page.getByRole('region', { name: 'Acid Bass', exact: true });
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible({ timeout: 3000 });
		// Let it run long enough to cross at least one bar boundary/chord change.
		await page.waitForTimeout(1500);
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('switching modes mid-playback does not crash', async ({ page }) => {
		await setUpGeneratedModeReadyToPlay(page);

		await page.getByRole('button', { name: 'Play' }).click();
		const bassPanel = page.getByRole('region', { name: 'Acid Bass', exact: true });
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible({ timeout: 3000 });

		// Manual/Generated live in the Groove Editor's own Bass Steps view, its
		// own tab now -- switch there to flip the mode, then back to Bass to
		// keep observing the Playing indicator.
		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByRole('button', { name: 'Manual', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await page.waitForTimeout(500);
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByRole('button', { name: 'Generated', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await page.waitForTimeout(500);
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('a meter change while Generated mode is playing does not crash', async ({ page }) => {
		await setUpGeneratedModeReadyToPlay(page);

		await page.getByRole('button', { name: 'Play' }).click();
		const bassPanel = page.getByRole('region', { name: 'Acid Bass', exact: true });
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible({ timeout: 3000 });

		// Time Signature lives in the Groove Editor's own controls row, its
		// own tab now -- switch there to change it mid-playback, then back to
		// Bass to keep observing the Playing indicator.
		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByLabel('Time Signature').selectOption('3/4');
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		await page.waitForTimeout(500);
		await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});
