import { expect, test } from '@playwright/test';

/**
 * A follow-up to the Acid Bass V2 build in this same session (no separate
 * spec doc -- a direct chat request): a second full oscillator (Osc 2,
 * alongside Main and Sub) and a second independent LFO (LFO 1/LFO 2, each
 * still single-destination, not a many-to-many matrix). No real-audio
 * assertions, matching this app's existing testing boundary (see
 * acid-bass.e2e.ts) -- only UI/state. Panel-layout and per-control coverage
 * lives in acid-bass-v2.e2e.ts's own "Osc 2" describe block; this file is
 * specifically the persistence round-trip, mirroring acid-bass.e2e.ts's own
 * "Acid Bass: persistence" tests.
 */

async function openBassTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Bass', exact: true }).click();
}

test.describe('Acid Bass: Osc 2 and dual LFOs survive a reload', () => {
	test('Osc 2 enabled/wave/level, and both LFOs independently, persist across a reload', async ({
		page
	}) => {
		await openBassTab(page);

		const osc2Panel = page.getByRole('region', { name: 'OSC 2', exact: true });

		await osc2Panel.getByRole('button', { name: 'Osc 2', exact: true }).click();
		await osc2Panel
			.getByRole('group', { name: 'Wave', exact: true })
			.getByRole('button', { name: 'Triangle', exact: true })
			.click();
		const osc2Level = osc2Panel.getByRole('slider', { name: 'Level', exact: true });
		await osc2Level.focus();
		await osc2Level.press('Home');
		for (let i = 0; i < 4; i++) {
			await osc2Level.press('PageUp');
		}

		const lfo1Panel = page.getByRole('region', { name: 'LFO 1', exact: true });
		const lfo2Panel = page.getByRole('region', { name: 'LFO 2', exact: true });
		await lfo1Panel.getByRole('button', { name: 'LFO' }).click();
		await lfo1Panel.getByRole('button', { name: 'Osc 2 Level', exact: true }).click();
		await lfo2Panel.getByRole('button', { name: 'LFO' }).click();
		await lfo2Panel.getByRole('button', { name: 'Pitch', exact: true }).click();

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		await expect(osc2Panel.getByRole('button', { name: 'Osc 2', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			osc2Panel
				.getByRole('group', { name: 'Wave', exact: true })
				.getByRole('button', { name: 'Triangle', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await expect(osc2Panel.getByRole('slider', { name: 'Level', exact: true })).toHaveAttribute(
			'aria-valuenow',
			'40'
		);

		const reloadedLfo1Panel = page.getByRole('region', { name: 'LFO 1', exact: true });
		const reloadedLfo2Panel = page.getByRole('region', { name: 'LFO 2', exact: true });
		await expect(reloadedLfo1Panel.getByRole('button', { name: 'LFO' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			reloadedLfo1Panel.getByRole('button', { name: 'Osc 2 Level', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await expect(reloadedLfo2Panel.getByRole('button', { name: 'LFO' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			reloadedLfo2Panel.getByRole('button', { name: 'Pitch', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	});

	test('a pre-existing (version 2) groove migrates forward: its old LFO settings land on LFO 1, LFO 2 and Osc 2 both come back off', async ({
		page
	}) => {
		// Seed a genuinely valid groove through the real UI first (per this
		// suite's own established lesson: hand-crafting a whole `groove` object
		// from scratch risks missing fields -- e.g. `timeSignature` -- that
		// other coercion code assumes exist and crashes without). Then patch
		// only `acidBass` in place, preserving every other already-valid field.
		// Opening the tab alone doesn't persist anything -- an actual setter
		// call (toggling Bass on/off) is what triggers the store's own
		// `persist()`, guaranteeing a complete `groove` object exists.
		await openBassTab(page);
		await page.getByRole('button', { name: /^Bass (On|Off)$/ }).click();

		await page.evaluate(() => {
			const STORAGE_KEY = 'fretfield-scale-practice';
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw === null) throw new Error('expected a groove to already be persisted');
			const config = JSON.parse(raw);
			config.groove.acidBass = {
				version: 2,
				enabled: true,
				patch: {
					oscillator: {
						mainWave: 'square',
						tune: 0,
						fine: 0,
						mainLevel: 100,
						subEnabled: false,
						subOctave: -1,
						subWave: 'square',
						subLevel: 35,
						pulseWidth: 50
					},
					filter: {
						model: 'acid24',
						cutoff: 32,
						resonance: 28,
						envAmount: 30,
						keyTracking: 15,
						saturation: 8
					},
					envelope: { attack: 10, decay: 38, release: 30, accentAmount: 45 },
					glide: { time: 55, curve: 'exponential' },
					lfo: {
						enabled: true,
						shape: 'square',
						destination: 'pitch',
						rateMode: 'free',
						rateHz: 3.5,
						division: '1/8',
						depth: 77
					},
					output: { drive: 4, volume: 70 }
				},
				patterns: { A: [], B: [], F: [], T: [] },
				crossBarSlide: true
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		});

		await page.reload();
		await openBassTab(page);

		const lfo1Panel = page.getByRole('region', { name: 'LFO 1', exact: true });
		const lfo2Panel = page.getByRole('region', { name: 'LFO 2', exact: true });

		await expect(lfo1Panel.getByRole('button', { name: 'LFO' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(lfo1Panel.getByRole('button', { name: 'Pitch', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(lfo1Panel.getByRole('slider', { name: 'Depth' })).toHaveAttribute(
			'aria-valuenow',
			'77'
		);

		await expect(lfo2Panel.getByRole('button', { name: 'LFO' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
		await expect(page.getByRole('button', { name: 'Osc 2', exact: true })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});
});
