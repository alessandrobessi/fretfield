import { type PitchClass, transpose } from './pitch';
import type { Tuning } from './tuning';

export interface FretPosition {
	stringIndex: number;
	fret: number;
	pitchClass: PitchClass;
}

export function getPitchAtPosition(tuning: Tuning, stringIndex: number, fret: number): PitchClass {
	const openString = tuning[stringIndex];
	if (openString === undefined) {
		throw new Error(`Invalid string index: ${stringIndex}`);
	}
	return transpose(openString, fret);
}

/** Derives the full fretboard from tuning + fret count — never from a lookup table. */
export function createFretboard(tuning: Tuning, fretCount: number): FretPosition[] {
	const positions: FretPosition[] = [];
	for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
		for (let fret = 0; fret <= fretCount; fret++) {
			positions.push({
				stringIndex,
				fret,
				pitchClass: getPitchAtPosition(tuning, stringIndex, fret)
			});
		}
	}
	return positions;
}
