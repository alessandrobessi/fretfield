/**
 * The Acid Intelligence bridge (Acid Bass Intelligence V4 §22) -- not
 * another generator. It converts a `GeneratedBassStep`'s already-decided
 * musical function into a theory-free performance instruction the scheduler/
 * audio voice can consume, the same way `resolveAcidStepMidi()` already
 * bridges a manual step's theory-aware `interval` into a plain MIDI number.
 * `acid-bass-voice.ts` never learns about chord/scale/HarmonicRole/
 * BassNoteFunction -- this is the one place that boundary gets crossed.
 *
 * M10 ships the minimal neutral adapter only ("Input: GeneratedBassStep,
 * AcidBassPatch, intelligence amount, style" is §22's eventual full
 * contract): it passes the generator's own accent/gate straight through with
 * no extra parameter locks and no random-modulation contribution, so
 * generated lines are audible with zero risk of the intelligence layer
 * distorting the composer's own decisions. §22's musical mapping table
 * (chromatic approach -> shorter gate, strong destination -> more accent,
 * high-tension -> cutoff/envAmount lift, turnaround -> filter motion,
 * important arrival -> drive lift) is deliberately deferred to a later
 * milestone, once modulation (M15) and distortion (M16) actually exist to
 * receive those offsets.
 */

import type { GeneratedBassNoteStep } from '$lib/music/bassline/types';

import type { AcidStepLocks } from './types';

export interface AcidGeneratedExpression {
	accent: boolean;
	gatePercent: number;
	/** Temporary step-local performance offsets, reusing the existing parameter-lock idea where appropriate. Always `undefined` until a later milestone's mapping table exists to populate it (§22's own "intelligence = 0 returns the generated articulation with no extra parameter locks"). */
	locks?: AcidStepLocks;
	/** Deterministic -1..1 value supplied to Random modulation. Neutral (0) until modulation (M15) exists to consume it. */
	randomModulationValue: number;
}

/** M10's minimal neutral adapter -- see this module's own doc comment. */
export function resolveAcidIntelligence(step: GeneratedBassNoteStep): AcidGeneratedExpression {
	return {
		accent: step.accent,
		gatePercent: step.gate,
		randomModulationValue: 0
	};
}
