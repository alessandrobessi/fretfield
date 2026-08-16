import type { FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';

/**
 * A single contiguous fret range, deliberately not `FretboardRegion`
 * (`$lib/music/local-fields.ts`) — this feature keeps its own zone state
 * rather than sharing `fretfield.activeRegion`, so a running session never
 * fights with whatever Local Field region is set elsewhere.
 */
export interface PracticeZone {
	minFret: number;
	maxFret: number;
}

/** How close a played note's onset was to the beat it's being judged against. */
export type BeatTiming = 'on-time' | 'off-time' | 'missed';

/** Pitch correctness is independent of timing; `null` only when nothing was played at all. */
export type BeatPitchResult = 'correct' | 'incorrect' | null;

export interface BeatResult {
	target: PitchClass;
	pitch: BeatPitchResult;
	timing: BeatTiming;
	/** Always the target's own fret positions within the zone — feedback is rendered on the note being drilled, not wherever a wrong note happened to be played. */
	positions: FretPosition[];
}
