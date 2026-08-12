import { normalizePitchClass, noteNameToPitchClass, type PitchClass } from './pitch';
import type { FretPosition } from './fretboard';

/**
 * The existing `Tuning` (tuning.ts) is deliberately pitch-class-only — that's
 * what chord/interval harmony needs. Absolute pitch (which physical string+
 * fret produces which acoustic note) is a separate, small concern layered on
 * top for Live Input; it must not replace or complicate the pitch-class model
 * the rest of the engine relies on.
 */
export interface AbsoluteStringTuning {
	pitchClass: PitchClass;
	/** MIDI note number of the open string (scientific pitch notation: MIDI 60 = C4). */
	midi: number;
}

export type AbsoluteTuning = readonly AbsoluteStringTuning[];

/** Standard 4-string bass, low to high: E1=28, A1=33, D2=38, G2=43. */
export const STANDARD_4_STRING_ABSOLUTE_TUNING: AbsoluteTuning = Object.freeze([
	{ pitchClass: noteNameToPitchClass('E'), midi: 28 },
	{ pitchClass: noteNameToPitchClass('A'), midi: 33 },
	{ pitchClass: noteNameToPitchClass('D'), midi: 38 },
	{ pitchClass: noteNameToPitchClass('G'), midi: 43 }
]);

export function getMidiAtPosition(
	tuning: AbsoluteTuning,
	stringIndex: number,
	fret: number
): number {
	const openString = tuning[stringIndex];
	if (openString === undefined) {
		throw new Error(`Invalid string index: ${stringIndex}`);
	}
	return openString.midi + fret;
}

/**
 * Every physical position capable of producing the exact acoustic pitch
 * `midi` (not just its pitch class) within `[0, fretCount]`. A detected E2
 * must map only to E2-producing frets — never to every E on the neck.
 */
export function findFretPositionsForMidi(
	tuning: AbsoluteTuning,
	fretCount: number,
	midi: number
): FretPosition[] {
	const positions: FretPosition[] = [];
	for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
		const fret = midi - tuning[stringIndex].midi;
		if (fret >= 0 && fret <= fretCount) {
			positions.push({ stringIndex, fret, pitchClass: normalizePitchClass(midi) });
		}
	}
	return positions;
}
