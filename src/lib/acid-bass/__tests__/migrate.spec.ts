import { describe, expect, it } from 'vitest';

import { PATTERN_ROLES } from '$lib/groove/pattern-role';

import { coerceAcidBassState } from '../migrate';
import { createDefaultAcidBassState } from '../pattern';

const METER = { stepsPerBar: 16, stepsPerBeatGroup: 4 };

function v1State(overrides: Record<string, unknown> = {}) {
	return {
		enabled: true,
		patch: { wave: 'square', tone: 60, resonance: 40, motion: 55, decay: 30, drive: 20 },
		patterns: {
			A: [
				{ active: true, interval: '1', octave: 0, accent: true, slide: true },
				{ active: false, interval: '1', octave: 0, accent: false, slide: false }
			],
			B: [],
			F: [],
			T: []
		},
		...overrides
	};
}

describe('coerceAcidBassState: no acidBass at all (pre-Acid-Bass groove)', () => {
	it('returns a fresh, disabled, version-3 default state', () => {
		const state = coerceAcidBassState(undefined, METER);
		expect(state.version).toBe(3);
		expect(state.enabled).toBe(false);
		expect(state).toEqual(createDefaultAcidBassState(METER.stepsPerBar, METER.stepsPerBeatGroup));
	});

	it('also handles null and unrecognizable garbage the same way', () => {
		expect(coerceAcidBassState(null, METER).enabled).toBe(false);
		expect(coerceAcidBassState('not an object', METER).version).toBe(3);
		expect(coerceAcidBassState(42, METER).version).toBe(3);
	});
});

describe('coerceAcidBassState: V1 -> V3 migration', () => {
	it('preserves enabled, and forces crossBarSlide off (a migrated groove must not gain new articulation)', () => {
		const state = coerceAcidBassState(v1State({ enabled: true }), METER);
		expect(state.enabled).toBe(true);
		expect(state.crossBarSlide).toBe(false);
		expect(state.version).toBe(3);
	});

	it('maps every V1 patch macro onto its V2/V3 home, and defaults to the legacy filter (not acid24)', () => {
		const state = coerceAcidBassState(v1State(), METER);
		expect(state.patch.oscillator.mainWave).toBe('square');
		expect(state.patch.filter.model).toBe('legacy');
		expect(state.patch.filter.cutoff).toBe(60);
		expect(state.patch.filter.resonance).toBe(40);
		// V1 Motion was unipolar and always opened the filter -- maps directly
		// onto the positive half of the new bipolar range.
		expect(state.patch.filter.envAmount).toBe(55);
		expect(state.patch.envelope.decay).toBe(30);
		expect(state.patch.output.drive).toBe(20);
	});

	it("reproduces V1's fixed attack/release/slide/accent constants via the same value every time (deterministic, not approximated differently per call)", () => {
		const a = coerceAcidBassState(v1State(), METER);
		const b = coerceAcidBassState(v1State(), METER);
		expect(a.patch.envelope.attack).toBe(b.patch.envelope.attack);
		expect(a.patch.envelope.release).toBe(b.patch.envelope.release);
		expect(a.patch.glide.time).toBe(b.patch.glide.time);
		expect(a.patch.envelope.accentAmount).toBe(50);
		expect(a.patch.glide.curve).toBe('linear');
	});

	it('new sections added since V1 (sub oscillator, Osc 2, both LFOs) come back at safe, inert compatibility defaults', () => {
		const state = coerceAcidBassState(v1State(), METER);
		expect(state.patch.oscillator.subEnabled).toBe(false);
		expect(state.patch.oscillator.osc2Enabled).toBe(false);
		expect(state.patch.lfo1.enabled).toBe(false);
		expect(state.patch.lfo2.enabled).toBe(false);
		expect(state.patch.filter.keyTracking).toBe(0);
		expect(state.patch.filter.saturation).toBe(0);
	});

	it("preserves every migrated step's interval/octave/accent/slide unchanged, and adds the new sequencer fields at neutral defaults", () => {
		const state = coerceAcidBassState(v1State(), METER);
		const step0 = state.patterns.A[0];
		expect(step0.active).toBe(true);
		expect(step0.interval).toBe('1');
		expect(step0.accent).toBe(true);
		expect(step0.slide).toBe(true);
		expect(step0.probability).toBe(100);
		expect(step0.ratchet).toBe(1);
		expect(step0.gate).toBe(82);
		expect(step0.locks).toBeUndefined();
	});

	it('resizes every migrated pattern to the current meter', () => {
		const state = coerceAcidBassState(v1State(), { stepsPerBar: 12, stepsPerBeatGroup: 4 });
		for (const role of PATTERN_ROLES) {
			expect(state.patterns[role]).toHaveLength(12);
		}
	});

	it('is robust against a missing or malformed V1 patch/patterns rather than throwing', () => {
		const state = coerceAcidBassState(
			{ enabled: true, patch: null, patterns: 'not an object' },
			METER
		);
		expect(state.version).toBe(3);
		expect(state.patch.oscillator.mainWave).toBe('saw');
		for (const role of PATTERN_ROLES) {
			expect(state.patterns[role]).toHaveLength(16);
		}
	});
});

