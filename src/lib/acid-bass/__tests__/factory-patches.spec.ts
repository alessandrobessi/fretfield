import { describe, expect, it } from 'vitest';

import { getAcidBassFactoryPatch, listAcidBassFactoryPatches } from '../factory-patches';

describe('listAcidBassFactoryPatches', () => {
	it('lists exactly the fourteen curated presets (eight V2 + six genre presets), each with a unique id', () => {
		const presets = listAcidBassFactoryPatches();
		expect(presets).toHaveLength(14);
		expect(new Set(presets.map((p) => p.id)).size).toBe(14);
	});

	it('every preset has a non-empty label and description', () => {
		for (const preset of listAcidBassFactoryPatches()) {
			expect(preset.label.length).toBeGreaterThan(0);
			expect(preset.description.length).toBeGreaterThan(0);
		}
	});
});

describe('getAcidBassFactoryPatch', () => {
	it('returns undefined for an unrecognized id rather than throwing', () => {
		expect(getAcidBassFactoryPatch('not-a-real-preset')).toBeUndefined();
		expect(getAcidBassFactoryPatch('')).toBeUndefined();
	});

	it('resolves every listed id to a full, valid AcidBassPatch', () => {
		for (const { id } of listAcidBassFactoryPatches()) {
			const patch = getAcidBassFactoryPatch(id);
			expect(patch).toBeDefined();
			expect(patch?.oscillator.mainWave).toBeDefined();
			expect(patch?.filter.model).toBeDefined();
			expect(patch?.envelope.decay).toBeGreaterThanOrEqual(0);
			expect(patch?.output.volume).toBeGreaterThanOrEqual(0);
		}
	});

	it('returns a fresh object every call -- applying a preset then editing it can never mutate the preset definition', () => {
		const first = getAcidBassFactoryPatch('classic-acid');
		const second = getAcidBassFactoryPatch('classic-acid');
		expect(first).not.toBe(second);
		expect(first).toEqual(second);

		if (first === undefined) throw new Error('expected classic-acid to resolve');
		first.filter.cutoff = 999;
		const third = getAcidBassFactoryPatch('classic-acid');
		expect(third?.filter.cutoff).not.toBe(999);
	});

	it('deep-sub actually enables the sub oscillator, and slow-motion actually enables LFO 1', () => {
		expect(getAcidBassFactoryPatch('deep-sub')?.oscillator.subEnabled).toBe(true);
		expect(getAcidBassFactoryPatch('slow-motion')?.lfo1.enabled).toBe(true);
	});

	it('each V4 genre preset actually engages the one V4 feature its own description promises', () => {
		const houseDeep = getAcidBassFactoryPatch('house-deep');
		expect(houseDeep?.modulation.envelope.enabled).toBe(true);
		expect(houseDeep?.modulation.envelope.destination).toBe('cutoff');

		const rnbVelvet = getAcidBassFactoryPatch('rnb-velvet');
		expect(rnbVelvet?.glide.curve).toBe('exponential');
		expect(rnbVelvet?.glide.time).toBeGreaterThanOrEqual(40);

		const dnbReese = getAcidBassFactoryPatch('dnb-reese');
		expect(dnbReese?.oscillator.osc2Enabled).toBe(true);
		expect(dnbReese?.oscillator.osc2Fine).not.toBe(0);
		expect(dnbReese?.distortion.character).toBe('hard');

		const technoDrive = getAcidBassFactoryPatch('techno-drive');
		expect(technoDrive?.modulation.accent.enabled).toBe(true);
		expect(technoDrive?.modulation.accent.destination).toBe('drive');

		const trancePluck = getAcidBassFactoryPatch('trance-pluck');
		expect(trancePluck?.lfo1.enabled).toBe(true);
		expect(trancePluck?.lfo1.rateMode).toBe('sync');
		expect(trancePluck?.delay.enabled).toBe(true);
	});

	it('bossa-nova is a gentle, long-release patch built from V2-era controls alone', () => {
		const bossaNova = getAcidBassFactoryPatch('bossa-nova');
		expect(bossaNova?.envelope.release).toBeGreaterThanOrEqual(40);
		expect(bossaNova?.envelope.accentAmount).toBeLessThanOrEqual(30);
		expect(bossaNova?.distortion.character).toBe('soft');
		expect(bossaNova?.delay.enabled).toBe(false);
		expect(bossaNova?.modulation.envelope.enabled).toBe(false);
		expect(bossaNova?.modulation.accent.enabled).toBe(false);
		expect(bossaNova?.modulation.random.enabled).toBe(false);
	});

	it('the original eight V2 presets still override none of modulation/distortion/delay, so they keep sounding like their V3 versions', () => {
		const v2PresetIds = [
			'round',
			'classic-acid',
			'deep-sub',
			'rubber',
			'funk-pulse',
			'dirty',
			'clean-track',
			'slow-motion'
		];
		for (const id of v2PresetIds) {
			const patch = getAcidBassFactoryPatch(id);
			expect(patch?.distortion.character).toBe('soft');
			expect(patch?.delay.enabled).toBe(false);
			expect(patch?.modulation.envelope.enabled).toBe(false);
			expect(patch?.modulation.accent.enabled).toBe(false);
			expect(patch?.modulation.random.enabled).toBe(false);
		}
	});
});
