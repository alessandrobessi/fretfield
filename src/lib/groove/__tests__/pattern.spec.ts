import { describe, expect, it } from 'vitest';
import {
	createEmptyGroove,
	createEmptyPattern,
	cycleStepVelocity,
	setArrangementBar,
	setArrangementLength,
	setFeel,
	setFeelAmount,
	setStepVelocity,
	stepOffsetMs
} from '../pattern';
import { DRUM_VOICES, STEPS_PER_BAR, type PatternRole } from '../types';

describe('createEmptyPattern', () => {
	it('has 16 off steps for all six voices', () => {
		const pattern = createEmptyPattern();
		for (const voice of DRUM_VOICES) {
			expect(pattern.steps[voice]).toHaveLength(STEPS_PER_BAR);
			expect(pattern.steps[voice].every((step) => step.velocity === 0)).toBe(true);
		}
	});
});

describe('createEmptyGroove', () => {
	it('has four empty patterns, a one-bar arrangement, and a straight feel', () => {
		const groove = createEmptyGroove();
		expect(Object.keys(groove.patterns).sort()).toEqual(['A', 'B', 'F', 'T']);
		expect(groove.arrangement).toEqual(['A']);
		expect(groove.feel).toBe('straight');
		expect(groove.feelAmount).toBe(0);
	});
});

describe('setStepVelocity', () => {
	it('sets only the targeted voice/step, leaving the rest untouched', () => {
		const pattern = createEmptyPattern();
		const updated = setStepVelocity(pattern, 'kick', 3, 1);
		expect(updated.steps.kick[3].velocity).toBe(1);
		expect(updated.steps.kick.filter((step) => step.velocity !== 0)).toHaveLength(1);
		expect(updated.steps.snare.every((step) => step.velocity === 0)).toBe(true);
		// The original pattern is untouched (pure function).
		expect(pattern.steps.kick[3].velocity).toBe(0);
	});
});

describe('cycleStepVelocity', () => {
	it('advances off -> ghost -> normal -> accent -> off', () => {
		const pattern = createEmptyPattern();
		const ghost = cycleStepVelocity(pattern, 'snare', 5);
		expect(ghost.steps.snare[5].velocity).toBe(0.35);
		const normal = cycleStepVelocity(ghost, 'snare', 5);
		expect(normal.steps.snare[5].velocity).toBe(0.7);
		const accent = cycleStepVelocity(normal, 'snare', 5);
		expect(accent.steps.snare[5].velocity).toBe(1);
		const off = cycleStepVelocity(accent, 'snare', 5);
		expect(off.steps.snare[5].velocity).toBe(0);
	});
});

describe('setFeel / setFeelAmount', () => {
	it('setFeel replaces the feel without touching feelAmount', () => {
		const groove = setFeelAmount(createEmptyGroove(), 65);
		const updated = setFeel(groove, 'shuffle');
		expect(updated.feel).toBe('shuffle');
		expect(updated.feelAmount).toBe(65);
	});

	it('setFeelAmount clamps to 0-100', () => {
		const groove = createEmptyGroove();
		expect(setFeelAmount(groove, -10).feelAmount).toBe(0);
		expect(setFeelAmount(groove, 150).feelAmount).toBe(100);
		expect(setFeelAmount(groove, 42).feelAmount).toBe(42);
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

describe('setArrangementLength', () => {
	it('grows the arrangement, defaulting new bars to role A', () => {
		const groove = createEmptyGroove(); // arrangement: ['A']
		const grown = setArrangementLength(groove, 4);
		expect(grown.arrangement).toEqual(['A', 'A', 'A', 'A']);
	});

	it('preserves existing bar assignments when growing', () => {
		const groove = setArrangementBar(setArrangementLength(createEmptyGroove(), 2), 1, 'B');
		const grown = setArrangementLength(groove, 4);
		expect(grown.arrangement).toEqual(['A', 'B', 'A', 'A']);
	});

	it('truncates from the end when shrinking', () => {
		const groove = setArrangementLength(createEmptyGroove(), 4);
		expect(setArrangementLength(groove, 2).arrangement).toEqual(['A', 'A']);
	});

	it('clamps to a minimum of 1 bar', () => {
		expect(setArrangementLength(createEmptyGroove(), 0).arrangement).toEqual(['A']);
		expect(setArrangementLength(createEmptyGroove(), -3).arrangement).toEqual(['A']);
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