describe('coerceAcidBassState: V2 -> V3 migration', () => {
	function v2State(overrides: Record<string, unknown> = {}) {
		const base = createDefaultAcidBassState(16, 4);
		return {
			version: 2,
			enabled: base.enabled,
			patch: {
				oscillator: base.patch.oscillator,
				filter: base.patch.filter,
				envelope: base.patch.envelope,
				glide: base.patch.glide,
				// V2's own singular field -- deliberately not `lfo1`/`lfo2`.
				lfo: { ...base.patch.lfo1, enabled: true, destination: 'pitch', depth: 65 },
				output: base.patch.output
			},
			patterns: base.patterns,
			crossBarSlide: base.crossBarSlide,
			...overrides
		};
	}

	it('bumps to version 3, and preserves the old singular LFO settings on lfo1 unchanged', () => {
		const state = coerceAcidBassState(v2State(), METER);
		expect(state.version).toBe(3);
		expect(state.patch.lfo1.enabled).toBe(true);
		expect(state.patch.lfo1.destination).toBe('pitch');
		expect(state.patch.lfo1.depth).toBe(65);
	});

	it('defaults lfo2 and Osc 2 to neutral/off -- a migrated V2 groove must sound identical', () => {
		const state = coerceAcidBassState(v2State(), METER);
		expect(state.patch.lfo2.enabled).toBe(false);
		expect(state.patch.lfo2.depth).toBe(0);
		expect(state.patch.oscillator.osc2Enabled).toBe(false);
		expect(state.patch.oscillator.osc2Level).toBe(0);
	});

	it('preserves crossBarSlide as-is, unlike the forced-false V1->V3 path', () => {
		const state = coerceAcidBassState(v2State({ crossBarSlide: true }), METER);
		expect(state.crossBarSlide).toBe(true);
	});

	it('is robust against a missing or malformed V2 patch/lfo rather than throwing', () => {
		const state = coerceAcidBassState(
			{ version: 2, enabled: true, patch: { lfo: 'not-an-object' }, patterns: {} },
			METER
		);
		expect(state.version).toBe(3);
		expect(state.patch.lfo1.enabled).toBe(false);
		for (const role of PATTERN_ROLES) {
			expect(state.patterns[role]).toHaveLength(16);
		}
	});
});

