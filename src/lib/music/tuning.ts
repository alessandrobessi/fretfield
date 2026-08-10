import { type PitchClass, noteNameToPitchClass } from './pitch';

/** Open-string pitch classes, low string first. */
export type Tuning = readonly PitchClass[];

/** Default FretField configuration per AGENTS.md §15: E A D G, low to high. */
export const STANDARD_4_STRING_TUNING: Tuning = Object.freeze([
	noteNameToPitchClass('E'),
	noteNameToPitchClass('A'),
	noteNameToPitchClass('D'),
	noteNameToPitchClass('G')
]);

export const DEFAULT_FRET_COUNT = 20;
