import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';
import { scalePitchClasses, type ScaleDefinition } from '$lib/music/scales';
import type { Tuning } from '$lib/music/tuning';
import type { PracticeZone } from './types';

export function positionsForPitchClass(
	pitchClass: PitchClass,
	zone: PracticeZone,
	tuning: Tuning,
	fretCount: number
): FretPosition[] {
	return createFretboard(tuning, fretCount).filter(
		(position) =>
			position.fret >= zone.minFret &&
			position.fret <= zone.maxFret &&
			position.pitchClass === pitchClass
	);
}

/**
 * Ascending = the scale's own interval order (already ascending by
 * construction, per `scales.ts`), filtered to pitch classes that actually
 * have at least one fret position inside the zone — a narrow zone simply
 * skips degrees it can't reach rather than falling back to the full neck,
 * since the zone here is an intentional practice constraint, not a lens.
 *
 * Descending mirrors the ascending run without repeating either turnaround
 * note, then the whole thing loops: e.g. C major pentatonic in a wide-open
 * zone → C D E G A G E D (C D E G A G E D ...).
 */
export function buildScaleSequence(
	root: PitchClass,
	scale: ScaleDefinition,
	zone: PracticeZone,
	tuning: Tuning,
	fretCount: number
): PitchClass[] {
	const ascending = scalePitchClasses(root, scale).filter(
		(pitchClass) => positionsForPitchClass(pitchClass, zone, tuning, fretCount).length > 0
	);
	if (ascending.length <= 1) return ascending;
	const descendingMiddle = ascending.slice(1, -1).reverse();
	return [...ascending, ...descendingMiddle];
}
