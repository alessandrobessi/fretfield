/**
 * Register and physical realization (Acid Bass Intelligence V4 §19) --
 * pipeline stage 5. Converts an already-selected pitch-class sequence
 * (post-chromaticism) into actual MIDI notes and fretboard positions, using
 * the existing `findFretPositionsForMidi()` rather than a new fretboard
 * mapping (§19's own explicit instruction).
 *
 * Never hardcodes standard tuning: the instrument's own playable MIDI range
 * is derived from whatever `AbsoluteTuning` + `fretCount` the caller
 * supplies (§19.1).
 */

import { type AbsoluteTuning, findFretPositionsForMidi } from '$lib/music/absolute-pitch';
import type { FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';

import type { BassRegisterMode } from './types';

export interface PlayabilityRequest {
	pitchClass: PitchClass;
}

export interface PlayabilityOptions {
	register: BassRegisterMode;
	zone: { minFret: number; maxFret: number };
	tuning: AbsoluteTuning;
	fretCount: number;
	/** 0-100, the user setting. */
	playability: number;
}

export interface PlayabilityRealization {
	midi: number;
	preferredPosition: FretPosition;
	/** Every other physical position that produces the exact same `midi` -- never claims `preferredPosition` is the only legal way to play the note (§19.4). */
	alternativePositions: FretPosition[];
	/** True only when `register === 'zone'` and no realization existed inside `zone` at all, so the nearest physically available realization was used instead (§19.2). */
	fallback: boolean;
}

// §19.1's recommended MIDI centers -- soft preferences, not hard limits.
const REGISTER_CENTER_MIDI: Record<'low' | 'mid' | 'high', number> = {
	low: 33, // ~A1, inside the "E1-B2" region
	mid: 43, // ~G2, inside the "A1-E3" region
	high: 50 // ~D3, inside the "D2-G3+" region
};

// §19.3's cost model constants -- centralized rather than inline, matching
// `candidates.ts`/`voice-leading.ts`'s own precedent.
const REGISTER_DISTANCE_WEIGHT = 1.2;
const OUT_OF_ZONE_PENALTY = 40;
const FRET_WEIGHT = 3;
const STRING_WEIGHT = 6;
const POSITION_SHIFT_THRESHOLD_FRETS = 4;
const POSITION_SHIFT_PENALTY = 20;

function instrumentMidiRange(tuning: AbsoluteTuning, fretCount: number): [number, number] {
	const openMidis = tuning.map((s) => s.midi);
	return [Math.min(...openMidis), Math.max(...openMidis) + fretCount];
}

interface PlayabilityCandidate {
	midi: number;
	position: FretPosition;
	registerPenalty: number;
	inZone: boolean;
}

/** Every "musically reasonable" (physically playable, per §19.1) MIDI instance of `pitchClass` within the instrument's own range, each paired with every physical position that produces it. */
function enumerateCandidates(
	pitchClass: PitchClass,
	tuning: AbsoluteTuning,
	fretCount: number
): { midi: number; position: FretPosition }[] {
	const [minMidi, maxMidi] = instrumentMidiRange(tuning, fretCount);
	const firstMidi = minMidi + ((((pitchClass - minMidi) % 12) + 12) % 12);
	const candidates: { midi: number; position: FretPosition }[] = [];
	for (let midi = firstMidi; midi <= maxMidi; midi += 12) {
		for (const position of findFretPositionsForMidi(tuning, fretCount, midi)) {
			candidates.push({ midi, position });
		}
	}
	return candidates;
}

function scoreRegister(
	candidate: { midi: number; position: FretPosition },
	options: PlayabilityOptions
): { penalty: number; inZone: boolean } {
	if (options.register === 'zone') {
		const inZone =
			candidate.position.fret >= options.zone.minFret &&
			candidate.position.fret <= options.zone.maxFret;
		return { penalty: inZone ? 0 : OUT_OF_ZONE_PENALTY, inZone };
	}
	const center = REGISTER_CENTER_MIDI[options.register];
	return { penalty: Math.abs(candidate.midi - center) * REGISTER_DISTANCE_WEIGHT, inZone: true };
}

/** §19.3's transition cost, before playability scaling -- undefined for the sequence's first note (no previous position to move from). */
function transitionCost(previous: FretPosition, position: FretPosition): number {
	const fretDistance = Math.abs(position.fret - previous.fret);
	const stringDistance = Math.abs(position.stringIndex - previous.stringIndex);
	const shiftPenalty = fretDistance > POSITION_SHIFT_THRESHOLD_FRETS ? POSITION_SHIFT_PENALTY : 0;
	return fretDistance * FRET_WEIGHT + stringDistance * STRING_WEIGHT + shiftPenalty;
}

/**
 * Realizes a whole pitch-class sequence via dynamic programming (§19.3: "use
 * DP across the chosen pitch-class sequence so physical realization is
 * globally coherent, not greedily chosen one note at a time"). Every
 * physical/register penalty is scaled by `playability / 100` -- at
 * `playability = 0` every candidate's scaled penalty is 0, so the DP has no
 * physical preference left and deterministically keeps the first-enumerated
 * (still 100% legal) realization; at `playability = 100` the full cost model
 * applies.
 */
export function realizeSequence(
	requests: readonly PlayabilityRequest[],
	options: PlayabilityOptions
): PlayabilityRealization[] {
	if (requests.length === 0) return [];

	const scale = Math.max(0, Math.min(100, options.playability)) / 100;

	const perSlotCandidates: PlayabilityCandidate[][] = requests.map((request) => {
		const raw = enumerateCandidates(request.pitchClass, options.tuning, options.fretCount);
		if (raw.length === 0) {
			throw new Error(
				`No physically playable realization exists for pitch class ${request.pitchClass} on this tuning/fretCount.`
			);
		}
		const scored = raw.map((candidate) => {
			const { penalty, inZone } = scoreRegister(candidate, options);
			return { ...candidate, registerPenalty: penalty, inZone };
		});
		if (options.register === 'zone') {
			const inZoneOnly = scored.filter((c) => c.inZone);
			return inZoneOnly.length > 0 ? inZoneOnly : scored;
		}
		return scored;
	});

	interface DPCell {
		totalCost: number;
		previousCandidateIndex: number | null;
	}

	const dp: DPCell[][] = [];
	for (let slotIndex = 0; slotIndex < perSlotCandidates.length; slotIndex++) {
		const candidates = perSlotCandidates[slotIndex];
		if (slotIndex === 0) {
			dp.push(
				candidates.map((candidate) => ({
					totalCost: candidate.registerPenalty * scale,
					previousCandidateIndex: null
				}))
			);
			continue;
		}
		const previousCandidates = perSlotCandidates[slotIndex - 1];
		const previousRow = dp[slotIndex - 1];
		dp.push(
			candidates.map((candidate) => {
				let best: DPCell | null = null;
				for (let previousIndex = 0; previousIndex < previousCandidates.length; previousIndex++) {
					const stepCost =
						(transitionCost(previousCandidates[previousIndex].position, candidate.position) +
							candidate.registerPenalty) *
						scale;
					const totalCost = previousRow[previousIndex].totalCost + stepCost;
					if (best === null || totalCost < best.totalCost) {
						best = { totalCost, previousCandidateIndex: previousIndex };
					}
				}
				return best as DPCell;
			})
		);
	}

	// Backtrack from the cheapest cell in the final row.
	const lastRow = dp[dp.length - 1];
	let chosenIndex = 0;
	for (let i = 1; i < lastRow.length; i++) {
		if (lastRow[i].totalCost < lastRow[chosenIndex].totalCost) chosenIndex = i;
	}
	const chosenIndices: number[] = new Array(perSlotCandidates.length);
	for (let slotIndex = perSlotCandidates.length - 1; slotIndex >= 0; slotIndex--) {
		chosenIndices[slotIndex] = chosenIndex;
		const previous = dp[slotIndex][chosenIndex].previousCandidateIndex;
		if (previous !== null) chosenIndex = previous;
	}

	return chosenIndices.map((candidateIndex, slotIndex) => {
		const chosen = perSlotCandidates[slotIndex][candidateIndex];
		const alternativePositions = findFretPositionsForMidi(
			options.tuning,
			options.fretCount,
			chosen.midi
		).filter(
			(position) =>
				position.stringIndex !== chosen.position.stringIndex ||
				position.fret !== chosen.position.fret
		);
		return {
			midi: chosen.midi,
			preferredPosition: chosen.position,
			alternativePositions,
			fallback: options.register === 'zone' && !chosen.inZone
		};
	});
}
