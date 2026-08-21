import { intervalSemitones } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';

import type { AcidBassStep, AcidFilterModel, AcidLfoDivision, AcidSubOctave } from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Oscillator
// ---------------------------------------------------------------------------

/** -12..+12 semitones and -50..+50 cents combined into one frequency ratio -- 2x at +12 semitones, 0.5x at -12. Applied to every oscillator (main and sub) after harmonic resolution. */
export function tuneFineToRatio(tuneSemitones: number, fineCents: number): number {
	const semis = clamp(tuneSemitones, -12, 12);
	const cents = clamp(fineCents, -50, 50);
	return Math.pow(2, (semis * 100 + cents) / 1200);
}

/** -1 or -2 octaves -> 0.5x or 0.25x -- the sub oscillator's frequency ratio relative to the main oscillator (before tune/fine, which both apply equally to main and sub). */
export function subOctaveToRatio(subOctave: AcidSubOctave): number {
	return Math.pow(2, subOctave);
}

const MIN_PULSE_WIDTH = 5;
const MAX_PULSE_WIDTH = 95;

/** Meaningful only when the main wave is Pulse -- clamped well clear of 0/100 so the pulse never collapses to silence or a full-duty (inaudible) square. */
export function pulseWidthClamp(value: number): number {
	return clamp(value, MIN_PULSE_WIDTH, MAX_PULSE_WIDTH);
}

/**
 * Deterministic mixer compensation for main+sub summing -- unity at
 * mainLevel 100 / subLevel 0 (a bare main oscillator sounds the same as V1's
 * single-oscillator voice), compensated (not a bare sum) once both are
 * driven hard, so summing two full-scale oscillators never doubles the
 * output unpredictably (spec §12). An equal-power-style curve: only pulls
 * gain down once the combined "energy" would exceed unity, never boosts a
 * quiet single-oscillator patch.
 */
