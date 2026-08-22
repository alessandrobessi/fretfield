import { describe, expect, it } from 'vitest';

import { midiToFrequency } from '$lib/audio/note-mapping';
import type { GeneratedBassNoteStep, GeneratedBassRestStep } from '$lib/music/bassline/types';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { generatedStepToPlaybackStep, manualStepToPlaybackStep } from '../generated-playback';
import { resolveAcidStepMidi } from '../resolve';
import type { AcidBassStep } from '../types';

const C = noteNameToPitchClass('C');

function manualStep(overrides: Partial<AcidBassStep> = {}): AcidBassStep {
	return {
		active: true,
		interval: '1',
		octave: 0,
		accent: false,
		slide: false,
		probability: 100,
		ratchet: 1,
		gate: 82,
		...overrides
	};
}

function generatedNoteStep(overrides: Partial<GeneratedBassNoteStep> = {}): GeneratedBassNoteStep {
	return {
		stepIndex: 0,
		active: true,
		midi: 45,
		pitchClass: noteNameToPitchClass('A'),
		intervalFromChord: '5',
		intervalFromKey: '5',
		function: 'chord-tone',
		harmonicRole: 'stable',
		accent: true,
		slide: true,
		gate: 58,
		probability: 100,
		ratchet: 1,
		preferredPosition: null,
		alternativePositions: [],
		explanation: {
			headline: '5 of Dm7',
			detail: 'Stable chord tone.',
			role: 'stable',
			function: 'chord-tone',
			intervalFromChord: '5',
			intervalFromKey: '5'
		},
		...overrides
	};
}

const restStep: GeneratedBassRestStep = { stepIndex: 3, active: false };

describe('manualStepToPlaybackStep', () => {
	it('resolves the exact same frequency scheduleAcidBassStep always used (resolveAcidStepMidi + midiToFrequency)', () => {
		const step = manualStep({ interval: '5', octave: 1, accent: true, gate: 70 });
		const result = manualStepToPlaybackStep(step, C);
		expect(result.active).toBe(true);
		expect(result.frequencyHz).toBe(midiToFrequency(resolveAcidStepMidi(C, step)));
		expect(result.accent).toBe(true);
		expect(result.gatePercent).toBe(70);
		expect(result.probability).toBe(100);
		expect(result.ratchet).toBe(1);
	});

	it('an inactive step converts to the shared inactive shape', () => {
		const result = manualStepToPlaybackStep(manualStep({ active: false }), C);
		expect(result.active).toBe(false);
	});

	it('carries locks through unchanged', () => {
		const locks = { cutoff: 40 };
		const result = manualStepToPlaybackStep(manualStep({ locks }), C);
		expect(result.locks).toEqual(locks);
	});
});

describe('generatedStepToPlaybackStep', () => {
	it("resolves frequency directly from the generated step's absolute midi", () => {
		const step = generatedNoteStep({ midi: 50 });
		const result = generatedStepToPlaybackStep(step);
		expect(result.active).toBe(true);
		expect(result.frequencyHz).toBe(midiToFrequency(50));
	});

	it('a rest step converts to the shared inactive shape', () => {
		const result = generatedStepToPlaybackStep(restStep);
		expect(result.active).toBe(false);
	});

	it('is always probability 100 and ratchet 1 (§25.4)', () => {
		const result = generatedStepToPlaybackStep(generatedNoteStep());
		expect(result.probability).toBe(100);
		expect(result.ratchet).toBe(1);
	});

	it('slide comes from the generated step itself, accent/gate come through the Acid Intelligence bridge', () => {
		const step = generatedNoteStep({ slide: true, accent: true, gate: 45 });
		const result = generatedStepToPlaybackStep(step);
		expect(result.slide).toBe(true);
		expect(result.accent).toBe(true);
		expect(result.gatePercent).toBe(45);
	});
});
