import { describe, expect, it } from 'vitest';

import { getDistortionCurve } from '../distortion';
import type { AcidDistortionCharacter } from '../types';

const CHARACTERS: AcidDistortionCharacter[] = ['soft', 'diode', 'hard'];

describe('getDistortionCurve: shape', () => {
	it('every character produces a finite, bounded -1..1 curve', () => {
		for (const character of CHARACTERS) {
			const curve = getDistortionCurve(character);
			expect(curve.length).toBeGreaterThan(0);
			for (const value of curve) {
				expect(Number.isFinite(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(-1);
				expect(value).toBeLessThanOrEqual(1);
			}
		}
	});

	it('every curve passes through (or extremely near) the origin -- silence in, silence out', () => {
		for (const character of CHARACTERS) {
			const curve = getDistortionCurve(character);
			const midIndex = Math.floor((curve.length - 1) / 2);
			expect(Math.abs(curve[midIndex])).toBeLessThan(0.05);
		}
	});

	it('every curve is monotonically non-decreasing -- distortion shapes, never inverts, the signal', () => {
		for (const character of CHARACTERS) {
			const curve = getDistortionCurve(character);
			for (let i = 1; i < curve.length; i++) {
				expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-9);
			}
		}
	});
});

describe('getDistortionCurve: caching', () => {
	it('returns the exact same Float32Array instance on repeated calls for the same character', () => {
		expect(getDistortionCurve('soft')).toBe(getDistortionCurve('soft'));
		expect(getDistortionCurve('diode')).toBe(getDistortionCurve('diode'));
		expect(getDistortionCurve('hard')).toBe(getDistortionCurve('hard'));
	});

	it('different characters get different curve instances', () => {
		expect(getDistortionCurve('soft')).not.toBe(getDistortionCurve('diode'));
		expect(getDistortionCurve('diode')).not.toBe(getDistortionCurve('hard'));
	});
});

describe('getDistortionCurve: character distinctness', () => {
	it('soft, diode, and hard produce genuinely different curves', () => {
		const soft = getDistortionCurve('soft');
		const diode = getDistortionCurve('diode');
		const hard = getDistortionCurve('hard');
		expect(Array.from(soft)).not.toEqual(Array.from(diode));
		expect(Array.from(soft)).not.toEqual(Array.from(hard));
		expect(Array.from(diode)).not.toEqual(Array.from(hard));
	});

	it('diode is asymmetric -- its positive and negative halves are not mirror images', () => {
		const diode = getDistortionCurve('diode');
		const lastIndex = diode.length - 1;
		// Sample near the extremes: a symmetric curve satisfies curve[i] === -curve[lastIndex - i].
		expect(Math.abs(diode[lastIndex] + diode[0])).toBeGreaterThan(0.05);
	});

	it('soft and hard are symmetric -- mirror images around the origin', () => {
		for (const character of ['soft', 'hard'] as const) {
			const curve = getDistortionCurve(character);
			const lastIndex = curve.length - 1;
			for (let i = 0; i < curve.length; i++) {
				expect(curve[i]).toBeCloseTo(-curve[lastIndex - i], 5);
			}
		}
	});

	it('hard clips more aggressively than soft at the same input magnitude', () => {
		const soft = getDistortionCurve('soft');
		const hard = getDistortionCurve('hard');
		// A moderate positive input (3/4 of the way to full scale) should
		// already be much closer to the ceiling on Hard than on Soft.
		const index = Math.floor((soft.length - 1) * 0.875);
		expect(hard[index]).toBeGreaterThan(soft[index]);
	});
});

describe('getDistortionCurve: soft matches the pre-M16 fixed curve exactly', () => {
	it('reproduces tanh(x * 1.5) sample-for-sample', () => {
		const curve = getDistortionCurve('soft');
		const samples = curve.length;
		for (let i = 0; i < samples; i++) {
			const x = (i / (samples - 1)) * 2 - 1;
			expect(curve[i]).toBeCloseTo(Math.tanh(x * 1.5), 6);
		}
	});
});
