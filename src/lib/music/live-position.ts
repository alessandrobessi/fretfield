import type { FretPosition } from './fretboard';

/**
 * Context this module needs to sharpen an ambiguous set of candidates — pure
 * fretboard/harmony concepts only. Nothing here (or in this file) knows about
 * audio, MIDI, or Web Audio; it just ranks positions it's handed.
 */
export interface LivePositionContext {
	previousLikelyPosition?: FretPosition | null;
}

export interface LivePositionInference {
	candidates: FretPosition[];
	likelyPosition: FretPosition | null;
	confidence: number | null;
	reason: 'unique' | 'movement-continuity' | 'ambiguous';
}

function movementDistance(candidate: FretPosition, from: FretPosition): number {
	const stringPenalty = candidate.stringIndex === from.stringIndex ? 0 : 2;
	return Math.abs(candidate.fret - from.fret) + stringPenalty;
}

/**
 * Picks the single most plausible physical position for a detected pitch out
 * of several equally-valid candidates, per the priority order below. Never
 * fakes precision: anything not resolved by one of these rules stays
 * `'ambiguous'` with `likelyPosition: null` rather than guessing a string.
 *
 * Priority: (1) a unique candidate is certain; (2) proximity to where the
 * player was last, if there's a single clearly-closest candidate;
 * (3) otherwise ambiguous.
 */
export function inferLivePosition(
	candidates: FretPosition[],
	context: LivePositionContext = {}
): LivePositionInference {
	if (candidates.length === 0) {
		return { candidates, likelyPosition: null, confidence: null, reason: 'ambiguous' };
	}

	if (candidates.length === 1) {
		return { candidates, likelyPosition: candidates[0], confidence: 1, reason: 'unique' };
	}

	const previous = context.previousLikelyPosition;
	if (previous) {
		const distances = candidates.map((candidate) => movementDistance(candidate, previous));
		const minDistance = Math.min(...distances);
		const closest = candidates.filter((_, i) => distances[i] === minDistance);
		if (closest.length === 1) {
			return {
				candidates,
				likelyPosition: closest[0],
				confidence: 0.6,
				reason: 'movement-continuity'
			};
		}
	}

	return { candidates, likelyPosition: null, confidence: null, reason: 'ambiguous' };
}
