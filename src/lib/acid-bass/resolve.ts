import { intervalSemitones } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';

import type { AcidBassStep } from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

const MIN_CUTOFF_HZ = 70;
const MAX_CUTOFF_HZ = 4500;
// The absolute safety ceiling once Motion/accent boost the base cutoff --
// well below Nyquist at any real sample rate, and plenty bright for a
// bass-register voice (see AGENTS.md's Acid Bass doctrine once written).
const MAX_SAFE_CUTOFF_HZ = 12000;

/** 0-100, perceptually logarithmic (matching how filter brightness is actually heard) rather than a linear Hz sweep -- dark/round at 0 to bright/open at 100. */
export function toneToCutoffHz(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_CUTOFF_HZ * Math.pow(MAX_CUTOFF_HZ / MIN_CUTOFF_HZ, t);
}

/** Applied after combining base cutoff with the Motion/accent envelope peak -- the one place an unsafe (near-Nyquist or negative) cutoff is guaranteed not to reach the filter. */
export function clampCutoffHz(hz: number): number {
	return clamp(hz, MIN_CUTOFF_HZ, MAX_SAFE_CUTOFF_HZ);
}

const MIN_Q = 0.5;
const MAX_Q = 16;

/** 0-100 -> `BiquadFilterNode.Q`, broad/round at 0 to narrow/squelchy at 100. */
export function resonanceToQ(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_Q + (MAX_Q - MIN_Q) * t;
}

/** Multiplier applied to the base cutoff for the filter envelope's peak -- 1 at Motion=0 (no additional opening beyond Tone's base cutoff) up to 7x at Motion=100. Accent scales this further (see `acid-bass-voice.ts`). */
export function motionToEnvelopeRatio(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return 1 + t * 6;
}

const MIN_DECAY_SECONDS = 0.07;
const MAX_DECAY_SECONDS = 0.9;

/** 0-100, logarithmic -- short/percussive at 0 to long/connected at 100. Drives both the filter-envelope decay and the amplitude release. */
export function decayToSeconds(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_DECAY_SECONDS * Math.pow(MAX_DECAY_SECONDS / MIN_DECAY_SECONDS, t);
}

const MAX_DRIVE_PREGAIN = 10;

/** 0-100 -> the gain applied before the `WaveShaperNode` -- 1x (effectively clean) at 0, up to 10x (clearly driven, still bounded by the shaper's own curve) at 100. */
export function driveToPregain(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return 1 + t * (MAX_DRIVE_PREGAIN - 1);
}

// C2 -- comfortably in a musically sensible bass register, and low enough
// that `referenceRoot` (0-11) always lands the unshifted root note in MIDI
// 36-47 regardless of which pitch class it is.
const BASS_REFERENCE_OCTAVE_MIDI = 36;
const MIN_PLAYABLE_MIDI = 28;
const MAX_PLAYABLE_MIDI = 64;

/**
 * Resolves a step's stored interval/octave to an absolute MIDI note against
 * whatever the current bar's harmonic root is (the active progression
 * chord's root, or `scalePractice.root` with no progression -- see
 * `scale-practice.svelte.ts`). Convert the result to Hz with
 * `$lib/audio/note-mapping.ts`'s existing `midiToFrequency` -- never a
 * second frequency formula.
 */
export function resolveAcidStepMidi(referenceRoot: PitchClass, step: AcidBassStep): number {
	const baseMidi = BASS_REFERENCE_OCTAVE_MIDI + referenceRoot;
	const midi = baseMidi + intervalSemitones(step.interval) + step.octave * 12;
	return clamp(midi, MIN_PLAYABLE_MIDI, MAX_PLAYABLE_MIDI);
}
