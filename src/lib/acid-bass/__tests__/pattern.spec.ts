import { describe, expect, it } from 'vitest';
import {
	clearAcidStepLocks,
	createDefaultAcidBassState,
	createDefaultAcidPattern,
	createDefaultAcidPatch,
	createDefaultGenerationSettings,
	createEmptyAcidStep,
	resizeAcidBassState,
	resizeAcidPattern,
	setAcidStepActive,
	setAcidStepGate,
	setAcidStepInterval,
	setAcidStepLock,
	setAcidStepOctave,
	setAcidStepProbability,
	setAcidStepRatchet,
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
		expect(step.probability).toBe(100);
		expect(step.ratchet).toBe(1);
		expect(step.gate).toBe(82);
		expect(step.locks).toBeUndefined();
	});
});

describe('createDefaultAcidPatch', () => {
	it('defaults to the acid24 filter, not legacy (spec: new users should not default to legacy)', () => {
		const patch = createDefaultAcidPatch();
		expect(patch.oscillator.mainWave).toBe('saw');
		expect(patch.filter.model).toBe('acid24');
	});

	it('is conservative, not screaming -- musical on the first note', () => {
		const patch = createDefaultAcidPatch();
		expect(patch.filter.cutoff).toBeLessThan(50);
		expect(patch.output.drive).toBeLessThan(20);
		expect(patch.lfo1.enabled).toBe(false);
	});

	it('Osc 2 and LFO 2 both default off/neutral -- the patch sounds identical to before either existed', () => {
		const patch = createDefaultAcidPatch();
		expect(patch.oscillator.osc2Enabled).toBe(false);
		expect(patch.oscillator.osc2Level).toBe(0);
		expect(patch.lfo2.enabled).toBe(false);
		expect(patch.lfo2.depth).toBe(0);
	});

	it('V4: modulation/distortion/delay all default off/neutral -- every existing patch keeps sounding like V3', () => {
		const patch = createDefaultAcidPatch();
		expect(patch.modulation.envelope.enabled).toBe(false);
		expect(patch.modulation.accent.enabled).toBe(false);
		expect(patch.modulation.random.enabled).toBe(false);
		expect(patch.distortion.character).toBe('soft');
		expect(patch.delay.enabled).toBe(false);
		expect(patch.delay.mix).toBe(0);
	});
});

describe('createDefaultGenerationSettings', () => {
	it('matches the spec-recommended defaults', () => {
		expect(createDefaultGenerationSettings()).toEqual({
			style: 'acid',
			harmonyMode: 'chord',
			seed: 0x303303,
			density: 62,
			chromaticism: 35,
			movement: 55,
			register: 'zone',
			playability: 75,
			intelligence: 70
		});
	});

	it('returns a fresh object every call, not a shared reference', () => {
		expect(createDefaultGenerationSettings()).not.toBe(createDefaultGenerationSettings());
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

	it('is version 4, in manual mode, with cross-bar slide on by default for freshly-created state', () => {
		const state = createDefaultAcidBassState(16, 4);
		expect(state.version).toBe(4);
		expect(state.mode).toBe('manual');
		expect(state.crossBarSlide).toBe(true);
	});

	it('has generation settings matching the spec defaults', () => {
		const state = createDefaultAcidBassState(16, 4);
		expect(state.generation).toEqual(createDefaultGenerationSettings());
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

	it('setAcidStepProbability changes and clamps only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		expect(setAcidStepProbability(pattern, 3, 75)[3].probability).toBe(75);
		expect(setAcidStepProbability(pattern, 3, 150)[3].probability).toBe(100);
		expect(setAcidStepProbability(pattern, 3, -10)[3].probability).toBe(0);
	});

	it('setAcidStepRatchet changes only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		expect(setAcidStepRatchet(pattern, 3, 3)[3].ratchet).toBe(3);
	});

	it('setAcidStepGate changes and clamps only the targeted step', () => {
		const pattern = createDefaultAcidBassState(16, 4).patterns.A;
		expect(setAcidStepGate(pattern, 3, 50)[3].gate).toBe(50);
		expect(setAcidStepGate(pattern, 3, 5)[3].gate).toBe(10);
		expect(setAcidStepGate(pattern, 3, 500)[3].gate).toBe(100);
	});

	it('setAcidStepLock sets one target without disturbing others already locked', () => {
		let pattern = createDefaultAcidBassState(16, 4).patterns.A;
		pattern = setAcidStepLock(pattern, 3, 'cutoff', 80);
		pattern = setAcidStepLock(pattern, 3, 'drive', 40);
		expect(pattern[3].locks).toEqual({ cutoff: 80, drive: 40 });
	});

	it('setAcidStepLock clears a target and drops an empty locks object entirely', () => {
		let pattern = createDefaultAcidBassState(16, 4).patterns.A;
		pattern = setAcidStepLock(pattern, 3, 'cutoff', 80);
		pattern = setAcidStepLock(pattern, 3, 'cutoff', undefined);
		expect(pattern[3].locks).toBeUndefined();
	});

	it('clearAcidStepLocks removes every target from one step', () => {
		let pattern = createDefaultAcidBassState(16, 4).patterns.A;
		pattern = setAcidStepLock(pattern, 3, 'cutoff', 80);
		pattern = setAcidStepLock(pattern, 3, 'resonance', 60);
		pattern = clearAcidStepLocks(pattern, 3);
		expect(pattern[3].locks).toBeUndefined();
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
