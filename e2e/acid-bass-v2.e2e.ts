import { expect, test } from '@playwright/test';

/**
 * Acid Bass V2's UI additions (~/Downloads/ACID-BASS-ENGINE-V2.md M8): the
 * VCO/VCF/ENV/MOD/OUTPUT panel layout, its Advanced disclosure, and the step
 * editor's sequencer powers (Probability/Ratchet/Gate/Locks). No real-audio
 * assertions, matching this app's existing testing boundary (see
 * acid-bass.e2e.ts) -- only UI/state.
 */

async function openBassTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Bass', exact: true }).click();
}

async function openBassStepsTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Edit Groove' }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
}

test.describe('Acid Bass V2: panel layout', () => {
	test('VCO/VCF/ENV/MOD/OUTPUT sections are all visible, and Advanced is collapsed by default', async ({
		page
	}) => {
		await openBassTab(page);

		await expect(page.getByRole('heading', { name: 'VCO' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'VCF' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'ENV' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'MOD' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'OUTPUT' })).toBeVisible();

		await expect(page.getByRole('slider', { name: 'Tune' })).not.toBeVisible();

		await page.getByRole('button', { name: 'Show Advanced' }).click();
		await expect(page.getByRole('slider', { name: 'Tune' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Fine' })).toBeVisible();

		await page.getByRole('button', { name: 'Hide Advanced' }).click();
		await expect(page.getByRole('slider', { name: 'Tune' })).not.toBeVisible();
	});

	test('Sub On/Off toggles, and the Filter Model picker selects', async ({ page }) => {
		await openBassTab(page);

		const subToggle = page.getByRole('button', { name: 'Sub oscillator' });
		await expect(subToggle).toHaveAttribute('aria-pressed', 'false');
		await subToggle.click();
		await expect(subToggle).toHaveAttribute('aria-pressed', 'true');

		const acid24 = page.getByRole('button', { name: 'Acid 24', exact: true });
		await expect(acid24).toHaveAttribute('aria-pressed', 'true');
		const legacy = page.getByRole('button', { name: 'Legacy', exact: true });
		await legacy.click();
		await expect(legacy).toHaveAttribute('aria-pressed', 'true');
		await expect(acid24).toHaveAttribute('aria-pressed', 'false');
	});

	test('LFO On/Off toggles, and Destination picker selects', async ({ page }) => {
		await openBassTab(page);

		const lfoToggle = page.getByRole('button', { name: 'LFO' });
		await expect(lfoToggle).toHaveAttribute('aria-pressed', 'false');
		await lfoToggle.click();
		await expect(lfoToggle).toHaveAttribute('aria-pressed', 'true');

		const pitch = page.getByRole('button', { name: 'Pitch', exact: true });
		await pitch.click();
		await expect(pitch).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Acid Bass V2: factory patches', () => {
	test('applying "Classic Acid" writes resolved patch values -- Saw, Acid 24, and a moved Cutoff knob', async ({
		page
	}) => {
		await openBassTab(page);

		await expect(page.getByRole('button', { name: 'Saw', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByLabel('Patch', { exact: true }).selectOption('classic-acid');

		await expect(page.getByRole('button', { name: 'Saw', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('button', { name: 'Acid 24', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('slider', { name: 'Cutoff' })).toHaveAttribute(
			'aria-valuenow',
			'28'
		);
	});
});

test.describe('Acid Bass V2: step editor sequencer powers', () => {
	test('Probability and Gate sliders, and the Ratchet picker, are visible and update the step', async ({
		page
	}) => {
		await openBassStepsTab(page);
		await page.getByLabel(/^Bass step 1,/).click();

		const probability = page.getByRole('slider', { name: 'Probability' });
		await expect(probability).toHaveValue('100');
		await probability.fill('50');
		await expect(probability).toHaveValue('50');

		const gate = page.getByRole('slider', { name: 'Gate' });
		await expect(gate).toHaveValue('82');

		const ratchetX2 = page.getByRole('button', { name: 'x2', exact: true });
		await ratchetX2.click();
		await expect(ratchetX2).toHaveAttribute('aria-pressed', 'true');
	});

	test('Slide is disabled once Ratchet is above x1', async ({ page }) => {
		await openBassStepsTab(page);
		await page.getByLabel(/^Bass step 1,/).click();

		const slide = page.getByRole('checkbox', { name: 'Slide' });
		await expect(slide).toBeEnabled();

		await page.getByRole('button', { name: 'x3', exact: true }).click();
		await expect(slide).toBeDisabled();

		await page.getByRole('button', { name: 'x1', exact: true }).click();
		await expect(slide).toBeEnabled();
	});

	test('parameter locks: expanding "+ Add Lock", locking Cutoff reveals its slider, and Clear locks removes it', async ({
		page
	}) => {
		await openBassStepsTab(page);
		await page.getByLabel(/^Bass step 1,/).click();

		await page.getByRole('button', { name: '+ Add Lock' }).click();
		const cutoffLock = page.getByRole('checkbox', { name: 'Lock Cutoff' });
		await expect(cutoffLock).not.toBeChecked();
		await expect(page.getByRole('slider', { name: 'Cutoff lock value' })).not.toBeVisible();

		await cutoffLock.check();
		await expect(page.getByRole('slider', { name: 'Cutoff lock value' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Clear locks' })).toBeVisible();

		await page.getByRole('button', { name: 'Clear locks' }).click();
		await expect(cutoffLock).not.toBeChecked();
		await expect(page.getByRole('button', { name: 'Clear locks' })).not.toBeVisible();
	});
});
