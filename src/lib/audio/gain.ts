/**
 * Shared 0-100 "channel volume" -> Web Audio gain curve, used by every
 * Groove Engine voice (Bass, Chords, Drums) so their faders share one
 * headroom convention instead of each channel inventing its own scale.
 */

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// Headroom against the rest of the Groove Engine's output (drums, chord
// pad, bass) -- Volume 100 deliberately doesn't reach a bare 1.0 output gain.
export const MAX_OUTPUT_GAIN = 0.9;

/** 0-100 -> the actual final output gain (headroom already folded in -- there is no separate trim multiplier elsewhere). Deliberately linear; this is channel level against the rest of the Groove Engine's voices, not a mastering control. */
export function volumeToGain(value: number): number {
	return (clamp(value, 0, 100) / 100) * MAX_OUTPUT_GAIN;
}
