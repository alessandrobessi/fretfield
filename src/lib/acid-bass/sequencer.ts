/**
 * Sequencer powers (~/Downloads/ACID-BASS-ENGINE-V2.md M5): the pure,
 * store-independent logic behind per-step probability, ratchet, and
 * parameter locks. `scale-practice.svelte.ts`'s `scheduleAcidBassStep`
 * consumes these directly; `acid-bass-voice.ts` stays unaware of any of it
 * (probability/ratchet are sequencing concerns, resolved before the voice
 * ever sees a trigger -- see that file's own "must not know about
 * `PatternRole` semantics" doctrine).
 */

import type { PatternRole } from '$lib/groove/pattern-role';

import type { AcidBassStep, AcidStepLocks } from './types';

const ROLE_SEED: Record<PatternRole, number> = { A: 1, B: 2, F: 3, T: 4 };

/**
 * A deterministic (never `Math.random`) 0-99 roll seeded off the absolute
 * bar count, step index, and pattern role -- the same position replays
 * identically for automated tests, yet still varies across repeats of the
 * arrangement, since the transport's own bar counter never resets to 0
 * (spec §40's "seeded off loop/bar/step/pattern-role", without needing a
 * separate loop-count field: the ever-increasing absolute bar already
 * serves that role). A standard integer bit-mixing hash (murmur3-style
 * finalizer) -- fast, dependency-free, and passes a basic distribution
 * sanity check across a wide sweep of inputs.
 */
function seededRoll(bar: number, stepIndex: number, role: PatternRole): number {
	let h = (bar * 73856093) ^ (stepIndex * 19349663) ^ (ROLE_SEED[role] * 83492791);
	h = Math.imul(h ^ (h >>> 16), 2246822519);
	h = Math.imul(h ^ (h >>> 13), 3266489917);
	h ^= h >>> 16;
	return (h >>> 0) % 100;
}

/**
 * Whether a step's own probability roll succeeds this time through. 100
 * always triggers, 0 never does (both skip the hash entirely -- exact, not
 * approximate, at the boundaries). Evaluated once per *source* step: a
 * ratcheted step's whole group of hits shares this one roll, never one roll
 * per hit (spec: "probability evaluated once per source step").
 */
export function stepShouldTrigger(
	step: Pick<AcidBassStep, 'probability'>,
	bar: number,
	stepIndex: number,
	role: PatternRole
): boolean {
	if (step.probability >= 100) return true;
	if (step.probability <= 0) return false;
	return seededRoll(bar, stepIndex, role) < step.probability;
}

/**
 * Splits a step's own duration into `ratchet` equal-length hits, returning
 * each hit's start offset from the step's own start time (the first is
 * always 0). Ratchet 1 -- the common case -- is just `[0]`, a single
 * un-subdivided hit, so callers can loop over this unconditionally rather
 * than special-casing "no ratchet".
 */
export function ratchetOffsetsSeconds(
	ratchet: AcidBassStep['ratchet'],
	stepDurationSeconds: number
): number[] {
	const sliceSeconds = stepDurationSeconds / ratchet;
	return Array.from({ length: ratchet }, (_, i) => i * sliceSeconds);
}

export interface ResolvedStepLocks {
	cutoff: number;
	resonance: number;
	envAmount: number;
	drive: number;
	lfoDepth: number;
}

/**
 * Applies a step's parameter locks over a patch's own base values for the
 * five lockable targets -- a target with no lock simply passes its base
 * value through unchanged, so an unlocked step (the common case) still
 * sounds exactly like the patch. `lfoDepth` resolves correctly here even
 * though nothing yet reads it (the LFO itself lands in a later milestone).
 */
export function resolveStepLocks(
	locks: AcidStepLocks | undefined,
	base: ResolvedStepLocks
): ResolvedStepLocks {
	return {
		cutoff: locks?.cutoff ?? base.cutoff,
		resonance: locks?.resonance ?? base.resonance,
		envAmount: locks?.envAmount ?? base.envAmount,
		drive: locks?.drive ?? base.drive,
		lfoDepth: locks?.lfoDepth ?? base.lfoDepth
	};
}
