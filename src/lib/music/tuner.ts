import type { AbsoluteStringTuning, AbsoluteTuning } from './absolute-pitch';

/**
 * The Tuner's own pure math (user-requested, 2026-08): which open string a
 * detected pitch is closest to, how many cents off that specific string it
 * is, and a plain-language status label. Zero Svelte/DOM/audio imports —
 * `TunerControls.svelte` is the only caller, feeding it `DetectedNote`'s
 * already-computed `midi`/`cents` (`$lib/audio/types.ts`) rather than this
 * module ever touching a frequency or `AudioContext` itself.
 */

export interface ClosestStringMatch {
	string: AbsoluteStringTuning;
	/** Absolute semitone distance between the detected pitch's nearest MIDI note and this string's own open-string MIDI note. */
	semitoneDistance: number;
}

/** Picks whichever open string's own MIDI note is nearest the detected pitch's nearest MIDI note -- ties resolve to the first (lowest) string in `tuning`, same order-preserving convention `findFretPositionsForMidi` (`absolute-pitch.ts`) already uses. */
export function findClosestOpenString(tuning: AbsoluteTuning, midi: number): ClosestStringMatch {
	let best: ClosestStringMatch | null = null;
	for (const string of tuning) {
		const semitoneDistance = Math.abs(midi - string.midi);
		if (best === null || semitoneDistance < best.semitoneDistance) {
			best = { string, semitoneDistance };
		}
	}
	if (best === null)
		throw new Error('findClosestOpenString: tuning must have at least one string.');
	return best;
}

/**
 * Total cents deviation from `stringMidi`, not just from the detected
 * pitch's own nearest MIDI note. Collapses to exactly `detectedCents` when
 * `detectedMidi === stringMidi` (the ordinary in-tune-ish case: you actually
 * plucked the target open string) -- the semitone term only matters once a
 * string is meaningfully mistuned or the wrong note entirely.
 */
export function centsFromOpenString(
	detectedMidi: number,
	detectedCents: number,
	stringMidi: number
): number {
	return (detectedMidi - stringMidi) * 100 + detectedCents;
}

/** Beyond this many semitones from the nearest open string, a reading is treated as a fretted note being played, not an open string being tuned -- showing cents-off-target here would be meaningless (or actively misleading) rather than just imprecise. */
export const MAX_SEMITONES_FROM_OPEN_STRING = 3;

export type TunerStatus = 'in-tune' | 'slightly-flat' | 'flat' | 'slightly-sharp' | 'sharp';

const IN_TUNE_CENTS = 5;
const SLIGHT_CENTS = 20;

/** Standard tuner-UX thresholds: within ±5 cents reads as in tune, ±5-20 as "slightly" off, beyond that plainly sharp/flat. */
export function classifyTunerStatus(cents: number): TunerStatus {
	if (Math.abs(cents) <= IN_TUNE_CENTS) return 'in-tune';
	if (cents > 0) return cents <= SLIGHT_CENTS ? 'slightly-sharp' : 'sharp';
	return cents >= -SLIGHT_CENTS ? 'slightly-flat' : 'flat';
}
