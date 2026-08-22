import { describe, expect, it } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';

import { resolveAcidIntelligence } from '../intelligence';
import { createDefaultAcidPatch } from '../pattern';
import type { AcidBassPatch } from '../types';
import type { GeneratedBassNoteStep } from '$lib/music/bassline/types';

function noteStep(overrides: Partial<GeneratedBassNoteStep> = {}): GeneratedBassNoteStep {
	return {
		stepIndex: 0,
		active: true,
		midi: 40,
		pitchClass: noteNameToPitchClass('C'),
		intervalFromChord: '1',
		intervalFromKey: '1',
		function: 'root',
		harmonicRole: 'root',
		accent: true,
		slide: false,
		gate: 78,
		probability: 100,
		ratchet: 1,
		preferredPosition: null,
		alternativePositions: [],
		explanation: {
			headline: 'Root of C',
			detail: 'Strong tonal anchor.',
			role: 'root',
			function: 'root',
			intervalFromChord: '1',
			intervalFromKey: '1'
		},
		...overrides
	};
}

const patch: AcidBassPatch = createDefaultAcidPatch();

describe('resolveAcidIntelligence: intelligence <= 0 stays neutral', () => {
	it('passes accent and gate straight through unchanged, with no locks and no random modulation', () => {
		const step = noteStep({ accent: true, gate: 63 });
		const expression = resolveAcidIntelligence(step, patch, 0, 'acid');
		expect(expression.accent).toBe(true);
		expect(expression.gatePercent).toBe(63);
		expect(expression.locks).toBeUndefined();
		expect(expression.randomModulationValue).toBe(0);
	});

	it('is unaffected even for a step that would otherwise trigger every mapping', () => {
		const step = noteStep({
			accent: false,
			gate: 78,
			function: 'chromatic-approach',
			harmonicRole: 'tension'
		});
		const expression = resolveAcidIntelligence(step, patch, 0, 'acid');
		expect(expression.gatePercent).toBe(78);
		expect(expression.accent).toBe(false);
		expect(expression.locks).toBeUndefined();
		expect(expression.randomModulationValue).toBe(0);
	});
});

describe('resolveAcidIntelligence: chromatic-approach shorter-gate rule', () => {
	it('shortens the gate for a chromatic-approach note, scaled by intelligence', () => {
		const step = noteStep({ function: 'chromatic-approach', gate: 78, harmonicRole: 'color' });
		const full = resolveAcidIntelligence(step, patch, 100, 'acid');
		const half = resolveAcidIntelligence(step, patch, 50, 'acid');
		expect(full.gatePercent).toBeLessThan(78);
		expect(half.gatePercent).toBeLessThan(78);
		expect(half.gatePercent).toBeGreaterThan(full.gatePercent);
	});

	it('never shortens the gate below the legal minimum (10)', () => {
		const step = noteStep({ function: 'chromatic-approach', gate: 12, harmonicRole: 'color' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'acid');
		expect(expression.gatePercent).toBeGreaterThanOrEqual(10);
	});

	it('leaves the gate untouched for a non-chromatic-approach function', () => {
		const step = noteStep({ function: 'chord-tone', gate: 78, harmonicRole: 'stable' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'acid');
		expect(expression.gatePercent).toBe(78);
	});
});

describe('resolveAcidIntelligence: strong-destination accent rule', () => {
	it('can add accent to an unaccented root/structural/stable note at full intelligence and the highest-accentDensity style', () => {
		// The deterministic hash depends on stepIndex/midi, so no single fixed
		// step is guaranteed to cross the threshold -- sweep a range of step
		// identities and assert the rule fires for at least one of them,
		// proving the mechanism actually works without depending on (or
		// hardcoding) the hash's exact output.
		const firedAtLeastOnce = Array.from({ length: 50 }, (_, stepIndex) =>
			resolveAcidIntelligence(
				noteStep({ accent: false, harmonicRole: 'root', stepIndex, midi: 40 + stepIndex }),
				patch,
				100,
				'funk' // accentDensity: 72, the highest among the six styles
			)
		).some((expression) => expression.accent);
		expect(firedAtLeastOnce).toBe(true);
	});

	it('never fires at intelligence 100 with the lowest-accentDensity style and the fixture used elsewhere in this file', () => {
		// 'walking' has accentDensity: 20, giving a 20% threshold at full
		// intelligence -- assert the specific fixture used throughout this file
		// (stepIndex 0, midi 40) lands outside that threshold, pinning down the
		// hash's behavior for this one well-known input as a regression guard.
		const step = noteStep({ accent: false, harmonicRole: 'root' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'walking');
		expect(expression.accent).toBe(false);
	});

	it('never adds accent when the harmonic role is not a strong destination', () => {
		const step = noteStep({ accent: false, harmonicRole: 'color' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'chromatic');
		expect(expression.accent).toBe(false);
	});

	it('never removes an accent the generator already decided', () => {
		const step = noteStep({ accent: true, harmonicRole: 'color' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'chromatic');
		expect(expression.accent).toBe(true);
	});
});

describe('resolveAcidIntelligence: high-tension filter/env lock, clamped', () => {
	it('lifts envAmount over the patch base value for a tension/alteration role', () => {
		const step = noteStep({ harmonicRole: 'tension' });
		const neutralPatch: AcidBassPatch = {
			...patch,
			filter: { ...patch.filter, envAmount: 0 }
		};
		const expression = resolveAcidIntelligence(step, neutralPatch, 100, 'acid');
		expect(expression.locks?.envAmount).toBeGreaterThan(0);
	});

	it('clamps the envAmount lock to the legal -100..100 range even when the patch is already at the ceiling', () => {
		const step = noteStep({ harmonicRole: 'alteration' });
		const hotPatch: AcidBassPatch = { ...patch, filter: { ...patch.filter, envAmount: 100 } };
		const expression = resolveAcidIntelligence(step, hotPatch, 100, 'acid');
		expect(expression.locks?.envAmount).toBeLessThanOrEqual(100);
		expect(expression.locks?.envAmount).toBeGreaterThanOrEqual(-100);
	});

	it('adds no lock for a non-tension role', () => {
		const step = noteStep({ harmonicRole: 'root' });
		const expression = resolveAcidIntelligence(step, patch, 100, 'acid');
		expect(expression.locks).toBeUndefined();
	});
});

describe('resolveAcidIntelligence: deterministic expression', () => {
	it('the same step/patch/intelligence/style always produces the exact same expression', () => {
		const step = noteStep({ harmonicRole: 'tension', function: 'chromatic-approach', accent: false });
		const a = resolveAcidIntelligence(step, patch, 65, 'melodic');
		const b = resolveAcidIntelligence(step, patch, 65, 'melodic');
		expect(a).toEqual(b);
	});

	it('random modulation value stays within -1..1 and is neutral only when intelligence is 0', () => {
		const step = noteStep();
		const zero = resolveAcidIntelligence(step, patch, 0, 'acid');
		expect(zero.randomModulationValue).toBe(0);

		const nonzero = resolveAcidIntelligence(step, patch, 80, 'acid');
		expect(nonzero.randomModulationValue).toBeGreaterThanOrEqual(-1);
		expect(nonzero.randomModulationValue).toBeLessThanOrEqual(1);
	});
});
