import { describe, expect, it } from 'vitest';

import { advancePulsePhase, polyBlep, pulseOscillatorSample } from '../pulse-oscillator';

const SAMPLE_RATE = 44100;

describe('polyBlep', () => {
	it('is zero away from both edges', () => {
		expect(polyBlep(0.5, 0.01)).toBe(0);
	});

	it('is finite and bounded near both edges, across a range of phase increments', () => {
		for (const dt of [0.001, 0.01, 0.05, 0.2]) {
			for (const t of [0, dt / 2, 1 - dt / 2, 0.999999]) {
				const value = polyBlep(t, dt);
				expect(Number.isFinite(value)).toBe(true);
				expect(Math.abs(value)).toBeLessThan(2);
			}
		}
	});

	it('handles a zero or negative phase increment without dividing by zero', () => {
		expect(polyBlep(0.5, 0)).toBe(0);
		expect(Number.isFinite(polyBlep(0.5, -1))).toBe(true);
	});
});

describe('pulseOscillatorSample', () => {
	function renderCycle(pulseWidth: number, frequencyHz: number): number[] {
		const phaseIncrement = frequencyHz / SAMPLE_RATE;
		const samplesPerCycle = Math.round(1 / phaseIncrement);
		const samples: number[] = [];
		let phase = 0;
		for (let i = 0; i < samplesPerCycle; i++) {
			samples.push(pulseOscillatorSample(phase, pulseWidth, phaseIncrement));
			phase = (phase + phaseIncrement) % 1;
		}
		return samples;
	}

	it('stays finite and roughly bounded across a sweep of pulse widths and frequencies', () => {
		for (const pulseWidth of [0.05, 0.25, 0.5, 0.75, 0.95]) {
			for (const frequencyHz of [40, 440, 4000, 12000]) {
				for (const s of renderCycle(pulseWidth, frequencyHz)) {
					expect(Number.isFinite(s)).toBe(true);
					expect(Math.abs(s)).toBeLessThan(2);
				}
			}
		}
	});

	it('spends roughly `pulseWidth` of the cycle high and the rest low, away from the smoothed edges', () => {
		const samples = renderCycle(0.25, 440);
		const highCount = samples.filter((s) => s > 0.5).length;
		const ratio = highCount / samples.length;
		expect(ratio).toBeGreaterThan(0.15);
		expect(ratio).toBeLessThan(0.35);
	});

	it('a 50% pulse width is symmetric: roughly half the cycle high, half low', () => {
		const samples = renderCycle(0.5, 440);
		const highCount = samples.filter((s) => s > 0).length;
		const ratio = highCount / samples.length;
		expect(ratio).toBeGreaterThan(0.4);
		expect(ratio).toBeLessThan(0.6);
	});
});

describe('advancePulsePhase', () => {
	it('wraps back into [0, 1)', () => {
		let phase = 0;
		for (let i = 0; i < 10000; i++) {
			phase = advancePulsePhase(phase, 4000, SAMPLE_RATE);
			expect(phase).toBeGreaterThanOrEqual(0);
			expect(phase).toBeLessThan(1);
		}
	});

	it('advances by frequency/sampleRate per call', () => {
		const phase = advancePulsePhase(0, 441, 44100);
		expect(phase).toBeCloseTo(0.01, 5);
	});
});
