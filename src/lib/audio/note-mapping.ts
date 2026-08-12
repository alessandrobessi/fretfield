import { normalizePitchClass, type PitchClass } from '$lib/music/pitch';
import type { DetectedNote } from './types';

/** Standard concert pitch. Kept as a parameter (not hardcoded through the module) so alternate tunings can be supported later. */
export const DEFAULT_A4_HZ = 440;

/** Floating-point MIDI note number — not yet rounded to a note. */
export function frequencyToMidi(frequencyHz: number, a4Hz: number = DEFAULT_A4_HZ): number {
	return 69 + 12 * Math.log2(frequencyHz / a4Hz);
}

export function midiToFrequency(midi: number, a4Hz: number = DEFAULT_A4_HZ): number {
	return a4Hz * Math.pow(2, (midi - 69) / 12);
}

export function nearestMidi(floatingMidi: number): number {
	return Math.round(floatingMidi);
}

/** MIDI 0-11 = C-1 .. B-1, so pitch class is simply MIDI mod 12 (C=0, matching $lib/music/pitch.ts). */
export function midiToPitchClass(midi: number): PitchClass {
	return normalizePitchClass(midi);
}

/** Scientific pitch notation: MIDI 60 = C4, MIDI 28 = E1. */
export function midiToOctave(midi: number): number {
	return Math.floor(midi / 12) - 1;
}

/** Deviation of a floating MIDI value from a chosen (usually nearest) MIDI note, in cents. */
export function centsDeviation(floatingMidi: number, referenceMidi: number): number {
	return (floatingMidi - referenceMidi) * 100;
}

/**
 * Whether a detected note matches an expected target pitch class — pitch-class
 * equality only (octave-agnostic), so a bass player can confirm a Voice-Leading
 * Path target in whatever octave they actually reach it. Exists as its own pure
 * function so a future Guided Practice mode can reuse it without re-deriving
 * this comparison.
 */
export function matchesTarget(note: DetectedNote, expectedTargetPitchClass: PitchClass): boolean {
	return note.pitchClass === expectedTargetPitchClass;
}
