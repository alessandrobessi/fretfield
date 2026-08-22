import { expect, test } from '@playwright/test';

/**
 * Acid Bass V2's UI additions (~/Downloads/ACID-BASS-ENGINE-V2.md M8): the
 * VCO/VCF/ENV/MOD/OUTPUT panel layout (all controls always visible -- no
 * Advanced disclosure) and the step editor's sequencer powers (Probability/
 * Ratchet/Gate/Locks). No real-audio assertions, matching this app's
 * existing testing boundary (see acid-bass.e2e.ts) -- only UI/state.
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
	test('VCO/SUB/OSC 2/VCF/ENV/LFO 1/LFO 2/OUTPUT sections, and every control including the advanced ones, are all visible at once', async ({
		page
	}) => {
		await openBassTab(page);

		await expect(page.getByRole('heading', { name: 'VCO', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'SUB', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'OSC 2', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'VCF' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'ENV' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'LFO 1', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'LFO 2', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'OUTPUT' })).toBeVisible();

		const vcoPanel = page.getByRole('region', { name: 'VCO', exact: true });
		await expect(vcoPanel.getByRole('slider', { name: 'Tune', exact: true })).toBeVisible();
		await expect(vcoPanel.getByRole('slider', { name: 'Fine', exact: true })).toBeVisible();
		const osc2Panel = page.getByRole('region', { name: 'OSC 2', exact: true });
		await expect(osc2Panel.getByRole('slider', { name: 'Tune', exact: true })).toBeVisible();
		await expect(osc2Panel.getByRole('slider', { name: 'Fine', exact: true })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Key Tracking' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Attack' })).toBeVisible();
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

	test('each LFO On/Off toggles independently, and each Destination picker selects independently', async ({
		page
	}) => {
		await openBassTab(page);

		const lfo1Panel = page.getByRole('region', { name: 'LFO 1', exact: true });
		const lfo2Panel = page.getByRole('region', { name: 'LFO 2', exact: true });

		const lfo1Toggle = lfo1Panel.getByRole('button', { name: 'LFO' });
		await expect(lfo1Toggle).toHaveAttribute('aria-pressed', 'false');
		await lfo1Toggle.click();
		await expect(lfo1Toggle).toHaveAttribute('aria-pressed', 'true');

		const lfo2Toggle = lfo2Panel.getByRole('button', { name: 'LFO' });
		await expect(lfo2Toggle).toHaveAttribute('aria-pressed', 'false');

		const lfo1Pitch = lfo1Panel.getByRole('button', { name: 'Pitch', exact: true });
		await lfo1Pitch.click();
		await expect(lfo1Pitch).toHaveAttribute('aria-pressed', 'true');

		const lfo2Cutoff = lfo2Panel.getByRole('button', { name: 'Cutoff', exact: true });
		await expect(lfo2Cutoff).toHaveAttribute('aria-pressed', 'true');
		const lfo2Pitch = lfo2Panel.getByRole('button', { name: 'Pitch', exact: true });
		await expect(lfo2Pitch).toHaveAttribute('aria-pressed', 'false');
	});

	test('each LFO panel renders its own modulation-preview scope, sized to a real rendered area', async ({
		page
	}) => {
		await openBassTab(page);

		const lfo1Scope = page.getByRole('region', { name: 'LFO 1', exact: true }).locator('canvas');
		const lfo2Scope = page.getByRole('region', { name: 'LFO 2', exact: true }).locator('canvas');
		await expect(lfo1Scope).toBeVisible();
		await expect(lfo2Scope).toBeVisible();

		const box1 = await lfo1Scope.boundingBox();
		const box2 = await lfo2Scope.boundingBox();
		expect(box1?.width).toBeGreaterThan(0);
		expect(box1?.height).toBeGreaterThan(0);
		expect(box2?.width).toBeGreaterThan(0);
		expect(box2?.height).toBeGreaterThan(0);
	});
});

test.describe('Acid Bass V2: Osc 2', () => {
	test('Osc 2 On/Off toggles, its Wave picker selects, and its knobs update state', async ({
		page
	}) => {
		await openBassTab(page);

		const osc2Panel = page.getByRole('region', { name: 'OSC 2', exact: true });

		const osc2Toggle = osc2Panel.getByRole('button', { name: 'Osc 2', exact: true });
		await expect(osc2Toggle).toHaveAttribute('aria-pressed', 'false');
		await osc2Toggle.click();
		await expect(osc2Toggle).toHaveAttribute('aria-pressed', 'true');

		const osc2Square = osc2Panel
			.getByRole('group', { name: 'Wave', exact: true })
			.getByRole('button', { name: 'Square', exact: true });
		await osc2Square.click();
		await expect(osc2Square).toHaveAttribute('aria-pressed', 'true');

		const osc2Level = osc2Panel.getByRole('slider', { name: 'Level', exact: true });
		await osc2Level.focus();
		await osc2Level.press('Home');
		for (let i = 0; i < 6; i++) {
			await osc2Level.press('PageUp');
		}
		await expect(osc2Level).toHaveAttribute('aria-valuenow', '60');
	});

	test('LFO 1 can target Osc 2 Level, independent of LFO 2', async ({ page }) => {
		await openBassTab(page);

		const lfo1Panel = page.getByRole('region', { name: 'LFO 1', exact: true });
		const lfo2Panel = page.getByRole('region', { name: 'LFO 2', exact: true });

		await lfo1Panel.getByRole('button', { name: 'Osc 2 Level', exact: true }).click();
		await expect(
			lfo1Panel.getByRole('button', { name: 'Osc 2 Level', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await expect(lfo2Panel.getByRole('button', { name: 'Cutoff', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});
});

test.describe('Acid Bass V2: factory patches', () => {
	test('applying "Classic Acid" writes resolved patch values -- Saw, Acid 24, and a moved Cutoff knob', async ({
		page
	}) => {
		await openBassTab(page);

		await expect(
			page
				.getByRole('region', { name: 'VCO', exact: true })
				.getByRole('group', { name: 'Wave', exact: true })
				.getByRole('button', { name: 'Saw', exact: true })
		).toHaveAttribute('aria-pressed', 'true');

		await page.getByLabel('Patch', { exact: true }).selectOption('classic-acid');

		await expect(
			page
				.getByRole('region', { name: 'VCO', exact: true })
				.getByRole('group', { name: 'Wave', exact: true })
				.getByRole('button', { name: 'Saw', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
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

test.describe('Acid Bass V2: pattern transforms', () => {
	test("Rotate right moves the last step's content to the front", async ({ page }) => {
		await openBassStepsTab(page);

		const step1 = page.getByLabel(/^Bass step 1,/);
		await expect(step1).toHaveAttribute('aria-label', /interval 1,/);

		await page.getByRole('button', { name: 'Rotate ▶', exact: true }).click();

		// The default pattern's last step is an accented b3 -- after rotating
		// right, that content now lives on step 1.
		await expect(step1).toHaveAttribute('aria-label', /interval b3,/);
	});

	test('Simplify and Densify are visible and clickable without throwing', async ({ page }) => {
		await openBassStepsTab(page);

		await page.getByRole('button', { name: 'Simplify', exact: true }).click();
		await page.getByRole('button', { name: 'Densify', exact: true }).click();
		await page.getByRole('button', { name: 'Octave ▲', exact: true }).click();
		await page.getByRole('button', { name: 'Octave ▼', exact: true }).click();
		await page.getByRole('button', { name: 'Clear All Locks', exact: true }).click();

		// Still a healthy, responsive page after all five transforms.
		await expect(page.getByRole('group', { name: 'Bass steps' })).toBeVisible();
	});
});