describe('coerceAcidBassState: current V3 data (untrusted persisted state)', () => {
	it('passes through a well-formed V3 state unchanged', () => {
		const original = createDefaultAcidBassState(16, 4);
		const withContent = {
			...original,
			enabled: true,
			patch: { ...original.patch, filter: { ...original.patch.filter, cutoff: 77 } }
		};
		const state = coerceAcidBassState(withContent, METER);
		expect(state.enabled).toBe(true);
		expect(state.patch.filter.cutoff).toBe(77);
	});

	it('clamps out-of-range numeric fields instead of accepting them verbatim', () => {
		const original = createDefaultAcidBassState(16, 4);
		const state = coerceAcidBassState(
			{
				...original,
				patch: {
					...original.patch,
					filter: { ...original.patch.filter, cutoff: 9999, envAmount: -9999 },
					oscillator: { ...original.patch.oscillator, tune: 999 }
				}
			},
			METER
		);
		expect(state.patch.filter.cutoff).toBe(100);
		expect(state.patch.filter.envAmount).toBe(-100);
		expect(state.patch.oscillator.tune).toBe(12);
	});

	it('round-trips Osc 2 and both LFOs independently, clamping out-of-range values', () => {
		const original = createDefaultAcidBassState(16, 4);
		const state = coerceAcidBassState(
			{
				...original,
				patch: {
					...original.patch,
					oscillator: {
						...original.patch.oscillator,
						osc2Enabled: true,
						osc2Wave: 'pulse',
						osc2Tune: 999,
						osc2Level: 999
					},
					lfo1: { ...original.patch.lfo1, enabled: true, destination: 'osc2Level', depth: 40 },
					lfo2: { ...original.patch.lfo2, enabled: true, destination: 'pitch', depth: -30 }
				}
			},
			METER
		);
		expect(state.patch.oscillator.osc2Enabled).toBe(true);
		expect(state.patch.oscillator.osc2Wave).toBe('pulse');
		expect(state.patch.oscillator.osc2Tune).toBe(12);
		expect(state.patch.oscillator.osc2Level).toBe(100);
		expect(state.patch.lfo1.destination).toBe('osc2Level');
		expect(state.patch.lfo1.depth).toBe(40);
		expect(state.patch.lfo2.enabled).toBe(true);
		expect(state.patch.lfo2.destination).toBe('pitch');
		expect(state.patch.lfo2.depth).toBe(0);
	});

	it('falls back to a safe default for an invalid enum rather than accepting arbitrary strings', () => {
		const original = createDefaultAcidBassState(16, 4);
		const state = coerceAcidBassState(
			{
				...original,
				patch: {
					...original.patch,
					filter: { ...original.patch.filter, model: 'not-a-real-filter' }
				}
			},
			METER
		);
		expect(['legacy', 'svf12', 'acid24']).toContain(state.patch.filter.model);
	});

	it('fills in missing pattern roles rather than crashing on a partial patterns object', () => {
		const original = createDefaultAcidBassState(16, 4);
		const state = coerceAcidBassState({ ...original, patterns: { A: original.patterns.A } }, METER);
		for (const role of PATTERN_ROLES) {
			expect(state.patterns[role]).toHaveLength(16);
		}
	});

	it('resizes patterns whose length no longer matches the current meter', () => {
		const original = createDefaultAcidBassState(16, 4);
		const state = coerceAcidBassState(original, { stepsPerBar: 12, stepsPerBeatGroup: 4 });
		for (const role of PATTERN_ROLES) {
			expect(state.patterns[role]).toHaveLength(12);
		}
	});

	it('clamps and validates step-level fields (probability, ratchet, gate, locks)', () => {
		const original = createDefaultAcidBassState(16, 4);
		const badStep = {
			active: true,
			interval: 'not-an-interval',
			octave: 99,
			accent: 'yes',
			slide: false,
			probability: 500,
			ratchet: 7,
			gate: 1,
			locks: { cutoff: 9999, resonance: 'nope', notARealTarget: 5 }
		};
		const state = coerceAcidBassState(
			{
				...original,
				patterns: { ...original.patterns, A: [badStep, ...original.patterns.A.slice(1)] }
			},
			METER
		);
		const step0 = state.patterns.A[0];
		expect(step0.interval).toBe('1');
		expect(step0.octave).toBe(0);
		expect(step0.accent).toBe(false);
		expect(step0.probability).toBe(100);
		expect(step0.ratchet).toBe(1);
		expect(step0.gate).toBe(10);
		expect(step0.locks).toEqual({ cutoff: 100 });
	});
});
