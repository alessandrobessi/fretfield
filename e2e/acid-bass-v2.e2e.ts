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
	await page.getByRole('button', { name: 'Editor', exact: true }).click();
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
		await expect(page.getByRole('heading', { name: 'ENV', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'LFO 1', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'LFO 2', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'ENV MOD' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'ACCENT MOD' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'RANDOM MOD' })).toBeVisible();
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

	test('Sub On/Off toggles (lighting its panel LED), and the Filter Model picker selects', async ({
		page
	}) => {
		await openBassTab(page);

		const subPanel = page.getByRole('region', { name: 'SUB', exact: true });
		const subToggle = subPanel.getByRole('button', { name: 'Sub oscillator' });
		const subLed = subPanel.locator('.led');
		await expect(subToggle).toHaveAttribute('aria-pressed', 'false');
		await expect(subLed).not.toHaveClass(/active/);
		await subToggle.click();
		await expect(subToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(subLed).toHaveClass(/active/);

		const squelch = page.getByRole('button', { name: 'Squelch', exact: true });
		await expect(squelch).toHaveAttribute('aria-pressed', 'true');
		const classic = page.getByRole('button', { name: 'Classic', exact: true });
		await classic.click();
		await expect(classic).toHaveAttribute('aria-pressed', 'true');
		await expect(squelch).toHaveAttribute('aria-pressed', 'false');
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

test.describe('Acid Bass Intelligence V4: auxiliary modulation (Envelope/Accent/Random, M15)', () => {
	test('each source On/Off toggles independently, and each Destination picker (including Resonance/Drive) selects independently', async ({
		page
	}) => {
		await openBassTab(page);

		const envPanel = page.getByRole('region', { name: 'ENV MOD' });
		const accentPanel = page.getByRole('region', { name: 'ACCENT MOD' });
		const randomPanel = page.getByRole('region', { name: 'RANDOM MOD' });

		const envToggle = envPanel.getByRole('button', { name: 'Env Mod' });
		await expect(envToggle).toHaveAttribute('aria-pressed', 'false');
		await envToggle.click();
		await expect(envToggle).toHaveAttribute('aria-pressed', 'true');

		const accentToggle = accentPanel.getByRole('button', { name: 'Accent Mod' });
		await expect(accentToggle).toHaveAttribute('aria-pressed', 'false');

		const envResonance = envPanel.getByRole('button', { name: 'Resonance', exact: true });
		await envResonance.click();
		await expect(envResonance).toHaveAttribute('aria-pressed', 'true');

		const accentDrive = accentPanel.getByRole('button', { name: 'Drive', exact: true });
		await accentDrive.click();
		await expect(accentDrive).toHaveAttribute('aria-pressed', 'true');
		const accentCutoff = accentPanel.getByRole('button', { name: 'Cutoff', exact: true });
		await expect(accentCutoff).toHaveAttribute('aria-pressed', 'false');

		const randomDestinationOptions = [
			'Cutoff',
			'Resonance',
			'Pitch',
			'Pulse Width',
			'Sub Level',
			'Osc 2 Level',
			'Drive'
		];
		for (const label of randomDestinationOptions) {
			await expect(randomPanel.getByRole('button', { name: label, exact: true })).toBeVisible();
		}
	});

	test('each source has its own bipolar Depth knob', async ({ page }) => {
		await openBassTab(page);

		await expect(
			page.getByRole('region', { name: 'ENV MOD' }).getByRole('slider', { name: 'Depth' })
		).toBeVisible();
		await expect(
			page.getByRole('region', { name: 'ACCENT MOD' }).getByRole('slider', { name: 'Depth' })
		).toBeVisible();
		await expect(
			page.getByRole('region', { name: 'RANDOM MOD' }).getByRole('slider', { name: 'Depth' })
		).toBeVisible();
	});

	test('each source has an LED that lights when on and turns off when toggled off, and a preview scope canvas', async ({
		page
	}) => {
		await openBassTab(page);

		const envPanel = page.getByRole('region', { name: 'ENV MOD' });
		const envToggle = envPanel.getByRole('button', { name: 'Env Mod' });
		const envLed = envPanel.locator('.led');
		const envScope = envPanel.locator('canvas');

		await expect(envToggle).toHaveAttribute('aria-pressed', 'false');
		await expect(envLed).not.toHaveClass(/active/);
		await expect(envScope).toBeVisible();

		await envToggle.click();
		await expect(envToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(envLed).toHaveClass(/active/);

		// Toggling back off actually clears the pressed/LED state -- this is
		// the exact behavior a user reported as "stuck on."
		await envToggle.click();
		await expect(envToggle).toHaveAttribute('aria-pressed', 'false');
		await expect(envLed).not.toHaveClass(/active/);
	});

	test('aux modulation settings survive a reload', async ({ page }) => {
		await openBassTab(page);

		const randomPanel = page.getByRole('region', { name: 'RANDOM MOD' });
		const randomToggle = randomPanel.getByRole('button', { name: 'Random Mod' });
		await randomToggle.click();
		await expect(randomToggle).toHaveAttribute('aria-pressed', 'true');
		await randomPanel.getByRole('button', { name: 'Pitch', exact: true }).click();

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		const reloadedRandomPanel = page.getByRole('region', { name: 'RANDOM MOD' });
		await expect(reloadedRandomPanel.getByRole('button', { name: 'Random Mod' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			reloadedRandomPanel.getByRole('button', { name: 'Pitch', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Acid Bass Intelligence V4: distortion characters (M16)', () => {
	test('the Character picker in OUTPUT selects Soft/Diode/Hard, and survives a reload', async ({
		page
	}) => {
		await openBassTab(page);

		const outputPanel = page.getByRole('region', { name: 'OUTPUT' });
		const soft = outputPanel.getByRole('button', { name: 'Soft', exact: true });
		const diode = outputPanel.getByRole('button', { name: 'Diode', exact: true });
		const hard = outputPanel.getByRole('button', { name: 'Hard', exact: true });

		// Soft is the default (every existing/migrated patch must sound the same).
		await expect(soft).toHaveAttribute('aria-pressed', 'true');
		await expect(diode).toHaveAttribute('aria-pressed', 'false');

		await diode.click();
		await expect(diode).toHaveAttribute('aria-pressed', 'true');
		await expect(soft).toHaveAttribute('aria-pressed', 'false');

		await hard.click();
		await expect(hard).toHaveAttribute('aria-pressed', 'true');
		await expect(diode).toHaveAttribute('aria-pressed', 'false');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await expect(
			page
				.getByRole('region', { name: 'OUTPUT' })
				.getByRole('button', { name: 'Hard', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	});
});

test.describe('Acid Bass Intelligence V4: tempo-synced delay (M17)', () => {
	test('is off by default (dry at migration defaults), toggles on, and its Division/Feedback/Mix controls all update state', async ({
		page
	}) => {
		await openBassTab(page);

		const delayPanel = page.getByRole('region', { name: 'DELAY' });
		const delayToggle = delayPanel.getByRole('button', { name: 'Delay' });
		const delayLed = delayPanel.locator('.led');

		await expect(delayToggle).toHaveAttribute('aria-pressed', 'false');
		await expect(delayLed).not.toHaveClass(/active/);
		await delayToggle.click();
		await expect(delayToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(delayLed).toHaveClass(/active/);

		const division = delayPanel.getByRole('combobox', { name: 'Delay Division' });
		await division.selectOption('1/8T');
		await expect(division).toHaveValue('1/8T');

		const feedback = delayPanel.getByRole('slider', { name: 'Feedback' });
		await feedback.focus();
		await feedback.press('End');
		await expect(feedback).toHaveAttribute('aria-valuenow', '100');

		const mix = delayPanel.getByRole('slider', { name: 'Mix' });
		await mix.focus();
		await mix.press('End');
		await expect(mix).toHaveAttribute('aria-valuenow', '100');
	});

	test('delay settings survive a reload', async ({ page }) => {
		await openBassTab(page);

		const delayPanel = page.getByRole('region', { name: 'DELAY' });
		await delayPanel.getByRole('button', { name: 'Delay' }).click();
		await delayPanel.getByRole('combobox', { name: 'Delay Division' }).selectOption('1/16D');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		const reloadedDelayPanel = page.getByRole('region', { name: 'DELAY' });
		await expect(reloadedDelayPanel.getByRole('button', { name: 'Delay' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(reloadedDelayPanel.getByRole('combobox', { name: 'Delay Division' })).toHaveValue(
			'1/16D'
		);
	});
});

test.describe('Acid Bass: knob glossary', () => {
	test('is hidden by default, and the toggle button shows/hides a GLOSSARY panel covering every control section', async ({
		page
	}) => {
		await openBassTab(page);

		await expect(page.getByRole('region', { name: 'GLOSSARY' })).toHaveCount(0);

		const toggle = page.getByRole('button', { name: 'Knob glossary' });
		await expect(toggle).toHaveText('Show Glossary');
		await toggle.click();
		await expect(toggle).toHaveText('Hide Glossary');

		const glossary = page.getByRole('region', { name: 'GLOSSARY' });
		await expect(glossary).toBeVisible();
		for (const section of [
			'VCO',
			'SUB',
			'OSC 2',
			'VCF',
			'ENV',
			'LFO 1 / LFO 2',
			'ENV MOD / ACCENT MOD / RANDOM MOD',
			'DELAY',
			'OUTPUT'
		]) {
			await expect(glossary.getByText(section, { exact: true })).toBeVisible();
		}
		await expect(glossary.getByText('Cutoff', { exact: true }).first()).toBeVisible();

		await toggle.click();
		await expect(toggle).toHaveText('Show Glossary');
		await expect(page.getByRole('region', { name: 'GLOSSARY' })).toHaveCount(0);
	});
});

test.describe('Acid Bass: ENV Sustain', () => {
	test('defaults to 100 (full peak), updates via keyboard, and survives a reload', async ({
		page
	}) => {
		await openBassTab(page);

		const envPanel = page.getByRole('region', { name: 'ENV', exact: true });
		const sustain = envPanel.getByRole('slider', { name: 'Sustain' });
		await expect(sustain).toHaveAttribute('aria-valuenow', '100');

		await sustain.focus();
		await sustain.press('Home');
		for (let i = 0; i < 6; i++) {
			await sustain.press('PageUp');
		}
		await expect(sustain).toHaveAttribute('aria-valuenow', '60');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await expect(
			page
				.getByRole('region', { name: 'ENV', exact: true })
				.getByRole('slider', { name: 'Sustain' })
		).toHaveAttribute('aria-valuenow', '60');
	});

	test('the ENV panel renders its own envelope-shape preview scope, sized to a real rendered area', async ({
		page
	}) => {
		await openBassTab(page);

		const scope = page.getByRole('region', { name: 'ENV', exact: true }).locator('canvas');
		await expect(scope).toBeVisible();
		const box = await scope.boundingBox();
		expect(box?.width).toBeGreaterThan(0);
		expect(box?.height).toBeGreaterThan(0);
	});
});

test.describe('Acid Bass: live audio-tap scopes (OUTPUT, DELAY)', () => {
	test('both the OUTPUT and DELAY panels render their own scope, idle before playback and still present once playing', async ({
		page
	}) => {
		await openBassTab(page);

		const outputScope = page.getByRole('region', { name: 'OUTPUT', exact: true }).locator('canvas');
		const delayScope = page.getByRole('region', { name: 'DELAY', exact: true }).locator('canvas');
		for (const scope of [outputScope, delayScope]) {
			await expect(scope).toBeVisible();
			const box = await scope.boundingBox();
			expect(box?.width).toBeGreaterThan(0);
			expect(box?.height).toBeGreaterThan(0);
		}

		// Real taps on the actual voice's own signal graph (see
		// AcidBassAudioScope.svelte's own doc comment) -- idle before playback,
		// since there's no voice yet.
		await expect(page.getByRole('button', { name: /^Bass (On|Off)$/ })).toHaveText('Bass Off');

		await page.getByRole('button', { name: /^Bass (On|Off)$/ }).click();
		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		// No real-audio assertions here, matching this app's existing testing
		// boundary -- just confirming both scopes survive the transition into a
		// real voice existing, rather than erroring or disappearing.
		await expect(outputScope).toBeVisible();
		await expect(delayScope).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
	});
});

test.describe('Acid Bass V2: Osc 2', () => {
	test('Osc 2 On/Off toggles (lighting its panel LED), its Wave picker selects, and its knobs update state', async ({
		page
	}) => {
		await openBassTab(page);

		const osc2Panel = page.getByRole('region', { name: 'OSC 2', exact: true });
		const osc2Led = osc2Panel.locator('.led');

		const osc2Toggle = osc2Panel.getByRole('button', { name: 'Osc 2', exact: true });
		await expect(osc2Toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(osc2Led).not.toHaveClass(/active/);
		await osc2Toggle.click();
		await expect(osc2Toggle).toHaveAttribute('aria-pressed', 'true');
		await expect(osc2Led).toHaveClass(/active/);

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
	test('applying "Classic Acid" writes resolved patch values -- Saw, Squelch filter, and a moved Cutoff knob', async ({
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
		await expect(page.getByRole('button', { name: 'Squelch', exact: true })).toHaveAttribute(
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
