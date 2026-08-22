/**
 * Pitch evaluation (Acid Bass Intelligence V4 §33.4) -- exact MIDI, never
 * inferred fret/string position (§33.1: "equivalent fretboard positions
 * producing the same exact MIDI are accepted").
 */

import { midiToPitchClass } from '$lib/audio/note-mapping';

import type { BassAttemptResult } from './types';

/**
 * §33.4's own behavior table:
 * - same MIDI -> `'correct'`
 * - same pitch class, different MIDI -> `'right-class-wrong-octave'`
 * - otherwise -> `'incorrect'`
 */
export function evaluateBassAttempt(expectedMidi: number, playedMidi: number): BassAttemptResult {
	if (playedMidi === expectedMidi) return 'correct';
	if (midiToPitchClass(playedMidi) === midiToPitchClass(expectedMidi)) {
		return 'right-class-wrong-octave';
	}
	return 'incorrect';
}
