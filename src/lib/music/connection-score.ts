import { getChordDefinition } from './chords';
import { type HarmonicRole, analyzeInterval, isChordTone } from './harmony';
import { ALL_INTERVALS, type IntervalId, intervalFromRoot, transposeByInterval } from './intervals';
import type { PitchClass } from './pitch';
import type { ResolvedChord } from './progressions';

export interface ResolutionTarget {
	targetPitchClass: PitchClass;
	targetInterval: IntervalId;
	/** Shortest signed semitone distance from the current note to this target (negative = down). */
	semitoneMovement: number;
	harmonicStrength: number;
}

export interface NoteConnection {
	currentInterval: IntervalId;
	currentRole: HarmonicRole;
	commonTone: boolean;
	targets: ResolutionTarget[];
	connectionStrength: number;
}

/**
 * Centralized, named weights (BLUEPRINT's "Weight components" guidance) —
 * never inline magic numbers. Chromatic movement is not penalized by
 * default: a chromatic approach with a convincing target can outscore a
 * passive common tone.
 */
export interface ConnectionWeights {
	commonTone: number;
	guideTone: number;
	halfStepResolution: number;
	wholeStepResolution: number;
	functionalResolution: number;
	chordToneTarget: number;
	structuralTarget: number;
	chromaticApproach: number;
}

export const DEFAULT_CONNECTION_WEIGHTS: ConnectionWeights = {
	commonTone: 0.3,
	guideTone: 0.25,
	halfStepResolution: 0.3,
	wholeStepResolution: 0.15,
	functionalResolution: 0.3,
	chordToneTarget: 0.2,
	structuralTarget: 0.35,
	chromaticApproach: 0.2
};

function shortestSignedMovement(from: PitchClass, to: PitchClass): number {
	const upward = (((to - from) % 12) + 12) % 12; // 0..11 semitones moving up
	return upward > 6 ? upward - 12 : upward;
}

/**
 * Scores every chord tone of `nextChord` as a resolution target for
 * `currentPitchClass` (a note over `currentChord`). Derives strength from
 * interval relationships — never a hardcoded pitch-to-pitch table — so
 * e.g. G7→Cmaj7's F→E and B→C emerge from "half-step into a structural or
 * root tone", not from special-casing those specific pitches.
 */
export function analyzeConnection(
	currentPitchClass: PitchClass,
	currentChord: ResolvedChord,
	nextChord: ResolvedChord,
	weights: ConnectionWeights = DEFAULT_CONNECTION_WEIGHTS
): NoteConnection {
	const currentChordDef = getChordDefinition(currentChord.chordId);
	const nextChordDef = getChordDefinition(nextChord.chordId);

	const currentInterval = intervalFromRoot(currentChord.root, currentPitchClass);
	const currentRole = analyzeInterval(currentChordDef, currentInterval);
	const currentIsChordTone = isChordTone(currentChordDef, currentInterval);

	const nextPitchClassInterval = intervalFromRoot(nextChord.root, currentPitchClass);
	const commonTone = isChordTone(nextChordDef, nextPitchClassInterval);

	const targets: ResolutionTarget[] = nextChordDef.required.map((targetInterval) => {
		const targetPitchClass = transposeByInterval(nextChord.root, targetInterval);
		const semitoneMovement = shortestSignedMovement(currentPitchClass, targetPitchClass);
		const magnitude = Math.abs(semitoneMovement);

		const isRootTarget = targetInterval === '1';
		const isStructuralTarget = nextChordDef.structuralIntervals.includes(targetInterval);
		const isFunctionalResolution = (isRootTarget || isStructuralTarget) && magnitude === 1;

		let harmonicStrength = 0;
		harmonicStrength += isStructuralTarget ? weights.structuralTarget : weights.chordToneTarget;
		if (magnitude === 0) harmonicStrength += weights.commonTone;
		if (magnitude === 1) harmonicStrength += weights.halfStepResolution;
		if (magnitude === 2) harmonicStrength += weights.wholeStepResolution;
		// Guide-tone *motion* — landing on a guide tone via movement, not merely holding one in
		// place (which is already fully credited by commonTone above).
		if (isStructuralTarget && magnitude > 0) harmonicStrength += weights.guideTone;
		if (isFunctionalResolution) harmonicStrength += weights.functionalResolution;
		if (!currentIsChordTone && magnitude === 1) harmonicStrength += weights.chromaticApproach;

		return { targetPitchClass, targetInterval, semitoneMovement, harmonicStrength };
	});

	targets.sort((a, b) => b.harmonicStrength - a.harmonicStrength);
	const connectionStrength = targets.length > 0 ? targets[0].harmonicStrength : 0;

	return { currentInterval, currentRole, commonTone, targets, connectionStrength };
}

/** Every one of the 12 canonical intervals — used by voice-leading.ts to cover the full field, not just chord tones. */
export const ALL_CONNECTION_INTERVALS: readonly IntervalId[] = ALL_INTERVALS;
