/**
 * The common audio-ready scheduling shape both Acid Bass playback paths
 * resolve to (Acid Bass Intelligence V4 §25.3) -- manual's persisted
 * `AcidBassStep` and generated's pure `GeneratedBassStep` are never forced
 * into one shared *data* type (they mean different things: one is
 * user-authored and interval-relative, the other is generator output and
 * already absolute); instead both convert into this one small, theory-free
 * `AcidPlaybackStep`, so the store's scheduling code can share logic across
 * both modes without either mode leaking into the other's shape.
 */

import { resolveAcidStepMidi } from './resolve';
import type { AcidBassPatch, AcidBassStep, AcidStepLocks } from './types';
import { resolveAcidIntelligence } from './intelligence';

import type { BasslineStyleId, GeneratedBassStep } from '$lib/music/bassline/types';
import { midiToFrequency } from '$lib/audio/note-mapping';
import type { PitchClass } from '$lib/music/pitch';

export interface AcidPlaybackStep {
	active: boolean;
	frequencyHz: number;
	accent: boolean;
	slide: boolean;
	gatePercent: number;
	probability: number;
	ratchet: 1 | 2 | 3 | 4;
	locks?: AcidStepLocks;
	randomModulationValue: number;
}

const INACTIVE_PLAYBACK_STEP: AcidPlaybackStep = {
	active: false,
	frequencyHz: 0,
	accent: false,
	slide: false,
	gatePercent: 0,
	probability: 0,
	ratchet: 1,
	randomModulationValue: 0
};

/** Manual conversion (§25.3): `AcidBassStep` + the current bar's chord root -> `AcidPlaybackStep`. Exactly the same MIDI resolution `scheduleAcidBassStep` already used before this adapter existed (`resolveAcidStepMidi`), just wrapped in the shared shape. */
export function manualStepToPlaybackStep(
	step: AcidBassStep,
	chordRoot: PitchClass
): AcidPlaybackStep {
	if (!step.active) return INACTIVE_PLAYBACK_STEP;
	return {
		active: true,
		frequencyHz: midiToFrequency(resolveAcidStepMidi(chordRoot, step)),
		accent: step.accent,
		slide: step.slide,
		gatePercent: step.gate,
		probability: step.probability,
		ratchet: step.ratchet,
		locks: step.locks,
		randomModulationValue: 0
	};
}

/** Generated conversion (§25.3): `GeneratedBassStep.midi` + the Acid Intelligence bridge -> `AcidPlaybackStep`. §25.4: generated steps are always `probability: 100, ratchet: 1`, already guaranteed by `GeneratedBassNoteStep`'s own type. `patch`/`intelligence`/`style` are §22's own bridge inputs -- the current patch (for locks to lift relative to, e.g. `envAmount`), the user's Intelligence knob, and the active generation style (accent-emphasis scales by the style's own `accentDensity`). */
export function generatedStepToPlaybackStep(
	step: GeneratedBassStep,
	patch: AcidBassPatch,
	intelligence: number,
	style: BasslineStyleId
): AcidPlaybackStep {
	if (!step.active) return INACTIVE_PLAYBACK_STEP;
	const expression = resolveAcidIntelligence(step, patch, intelligence, style);
	return {
		active: true,
		frequencyHz: midiToFrequency(step.midi),
		accent: expression.accent,
		slide: step.slide,
		gatePercent: expression.gatePercent,
		probability: step.probability,
		ratchet: step.ratchet,
		locks: expression.locks,
		randomModulationValue: expression.randomModulationValue
	};
}
