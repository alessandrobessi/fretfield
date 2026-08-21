import { describe, expect, it } from 'vitest';

import {
	cutoffHzToOnePoleCoefficient,
	createAcid24LadderState,
	processAcid24LadderSample
} from '../acid24-ladder';

const SAMPLE_RATE = 44100;

function runSamples(
	inputs: number[],
	cutoffHz: number,
	resonance: number,
	drive: number
): number[] {
	const state = createAcid24LadderState();
	const g = cutoffHzToOnePoleCoefficient(cutoffHz, SAMPLE_RATE);
	return inputs.map((input) => processAcid24LadderSample(state, input, g, resonance, drive));
}

describe('cutoffHzToOnePoleCoefficient', () => {
	it('stays within [0, 1] across a wide range of cutoffs, including extreme/negative values', () => {
		for (const hz of [-1000, 0, 20, 1000, 20000, 100000]) {
			const g = cutoffHzToOnePoleCoefficient(hz, SAMPLE_RATE);
			expect(Number.isFinite(g)).toBe(true);
			expect(g).toBeGreaterThanOrEqual(0);
			expect(g).toBeLessThanOrEqual(1);
		}
	});

	it('is monotonically increasing with cutoff frequency', () => {
		const low = cutoffHzToOnePoleCoefficient(200, SAMPLE_RATE);
		const mid = cutoffHzToOnePoleCoefficient(2000, SAMPLE_RATE);
		const high = cutoffHzToOnePoleCoefficient(8000, SAMPLE_RATE);
		expect(mid).toBeGreaterThan(low);
		expect(high).toBeGreaterThan(mid);
	});
});

describe('processAcid24LadderSample: stability', () => {
	it('a constant (DC) input never produces NaN/Infinity and settles to a bounded value', () => {
		const samples = runSamples(new Array(2000).fill(1), 1000, 3.5, 5);
		for (const s of samples) {
			expect(Number.isFinite(s)).toBe(true);
		}
		const last = samples[samples.length - 1];
		expect(Math.abs(last)).toBeLessThan(2);
	});

	it('an impulse input decays to a finite, bounded response, even at maximum resonance', () => {
		const impulse = [1, ...new Array(1999).fill(0)];
		const samples = runSamples(impulse, 2000, 4, 1);
		for (const s of samples) {
			expect(Number.isFinite(s)).toBe(true);
			expect(Math.abs(s)).toBeLessThan(2);
		}
	});

	it('stays finite and bounded across a sweep of cutoff/resonance/drive combinations, near self-oscillation included', () => {
		const cutoffs = [20, 200, 2000, 12000];
		const resonances = [0, 1, 2, 3, 4];
		const drives = [1, 3, 6];
		for (const cutoffHz of cutoffs) {
			for (const resonance of resonances) {
				for (const drive of drives) {
					const state = createAcid24LadderState();
					const g = cutoffHzToOnePoleCoefficient(cutoffHz, SAMPLE_RATE);
					for (let i = 0; i < 500; i++) {
						const input = Math.sin(i * 0.1);
						const out = processAcid24LadderSample(state, input, g, resonance, drive);
						expect(Number.isFinite(out)).toBe(true);
						expect(Math.abs(out)).toBeLessThan(2);
					}
				}
			}
		}
	});

	it('a silent (zero) input stays silent -- no self-starting oscillation from nothing', () => {
		const samples = runSamples(new Array(1000).fill(0), 1000, 4, 1);
		for (const s of samples) {
			expect(s).toBe(0);
		}
	});

	it('higher resonance sustains a longer, more energetic ringing tail after the same impulse (resonant behavior, not just a bigger initial hit)', () => {
		const impulse = [1, ...new Array(400).fill(0)];
		const low = runSamples(impulse, 1000, 0.2, 1);
		const high = runSamples(impulse, 1000, 3.5, 1);
		// Well past the initial transient -- resonance shows up as sustained
		// energy here, not necessarily a taller immediate peak.
		const tailEnergy = (samples: number[]) =>
			samples.slice(100, 400).reduce((sum, s) => sum + s * s, 0);
		expect(tailEnergy(high)).toBeGreaterThan(tailEnergy(low));
	});
});