export function mixCompensation(mainLevel: number, subLevel: number): number {
	const main = clamp(mainLevel, 0, 100) / 100;
	const sub = clamp(subLevel, 0, 100) / 100;
	const energy = main * main + sub * sub;
	return energy > 1 ? 1 / Math.sqrt(energy) : 1;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

const MIN_CUTOFF_HZ = 70;
const MAX_CUTOFF_HZ = 4500;
// The absolute safety ceiling once Env Mod/accent/key-tracking push the base
// cutoff upward -- well below Nyquist at any real sample rate, and plenty
// bright for a bass-register voice.
const MAX_SAFE_CUTOFF_HZ = 12000;

/** 0-100, perceptually logarithmic (matching how filter brightness is actually heard) rather than a linear Hz sweep -- dark/round at 0 to bright/open at 100. (Was V1's `toneToCutoffHz`; "Tone" is now "Cutoff".) */
export function cutoffToHz(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_CUTOFF_HZ * Math.pow(MAX_CUTOFF_HZ / MIN_CUTOFF_HZ, t);
}

/** Applied after combining base cutoff with the envelope/accent/key-tracking multipliers -- the one place an unsafe (near-Nyquist or negative) cutoff is guaranteed not to reach the filter. Also respects the actual sample rate, not a hardcoded 44.1kHz assumption (spec §64). */
export function clampCutoffHz(hz: number, sampleRate = 44100): number {
	const nyquistMargin = sampleRate * 0.45;
	return clamp(hz, MIN_CUTOFF_HZ, Math.min(MAX_SAFE_CUTOFF_HZ, nyquistMargin));
}

const MIN_Q = 0.5;
const MAX_Q = 16;
// svf12 is deliberately less aggressive than legacy/acid24 -- "cleaner,
// broader" per spec §16, not hardware-authentic.
const SVF12_MAX_Q = 9;
// A ladder filter's resonance is a feedback *amount*, not a Q -- roughly
// 0..4 is the conventional range for "audible resonance" up through the
// edge of self-oscillation for a 4-pole tanh-saturated ladder.
const MAX_LADDER_FEEDBACK = 4;

/**
 * 0-100 -> the actual DSP resonance parameter, filter-model-specific (spec
 * §18): `legacy`/`svf12` both drive a `BiquadFilterNode.Q` (svf12 capped
 * lower, for its cleaner character); `acid24` drives the AudioWorklet
 * ladder's feedback amount, a different unit entirely. The UI's 0-100 range
 * stays stable across all three; only this mapping changes.
 */
export function resonanceToModelParameter(model: AcidFilterModel, value: number): number {
	const t = clamp(value, 0, 100) / 100;
	if (model === 'acid24') return t * MAX_LADDER_FEEDBACK;
	const maxQ = model === 'svf12' ? SVF12_MAX_Q : MAX_Q;
	return MIN_Q + (maxQ - MIN_Q) * t;
}

/**
 * -100..+100, bipolar (was V1's unipolar `motionToEnvelopeRatio`). A
 * multiplier applied to the base cutoff for the filter envelope's peak: 1 at
 * 0 (no additional movement), up to 7x at +100 (envelope opens the filter),
 * down to ~1/7x at -100 (envelope closes the filter well below its base).
 * Continuous and monotonic through zero. Accent scales the *magnitude* of
 * this further in the voice (see `accentAmountToMultipliers`).
 */
export function envAmountToRatio(value: number): number {
	const v = clamp(value, -100, 100);
	if (v >= 0) return 1 + (v / 100) * 6;
	return 1 / (1 + (-v / 100) * 6);
}

/**
 * 0-100 -> how strongly filter cutoff follows note pitch: 0 is fully
 * independent of pitch (a fixed cutoff regardless of register), 100 is
 * ~1:1 musical tracking (the filter moves with the note the same way an
 * acoustic instrument's formants would). Returns a *multiplier* to apply to
 * the base cutoff, derived from how far `midi` sits from `referenceMidi`
 * (the same bass-register reference `resolveAcidStepMidi` anchors to) --
 * clamp the result's effect on cutoff at the call site via `clampCutoffHz`.
 */
export function keyTrackingMultiplier(
	trackingPercent: number,
	midi: number,
	referenceMidi: number
): number {
	const ratio = clamp(trackingPercent, 0, 100) / 100;
	return Math.pow(2, ((midi - referenceMidi) / 12) * ratio);
}

// ---------------------------------------------------------------------------
// Envelope / VCA
// ---------------------------------------------------------------------------

const MIN_ATTACK_SECONDS = 0.002;
const MAX_ATTACK_SECONDS = 0.25;

/** 0-100, logarithmic -- ~2ms (percussive, anti-click) at 0 to ~250ms (soft) at 100. */
export function attackToSeconds(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_ATTACK_SECONDS * Math.pow(MAX_ATTACK_SECONDS / MIN_ATTACK_SECONDS, t);
}

const MIN_RELEASE_SECONDS = 0.002;
const MAX_RELEASE_SECONDS = 0.6;

/** 0-100, logarithmic -- ~2ms at 0 to ~600ms at 100. */
export function releaseToSeconds(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_RELEASE_SECONDS * Math.pow(MAX_RELEASE_SECONDS / MIN_RELEASE_SECONDS, t);
}

const MIN_DECAY_SECONDS = 0.07;
const MAX_DECAY_SECONDS = 0.9;

/** 0-100, logarithmic -- short/percussive at 0 to long/connected at 100. Filter-envelope decay only (V1's "Decay" also doubled as amplitude release; V2 splits that into its own `release` control). */
export function decayToSeconds(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_DECAY_SECONDS * Math.pow(MAX_DECAY_SECONDS / MIN_DECAY_SECONDS, t);
}

/**
 * 0-100 -> independent VCA-peak and filter-envelope-peak boost multipliers
 * for an accented step (spec §27-28: one Accent control, not separate
 * accent-volume/accent-filter knobs). Passes through V1's own fixed
 * constants (1.28x VCA, 1.35x env) at value 50 -- exactly what
 * `v1AccentToV2Value` maps a migrated V1 groove onto -- and grows further
 * (not linearly) toward 100 for a "substantially stronger" hit, per spec
 * §27's own description of the high end.
 */
export function accentAmountToMultipliers(value: number): { vca: number; env: number } {
	const t = clamp(value, 0, 100) / 50;
	return {
		vca: 1 + 0.28 * Math.pow(t, 1.5),
		env: 1 + 0.35 * Math.pow(t, 1.5)
	};
}

// ---------------------------------------------------------------------------
// Glide
// ---------------------------------------------------------------------------

const MIN_GLIDE_SECONDS = 0.01;
const MAX_GLIDE_SECONDS = 0.5;

/** 0-100, logarithmic -- ~10ms at 0 to ~500ms at 100. */
export function glideTimeToSeconds(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return MIN_GLIDE_SECONDS * Math.pow(MAX_GLIDE_SECONDS / MIN_GLIDE_SECONDS, t);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const MAX_DRIVE_PREGAIN = 10;

/** 0-100 -> the gain applied before the drive `WaveShaperNode` -- 1x (effectively clean) at 0, up to 10x (clearly driven, still bounded by the shaper's own curve) at 100. */
export function driveToPregain(value: number): number {
	const t = clamp(value, 0, 100) / 100;
	return 1 + t * (MAX_DRIVE_PREGAIN - 1);
}

/** 0-100 -> a 0-1 output gain. Deliberately linear and headroom-conscious -- this is patch output level against the rest of the Groove Engine's voices, not a mastering control. */
export function volumeToGain(value: number): number {
	return clamp(value, 0, 100) / 100;
}

// ---------------------------------------------------------------------------
// LFO
// ---------------------------------------------------------------------------

const MIN_LFO_RATE_HZ = 0.05;
const MAX_LFO_RATE_HZ = 20;

export function lfoRateHzClamp(value: number): number {
	return clamp(value, MIN_LFO_RATE_HZ, MAX_LFO_RATE_HZ);
}

// Expressed as a fraction of a whole note (4 quarter-note beats) -- the same
// "beats" unit `stepOffsetMs`'s callers already think in. A triplet division
// is 2/3 the duration of its straight counterpart.
const DIVISION_BEATS: Record<AcidLfoDivision, number> = {
	'1/1': 4,
	'1/2': 2,
	'1/4': 1,
	'1/8': 0.5,
	'1/8T': 0.5 * (2 / 3),
	'1/16': 0.25,
	'1/16T': 0.25 * (2 / 3),
	'1/32': 0.125
};

/** Derives the LFO's Hz from the Groove transport's current BPM and a musical division -- never an independent clock (spec §34/§69). */
export function lfoSyncFrequencyHz(bpm: number, division: AcidLfoDivision): number {
	const beats = DIVISION_BEATS[division];
	const secondsPerBeat = 60 / bpm;
	return 1 / (beats * secondsPerBeat);
}

// ---------------------------------------------------------------------------
// Harmony (unchanged by V2 -- interval/octave resolution is independent of
// the patch's own tune/fine, which apply afterward, at the voice)
// ---------------------------------------------------------------------------

// C2 -- comfortably in a musically sensible bass register, and low enough
// that `referenceRoot` (0-11) always lands the unshifted root note in MIDI
// 36-47 regardless of which pitch class it is. Also the key-tracking
// reference note (see `keyTrackingMultiplier`).
export const BASS_REFERENCE_OCTAVE_MIDI = 36;
const MIN_PLAYABLE_MIDI = 28;
const MAX_PLAYABLE_MIDI = 64;

/**
 * Resolves a step's stored interval/octave to an absolute MIDI note against
 * whatever the current bar's harmonic root is (the active progression
 * chord's root, or `scalePractice.root` with no progression -- see
 * `scale-practice.svelte.ts`). Convert the result to Hz with
 * `$lib/audio/note-mapping.ts`'s existing `midiToFrequency` -- never a
 * second frequency formula. The oscillator's own tune/fine ratio
 * (`tuneFineToRatio`) applies afterward, at the voice -- it's a synth-wide
 * transposition, not part of a step's own harmonic identity.
 */
export function resolveAcidStepMidi(referenceRoot: PitchClass, step: AcidBassStep): number {
	const baseMidi = BASS_REFERENCE_OCTAVE_MIDI + referenceRoot;
	const midi = baseMidi + intervalSemitones(step.interval) + step.octave * 12;
	return clamp(midi, MIN_PLAYABLE_MIDI, MAX_PLAYABLE_MIDI);
}
