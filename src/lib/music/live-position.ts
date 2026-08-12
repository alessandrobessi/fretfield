import type { FretPosition } from './fretboard';
import type { FretboardRegion } from './local-fields';

/**
 * Context this module needs to sharpen an ambiguous set of candidates — pure
 * fretboard/harmony concepts only. Nothing here (or in this file) knows about
 * audio, MIDI, or Web Audio; it just ranks positions it's handed.
 */
export interface LivePositionContext {
	voiceLeadingPathPosition?: FretPosition | null;
	localFieldRegion?: FretboardRegion | null;
	previousLikelyPosition?: FretPosition | null;
}

export interface LivePositionInference {
	candidates: FretPosition[];
	likelyPosition: FretPosition | null;
	confidence: number | null;
	reason: 'unique' | 'local-field' | 'voice-leading-path' | 'movement-continuity' | 'ambiguous';
}

function samePosition(a: FretPosition, b: FretPosition): boolean {
	return a.stringIndex === b.stringIndex && a.fret === b.fret;
}

function withinRegion(position: FretPosition, region: FretboardRegion): boolean {
	return position.fret >= region.minFret && position.fret <= region.maxFret;
}

/** Cheap "how far is this candidate from where the player was last" heuristic — a string change counts for more than a couple of frets, since it's a bigger physical jump than sliding. */
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
 * Priority: (1) a unique candidate is certain; (2) the position implied by a
 * currently selected Voice-Leading Path; (3) the one candidate that falls
 * inside the active Local Field, if exactly one does; (4) proximity to where
 * the player was last, if there's a single clearly-closest candidate;
 * (5) otherwise ambiguous.
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

	const pathPosition = context.voiceLeadingPathPosition;
	if (pathPosition) {
		const match = candidates.find((candidate) => samePosition(candidate, pathPosition));
		if (match) {
			return { candidates, likelyPosition: match, confidence: 0.9, reason: 'voice-leading-path' };
		}
	}

	const region = context.localFieldRegion;
	if (region) {
		const inRegion = candidates.filter((candidate) => withinRegion(candidate, region));
		if (inRegion.length === 1) {
			return { candidates, likelyPosition: inRegion[0], confidence: 0.75, reason: 'local-field' };
		}
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
