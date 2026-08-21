import { describe, expect, it } from 'vitest';

import { getAcidBassFactoryPatch, listAcidBassFactoryPatches } from '../factory-patches';

describe('listAcidBassFactoryPatches', () => {
	it('lists exactly the eight curated presets, each with a unique id', () => {
		const presets = listAcidBassFactoryPatches();
		expect(presets).toHaveLength(8);
		expect(new Set(presets.map((p) => p.id)).size).toBe(8);
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

	it('deep-sub actually enables the sub oscillator, and slow-motion actually enables the LFO', () => {
		expect(getAcidBassFactoryPatch('deep-sub')?.oscillator.subEnabled).toBe(true);
		expect(getAcidBassFactoryPatch('slow-motion')?.lfo.enabled).toBe(true);
	});
});
