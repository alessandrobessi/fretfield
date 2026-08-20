import { describe, expect, it } from 'vitest';
import { createEmptyGroove, setSwing, STEPS_PER_BAR, stepOffsetMs, toggleStep } from '../groove';

describe('createEmptyGroove', () => {
	it('has 16 false steps per voice and 0 swing', () => {
		const groove = createEmptyGroove();
		expect(groove.swing).toBe(0);
		expect(groove.steps.kick).toHaveLength(STEPS_PER_BAR);
		expect(groove.steps.kick.every((on) => on === false)).toBe(true);
		expect(groove.steps.snare.every((on) => on === false)).toBe(true);
		expect(groove.steps.closedHat.every((on) => on === false)).toBe(true);
		expect(groove.steps.openHat.every((on) => on === false)).toBe(true);
	});
});

describe('toggleStep', () => {
	it('flips only the targeted voice/step, leaving the rest untouched', () => {
		const groove = createEmptyGroove();
		const toggled = toggleStep(groove, 'kick', 3);
		expect(toggled.steps.kick[3]).toBe(true);
		expect(toggled.steps.kick.filter((on) => on).length).toBe(1);
		expect(toggled.steps.snare.every((on) => on === false)).toBe(true);
		// The original pattern is untouched (pure function).
		expect(groove.steps.kick[3]).toBe(false);
	});

	it('toggling twice returns to off', () => {
		const groove = createEmptyGroove();
		const once = toggleStep(groove, 'snare', 5);
		const twice = toggleStep(once, 'snare', 5);
		expect(twice.steps.snare[5]).toBe(false);
	});
});

describe('setSwing', () => {
	it('clamps to 0-100', () => {
		const groove = createEmptyGroove();
		expect(setSwing(groove, -10).swing).toBe(0);
		expect(setSwing(groove, 150).swing).toBe(100);
		expect(setSwing(groove, 42).swing).toBe(42);
	});
});

describe('stepOffsetMs', () => {
	it('never delays on-beat (multiple of 4) steps, regardless of swing', () => {
		for (const step of [0, 4, 8, 12]) {
			expect(stepOffsetMs(step, 120, 100)).toBe(0);
		}
	});

	it('never delays 16th-only offbeat steps (not a multiple-of-4-plus-2 index)', () => {
		for (const step of [1, 3, 5, 7, 9, 11, 13, 15]) {
			expect(stepOffsetMs(step, 120, 80)).toBe(0);
		}
	});

	it('is zero at 0% swing even on a swingable step', () => {
		expect(stepOffsetMs(2, 120, 0)).toBe(0);
	});

	it('delays the "and" of each beat (steps 2, 6, 10, 14) proportionally to swing', () => {
		const bpm = 120;
		const beatDurationMs = 60_000 / bpm;
		const fullSwingOffset = beatDurationMs * (1 / 6);

		for (const step of [2, 6, 10, 14]) {
			expect(stepOffsetMs(step, bpm, 100)).toBeCloseTo(fullSwingOffset, 5);
			expect(stepOffsetMs(step, bpm, 50)).toBeCloseTo(fullSwingOffset / 2, 5);
		}
	});
});
