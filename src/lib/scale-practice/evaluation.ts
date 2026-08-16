import type { DetectedNote } from '$lib/audio/types';
import type { FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';
import type { BeatResult } from './types';

export interface EvaluateBeatArgs {
	target: PitchClass;
	/** The target's own fret positions within the zone (`positionsForPitchClass(target, ...)`). */
	zonePositions: FretPosition[];
	/** The note attributed to this beat, or `null` if nothing was played before the next beat arrived. */
	played: DetectedNote | null;
	/** The beat's own scheduled wall-clock time (`Date.now()`-based, same basis as `DetectedNote.timestampMs`). */
	beatAtMs: number;
	/** "On-time" window half-width, in ms either side of `beatAtMs`. */
	toleranceMs: number;
}

/**
 * Pitch correctness is a plain equality against the beat's single target —
 * unlike `$lib/practice/evaluation.ts`, there's no harmonic strong/valid
 * alternative to rank here, every beat has exactly one right pitch class.
 * Timing is judged independently, so a wrong note still gets its own honest
 * on/off-time reading rather than being collapsed into one verdict.
 */
export function evaluateBeat(args: EvaluateBeatArgs): BeatResult {
	const { target, zonePositions, played, beatAtMs, toleranceMs } = args;

	if (played === null) {
		return { target, pitch: null, timing: 'missed', positions: zonePositions };
	}

	const pitch = played.pitchClass === target ? 'correct' : 'incorrect';
	const timing = Math.abs(played.timestampMs - beatAtMs) <= toleranceMs ? 'on-time' : 'off-time';
	return { target, pitch, timing, positions: zonePositions };
}
