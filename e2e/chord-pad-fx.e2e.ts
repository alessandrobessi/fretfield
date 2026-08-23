import { expect, test } from '@playwright/test';

/**
 * The Chord Pad's FX rack (Reverb/Delay/Chorus, stage 1 of 2, user-requested
 * 2026-08) -- three HardwarePanels under the Harmony tab, matching Acid
 * Bass's own panel language exactly (see AcidBassControls.svelte's own
 * conventions, `AGENTS.md`). No real-audio assertions, matching this app's
 * existing testing boundary (see acid-bass.e2e.ts) -- only UI/state, plus a
 * playback smoke test confirming the panels survive the transition into a
 * real chord-pad voice existing.
 */

async function openHarmonyTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Harmony', exact: true }).click();
}

test.describe('Chord Pad FX: panel layout', () => {
	test('REVERB/DELAY/CHORUS sections, and every control, are all visible at once', async ({
		page
	}) => {
		await openHarmonyTab(page);

		await expect(page.getByRole('heading', { name: 'REVERB', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'DELAY', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'CHORUS', exact: true })).toBeVisible();

		const reverbPanel = page.getByRole('region', { name: 'REVERB', exact: true });
		await expect(reverbPanel.getByRole('button', { name: 'Reverb', exact: true })).toBeVisible();
		await expect(reverbPanel.getByRole('slider', { name: 'Size', exact: true })).toBeVisible();
		await expect(reverbPanel.getByRole('slider', { name: 'Damping', exact: true })).toBeVisible();
		await expect(reverbPanel.getByRole('slider', { name: 'Mix', exact: true })).toBeVisible();

		const delayPanel = page.getByRole('region', { name: 'DELAY', exact: true });
		await expect(delayPanel.getByRole('button', { name: 'Delay', exact: true })).toBeVisible();
		await expect(delayPanel.getByRole('combobox', { name: 'Delay Division' })).toBeVisible();
		await expect(delayPanel.getByRole('slider', { name: 'Feedback', exact: true })).toBeVisible();
		await expect(delayPanel.getByRole('slider', { name: 'Mix', exact: true })).toBeVisible();

		const chorusPanel = page.getByRole('region', { name: 'CHORUS', exact: true });
		await expect(chorusPanel.getByRole('button', { name: 'Chorus', exact: true })).toBeVisible();
		await expect(chorusPanel.getByRole('slider', { name: 'Rate', exact: true })).toBeVisible();
		await expect(chorusPanel.getByRole('slider', { name: 'Depth', exact: true })).toBeVisible();
		await expect(chorusPanel.getByRole('slider', { name: 'Mix', exact: true })).toBeVisible();
	});
});

test.describe('Chord Pad FX: Reverb', () => {
	test('is off by default, toggles on (lighting its LED), and its Size/Damping/Mix knobs all update state', async ({
		page
	}) => {
		await openHarmonyTab(page);

		const reverbPanel = page.getByRole('region', { name: 'REVERB', exact: true });
		const toggle = reverbPanel.getByRole('button', { name: 'Reverb', exact: true });
		const led = reverbPanel.locator('.led');

		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(led).not.toHaveClass(/active/);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(led).toHaveClass(/active/);

		for (const label of ['Size', 'Damping', 'Mix']) {
			const knob = reverbPanel.getByRole('slider', { name: label, exact: true });
			await knob.focus();
			await knob.press('End');
			await expect(knob).toHaveAttribute('aria-valuenow', '100');
		}
	});
});

test.describe('Chord Pad FX: Delay', () => {
	test('is off by default, toggles on, and its Division/Feedback/Mix controls all update state', async ({
		page
	}) => {
		await openHarmonyTab(page);

		const delayPanel = page.getByRole('region', { name: 'DELAY', exact: true });
		const toggle = delayPanel.getByRole('button', { name: 'Delay', exact: true });
		const led = delayPanel.locator('.led');

		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(led).not.toHaveClass(/active/);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(led).toHaveClass(/active/);

		const division = delayPanel.getByRole('combobox', { name: 'Delay Division' });
		await division.selectOption('1/16T');
		await expect(division).toHaveValue('1/16T');

		for (const label of ['Feedback', 'Mix']) {
			const knob = delayPanel.getByRole('slider', { name: label, exact: true });
			await knob.focus();
			await knob.press('End');
			await expect(knob).toHaveAttribute('aria-valuenow', '100');
		}
	});
});

test.describe('Chord Pad FX: Chorus', () => {
	test('is off by default, toggles on, and its Rate/Depth/Mix knobs all update state', async ({
		page
	}) => {
		await openHarmonyTab(page);

		const chorusPanel = page.getByRole('region', { name: 'CHORUS', exact: true });
		const toggle = chorusPanel.getByRole('button', { name: 'Chorus', exact: true });
		const led = chorusPanel.locator('.led');

		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(led).not.toHaveClass(/active/);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(led).toHaveClass(/active/);

		// Rate's own range is 0.1-5 Hz, not 0-100 -- End should land at 5, not 100.
		const rate = chorusPanel.getByRole('slider', { name: 'Rate', exact: true });
		await rate.focus();
		await rate.press('End');
		await expect(rate).toHaveAttribute('aria-valuenow', '5');

		for (const label of ['Depth', 'Mix']) {
			const knob = chorusPanel.getByRole('slider', { name: label, exact: true });
			await knob.focus();
			await knob.press('End');
			await expect(knob).toHaveAttribute('aria-valuenow', '100');
		}
	});
});

test.describe('Chord Pad FX: persistence', () => {
	test("every effect's enabled state and Delay's division survive a reload", async ({ page }) => {
		await openHarmonyTab(page);

		await page
			.getByRole('region', { name: 'REVERB', exact: true })
			.getByRole('button', { name: 'Reverb', exact: true })
			.click();
		await page
			.getByRole('region', { name: 'DELAY', exact: true })
			.getByRole('button', { name: 'Delay', exact: true })
			.click();
		await page
			.getByRole('region', { name: 'DELAY', exact: true })
			.getByRole('combobox', { name: 'Delay Division' })
			.selectOption('1/16D');
		await page
			.getByRole('region', { name: 'CHORUS', exact: true })
			.getByRole('button', { name: 'Chorus', exact: true })
			.click();

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Harmony', exact: true }).click();

		await expect(
			page
				.getByRole('region', { name: 'REVERB', exact: true })
				.getByRole('button', { name: 'Reverb', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		const reloadedDelayPanel = page.getByRole('region', { name: 'DELAY', exact: true });
		await expect(
			reloadedDelayPanel.getByRole('button', { name: 'Delay', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await expect(reloadedDelayPanel.getByRole('combobox', { name: 'Delay Division' })).toHaveValue(
			'1/16D'
		);
		await expect(
			page
				.getByRole('region', { name: 'CHORUS', exact: true })
				.getByRole('button', { name: 'Chorus', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Chord Pad FX: live playback', () => {
	test('with every effect enabled, the panels survive the transition into real chord-pad playback', async ({
		page
	}) => {
		await openHarmonyTab(page);

		await page
			.getByRole('region', { name: 'REVERB', exact: true })
			.getByRole('button', { name: 'Reverb', exact: true })
			.click();
		await page
			.getByRole('region', { name: 'DELAY', exact: true })
			.getByRole('button', { name: 'Delay', exact: true })
			.click();
		await page
			.getByRole('region', { name: 'CHORUS', exact: true })
			.getByRole('button', { name: 'Chorus', exact: true })
			.click();

		await page.getByLabel('Progression').selectOption({ label: 'Major ii–V–I' });

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'REVERB', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'DELAY', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'CHORUS', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});
