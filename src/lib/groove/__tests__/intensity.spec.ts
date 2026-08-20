import { describe, expect, it } from 'vitest';
import { stepShouldSound } from '../intensity';

describe('stepShouldSound', () => {
	it('never sounds an off step, regardless of intensity', () => {
		expect(stepShouldSound({ velocity: 0 }, 100)).toBe(false);
		expect(stepShouldSound({ velocity: 0, minIntensity: 0 }, 100)).toBe(false);
	});

	it('always sounds an on step with no minIntensity authored', () => {
		expect(stepShouldSound({ velocity: 0.7 }, 0)).toBe(true);
		expect(stepShouldSound({ velocity: 0.7 }, 100)).toBe(true);
	});

	it('gates on minIntensity when authored', () => {
		const step = { velocity: 0.7 as const, minIntensity: 70 };
		expect(stepShouldSound(step, 69)).toBe(false);
		expect(stepShouldSound(step, 70)).toBe(true);
		expect(stepShouldSound(step, 100)).toBe(true);
	});
});
