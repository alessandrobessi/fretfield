import { describe, expect, it } from 'vitest';
import {
	createEmptyGroove,
	createEmptyPattern,
	setArrangementBar,
	setStepVelocity,
	setSwing,
	stepOffsetMs,
	toggleStep
} from '../pattern';
import { STEPS_PER_BAR, type PatternRole } from '../types';

describe('createEmptyPattern', () => {
	it('has 16 off steps per voice', () => {
		const pattern = createEmptyPattern();
		expect(pattern.steps.kick).toHaveLength(STEPS_PER_BAR);
		expect(pattern.steps.kick.every((step) => step.velocity === 0)).toBe(true);
		expect(pattern.steps.snare.every((step) => step.velocity === 0)).toBe(true);
		expect(pattern.steps.closedHat.every((step) => step.velocity === 0)).toBe(true);
		expect(pattern.steps.openHat.every((step) => step.velocity === 0)).toBe(true);
	});
});

describe('createEmptyGroove', () => {
	it('has four empty patterns, a one-bar arrangement, and 0 swing', () => {
		const groove = createEmptyGroove();
		expect(Object.keys(groove.patterns).sort()).toEqual(['A', 'B', 'F', 'T']);
		expect(groove.arrangement).toEqual(['A']);
		expect(groove.swing).toBe(0);
	});
});

describe('setStepVelocity / toggleStep', () => {
	it('sets only the targeted voice/step, leaving the rest untouched', () => {
		const pattern = createEmptyPattern();
		const updated = setStepVelocity(pattern, 'kick', 3, 1);
		expect(updated.steps.kick[3].velocity).toBe(1);
		expect(updated.steps.kick.filter((step) => step.velocity !== 0)).toHaveLength(1);
		expect(updated.steps.snare.every((step) => step.velocity === 0)).toBe(true);
		// The original pattern is untouched (pure function).
		expect(pattern.steps.kick[3].velocity).toBe(0);
	});

	it('toggleStep flips between off and normal', () => {
		const pattern = createEmptyPattern();
		const once = toggleStep(pattern, 'snare', 5);
		expect(once.steps.snare[5].velocity).toBe(0.7);
		const twice = toggleStep(once, 'snare', 5);
		expect(twice.steps.snare[5].velocity).toBe(0);
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

describe('setArrangementBar', () => {
	it('assigns a role to a bar without disturbing other bars', () => {
		const arrangement: PatternRole[] = ['A', 'A', 'A', 'A'];
		const groove = { ...createEmptyGroove(), arrangement };
		const updated = setArrangementBar(groove, 3, 'B');
		expect(updated.arrangement).toEqual(['A', 'A', 'A', 'B']);
		// The original arrangement array is untouched (pure function).
		expect(groove.arrangement).toEqual(['A', 'A', 'A', 'A']);
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
