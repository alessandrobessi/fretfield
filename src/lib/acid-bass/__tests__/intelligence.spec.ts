import { describe, expect, it } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';

import { resolveAcidIntelligence } from '../intelligence';
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

describe('resolveAcidIntelligence: M10 minimal neutral adapter', () => {
	it('passes accent and gate straight through unchanged', () => {
		const expression = resolveAcidIntelligence(noteStep({ accent: true, gate: 63 }));
		expect(expression.accent).toBe(true);
		expect(expression.gatePercent).toBe(63);

		const expression2 = resolveAcidIntelligence(noteStep({ accent: false, gate: 30 }));
		expect(expression2.accent).toBe(false);
		expect(expression2.gatePercent).toBe(30);
	});

	it('never produces extra locks (§22: intelligence = 0 returns no extra parameter locks)', () => {
		const expression = resolveAcidIntelligence(noteStep());
		expect(expression.locks).toBeUndefined();
	});

	it('random modulation value is always neutral (0) until modulation exists to consume it', () => {
		const expression = resolveAcidIntelligence(noteStep());
		expect(expression.randomModulationValue).toBe(0);
	});
});
