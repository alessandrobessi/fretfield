import { describe, expect, it } from 'vitest';

import { PATTERN_ROLES } from '$lib/groove/pattern-role';

import { ratchetOffsetsSeconds, resolveStepLocks, stepShouldTrigger } from '../sequencer';

describe('stepShouldTrigger', () => {
	it('always triggers at probability 100, and never at 0, regardless of position', () => {
		for (let bar = 0; bar < 20; bar++) {
			for (let stepIndex = 0; stepIndex < 16; stepIndex++) {
				expect(stepShouldTrigger({ probability: 100 }, bar, stepIndex, 'A')).toBe(true);
				expect(stepShouldTrigger({ probability: 0 }, bar, stepIndex, 'A')).toBe(false);
			}
		}
	});

	it('is deterministic: the same bar/step/role always rolls the same way', () => {
		const first = stepShouldTrigger({ probability: 50 }, 7, 3, 'B');
		const second = stepShouldTrigger({ probability: 50 }, 7, 3, 'B');
		expect(first).toBe(second);
	});

	it('varies across bars at a mid-range probability -- not every bar rolls the same (deterministic, not static)', () => {
		const results = new Set<boolean>();
		for (let bar = 0; bar < 40; bar++) {
			results.add(stepShouldTrigger({ probability: 50 }, bar, 5, 'A'));
		}
		expect(results.size).toBe(2);
	});

	it('a mid-range probability roughly matches its own rate over a wide sample (loose distribution sanity check)', () => {
		let hits = 0;
		const samples = 400;
		for (let bar = 0; bar < samples; bar++) {
			if (stepShouldTrigger({ probability: 30 }, bar, 2, 'F')) hits++;
		}
		const rate = hits / samples;
		expect(rate).toBeGreaterThan(0.15);
		expect(rate).toBeLessThan(0.45);
	});

	it('different steps/roles at the same bar can roll independently', () => {
		const results = new Set<boolean>();
		for (const role of PATTERN_ROLES) {
			for (let stepIndex = 0; stepIndex < 16; stepIndex++) {
				results.add(stepShouldTrigger({ probability: 50 }, 0, stepIndex, role));
			}
		}
		expect(results.size).toBe(2);
	});
});

describe('ratchetOffsetsSeconds', () => {
	it('ratchet 1 is a single un-subdivided hit at offset 0', () => {
		expect(ratchetOffsetsSeconds(1, 0.5)).toEqual([0]);
	});

	it('splits the step duration into `ratchet` equal, increasing offsets', () => {
		const offsets = ratchetOffsetsSeconds(4, 0.4);
		expect(offsets).toHaveLength(4);
		expect(offsets[0]).toBe(0);
		expect(offsets[1]).toBeCloseTo(0.1, 10);
		expect(offsets[2]).toBeCloseTo(0.2, 10);
		expect(offsets[3]).toBeCloseTo(0.3, 10);
	});

	it('every ratchet count produces offsets strictly within [0, stepDurationSeconds)', () => {
		for (const ratchet of [1, 2, 3, 4] as const) {
			for (const offset of ratchetOffsetsSeconds(ratchet, 0.3)) {
				expect(offset).toBeGreaterThanOrEqual(0);
				expect(offset).toBeLessThan(0.3);
			}
		}
	});
});

describe('resolveStepLocks', () => {
	const base = { cutoff: 40, resonance: 20, envAmount: -10, drive: 5, lfoDepth: 0 };

	it('passes every base value through unchanged when there are no locks', () => {
		expect(resolveStepLocks(undefined, base)).toEqual(base);
	});

	it('overrides only the locked targets, leaving the rest at their base value', () => {
		const resolved = resolveStepLocks({ cutoff: 90 }, base);
		expect(resolved.cutoff).toBe(90);
		expect(resolved.resonance).toBe(base.resonance);
		expect(resolved.envAmount).toBe(base.envAmount);
		expect(resolved.drive).toBe(base.drive);
		expect(resolved.lfoDepth).toBe(base.lfoDepth);
	});

	it('overrides multiple targets at once, including lfoDepth (resolved even though nothing reads it yet)', () => {
		const resolved = resolveStepLocks({ resonance: 75, drive: 60, lfoDepth: 40 }, base);
		expect(resolved.resonance).toBe(75);
		expect(resolved.drive).toBe(60);
		expect(resolved.lfoDepth).toBe(40);
		expect(resolved.cutoff).toBe(base.cutoff);
	});
});
