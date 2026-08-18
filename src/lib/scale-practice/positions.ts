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
 * Every fret position within the zone whose pitch class belongs to the
 * scale — the whole scale, shown at once, not one note at a time. A narrow
 * zone simply omits degrees it can't reach rather than falling back to the
 * full neck, since the zone is an intentional practice constraint.
 */
export function scalePositions(
	root: PitchClass,
	scale: ScaleDefinition,
	zone: PracticeZone,
	tuning: Tuning,
	fretCount: number
): FretPosition[] {
	return scalePitchClasses(root, scale).flatMap((pitchClass) =>
		positionsForPitchClass(pitchClass, zone, tuning, fretCount)
	);
}
