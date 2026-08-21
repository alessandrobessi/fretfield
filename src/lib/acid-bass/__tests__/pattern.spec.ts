import { describe, expect, it } from 'vitest';
import {
	createDefaultAcidBassState,
	createDefaultAcidPattern,
	createDefaultAcidPatch,
	createEmptyAcidStep,
	resizeAcidBassState,
	resizeAcidPattern,
	setAcidStepActive,
	setAcidStepInterval,
	setAcidStepOctave,
	toggleAcidStepAccent,
	toggleAcidStepSlide
} from '../pattern';

describe('createEmptyAcidStep', () => {
	it('is inactive with sensible defaults', () => {
		const step = createEmptyAcidStep();
		expect(step.active).toBe(false);
		expect(step.interval).toBe('1');
		expect(step.octave).toBe(0);
		expect(step.accent).toBe(false);
		expect(step.slide).toBe(false);
	});
});

describe('createDefaultAcidPatch', () => {
	it('is a clean, round starting point (not the extreme "Acid" preset)', () => {
		const patch = createDefaultAcidPatch();
		expect(patch.wave).toBe('saw');
		expect(patch.drive).toBe(0);
	});
});

describe('createDefaultAcidPattern', () => {
	it('always matches the given step count, for every supported meter', () => {
		for (const [stepsPerBar, stepsPerBeatGroup] of [
			[12, 4], // 3/4
			[16, 4], // 4/4
			[20, 4], // 5/4
			[12, 6], // 6/8
			[18, 6], // 9/8
			[24, 6] // 12/8
		]) {
			for (const role of ['A', 'B', 'F', 'T'] as const) {
				expect(createDefaultAcidPattern(stepsPerBar, stepsPerBeatGroup, role)).toHaveLength(
					stepsPerBar
				);
			}
		}
	});

	it('role A starts on an accented root', () => {
		const pattern = createDefaultAcidPattern(16, 4, 'A');
		expect(pattern[0]).toMatchObject({ active: true, interval: '1', accent: true });
	});

	it('role A is not a wall of sixteenths -- most steps are inactive', () => {
		const pattern = createDefaultAcidPattern(16, 4, 'A');
		const activeCount = pattern.filter((step) => step.active).length;
		expect(activeCount).toBeLessThan(pattern.length / 2);
	});

	it('role A demonstrates both accent and slide', () => {
		const pattern = createDefaultAcidPattern(16, 4, 'A');
		expect(pattern.some((step) => step.accent)).toBe(true);
		expect(pattern.some((step) => step.slide)).toBe(true);
	});

	it('a slide step is never the last step of the pattern (it needs a following step to slide into)', () => {
		for (const [stepsPerBar, stepsPerBeatGroup] of [
			[12, 4],
			[16, 4],
			[24, 6]
		]) {
			for (const role of ['A', 'B', 'F', 'T'] as const) {
				const pattern = createDefaultAcidPattern(stepsPerBar, stepsPerBeatGroup, role);
				expect(pattern[pattern.length - 1].slide).toBe(false);
			}
		}
	});

	it('is deterministic', () => {
		expect(createDefaultAcidPattern(16, 4, 'A')).toEqual(createDefaultAcidPattern(16, 4, 'A'));
	});
});

describe('createDefaultAcidBassState', () => {
	it('is disabled by default even though the default pattern has active notes', () => {
		const state = createDefaultAcidBassState(16, 4);
		expect(state.enabled).toBe(false);
		expect(state.patterns.A.some((step) => step.active)).toBe(true);
	});

	it('has all four pattern roles, each sized to stepsPerBar', () => {
		const state = createDefaultAcidBassState(20, 4);
		for (const role of ['A', 'B', 'F', 'T'] as const) {
			expect(state.patterns[role]).toHaveLength(20);
		}
	});
});

describe('step mutators', () => {
	it('setAcidStepActive changes only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.B;
		const updated = setAcidStepActive(pattern, 3, true);
		expect(updated[3].active).toBe(true);
		expect(updated.filter((_, i) => i !== 3)).toEqual(pattern.filter((_, i) => i !== 3));
	});

	it('setAcidStepInterval changes only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		const updated = setAcidStepInterval(pattern, 5, 'b3');
		expect(updated[5].interval).toBe('b3');
		expect(pattern[5].interval).not.toBe('b3');
	});

	it('setAcidStepOctave changes only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		const updated = setAcidStepOctave(pattern, 2, 1);
		expect(updated[2].octave).toBe(1);
	});

	it('toggleAcidStepAccent flips only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		const before = pattern[7].accent;
		const updated = toggleAcidStepAccent(pattern, 7);
		expect(updated[7].accent).toBe(!before);
	});

	it('toggleAcidStepSlide flips only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		const before = pattern[7].slide;
		const updated = toggleAcidStepSlide(pattern, 7);
		expect(updated[7].slide).toBe(!before);
	});
});

describe('resizeAcidPattern', () => {
	it('truncates when shrinking, preserving the prefix', () => {
		const pattern = createDefaultAcidPattern(16, 4, 'A');
		const resized = resizeAcidPattern(pattern, 12);
		expect(resized).toHaveLength(12);
		expect(resized).toEqual(pattern.slice(0, 12));
	});

	it('pads with inactive steps when growing', () => {
		const pattern = createDefaultAcidPattern(12, 4, 'A');
		const resized = resizeAcidPattern(pattern, 16);
		expect(resized).toHaveLength(16);
		expect(resized.slice(0, 12)).toEqual(pattern);
		expect(resized.slice(12).every((step) => !step.active)).toBe(true);
	});
});

describe('resizeAcidBassState', () => {
	it('resizes every role, preserving the on/off state and patch', () => {
		const state = { ...createDefaultAcidBassState(16, 4), enabled: true };
		const resized = resizeAcidBassState(state, 12);
		expect(resized.enabled).toBe(true);
		expect(resized.patch).toEqual(state.patch);
		for (const role of ['A', 'B', 'F', 'T'] as const) {
			expect(resized.patterns[role]).toHaveLength(12);
		}
	});
});
