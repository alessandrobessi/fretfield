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
