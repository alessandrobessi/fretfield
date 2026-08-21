/**
 * The Acid Bass voice's own data model -- plain data, no functions, no class
 * instances, round-trips through JSON unchanged (nested inside `Groove`, see
 * `groove/types.ts`). A monophonic synth bass living inside the Groove
 * Engine, reusing the same A/B/F/T pattern roles the drum patterns use --
 * there is no independent bass arrangement.
 *
 * V2 (see ~/Downloads/ACID-BASS-ENGINE-V2.md): the flat 6-macro V1 patch
 * became a nested patch grouped by signal-path responsibility (oscillator /
 * filter / envelope / glide / lfo / output), and a step gained software-only
 * sequencer powers (probability / ratchet / gate / parameter locks).
 * `version: 2` on `AcidBassState` is the runtime discriminant `acid-bass/
 * migrate.ts` reads to tell a persisted V1 groove from a current one --
 * deliberately not a `V2` suffix on any type name here, the same way V1
 * never had a `V1` suffix on anything.
 *
 * Deliberately imports `PatternRole` from `groove/pattern-role` (a leaf
 * module with no dependencies of its own), never from `groove/types` --
 * `groove/types.ts` imports `AcidBassState` from *this* file to nest it
 * inside `Groove`, so importing back from `groove/types` here would create a
 * cycle.
 */

import type { IntervalId } from '$lib/music/intervals';

import type { PatternRole } from '$lib/groove/pattern-role';

export type AcidWave = 'saw' | 'square' | 'triangle' | 'pulse';
export type AcidSubWave = 'square' | 'triangle';
export type AcidSubOctave = -1 | -2;
export type AcidOctaveOffset = -1 | 0 | 1;

export type AcidFilterModel = 'legacy' | 'svf12' | 'acid24';
export type AcidGlideCurve = 'linear' | 'exponential';

export type AcidLfoShape = 'sine' | 'triangle' | 'square' | 'sampleHold';
export type AcidLfoDestination = 'cutoff' | 'pitch' | 'pulseWidth' | 'subLevel';
export type AcidLfoRateMode = 'free' | 'sync';
export type AcidLfoDivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32';

export interface AcidOscillatorPatch {
	mainWave: AcidWave;
	/** -12..+12 semitones, global synth transposition -- applied after harmonic resolution, separate from a step's own interval/octave data. */
	tune: number;
	/** -50..+50 cents. */
	fine: number;
	/** 0-100. */
	mainLevel: number;
	subEnabled: boolean;
	subOctave: AcidSubOctave;
	subWave: AcidSubWave;
	/** 0-100. */
	subLevel: number;
	/** 5..95, meaningful only when `mainWave === 'pulse'`. */
	pulseWidth: number;
}

export interface AcidFilterPatch {
	model: AcidFilterModel;
	/** 0-100, logarithmic frequency mapping (was V1's "Tone"). */
	cutoff: number;
	/** 0-100 -- behavior is filter-model-specific, see `resolve.ts`'s `resonanceToModelParameter`. */
	resonance: number;
	/** -100..+100, bipolar (was V1's unipolar "Motion"). Positive opens the filter above the base cutoff; negative closes it below. */
	envAmount: number;
	/** 0-100: 0 is cutoff independent of note pitch, 100 is ~1:1 musical tracking. */
	keyTracking: number;
	/** 0-100, saturation before the filter. */
	saturation: number;
}

export interface AcidEnvelopePatch {
	/** 0-100. */
	attack: number;
	/** 0-100, filter-envelope decay (was V1's "Decay"). */
	decay: number;
	/** 0-100, amplitude release. */
	release: number;
	/** 0-100. Scales both the VCA peak and the filter-envelope peak together for an accented step -- deliberately one control, not separate accent-volume/accent-filter/accent-drive knobs (spec §28). */
	accentAmount: number;
}

export interface AcidGlidePatch {
	/** 0-100. */
	time: number;
	curve: AcidGlideCurve;
}

export interface AcidLfoPatch {
	enabled: boolean;
	shape: AcidLfoShape;
	destination: AcidLfoDestination;
	rateMode: AcidLfoRateMode;
	/** Hz, meaningful only when `rateMode === 'free'`. */
	rateHz: number;
	/** Meaningful only when `rateMode === 'sync'` -- derived from the Groove transport's current BPM, never an independent clock. */
	division: AcidLfoDivision;
	/** 0-100. */
	depth: number;
}

export interface AcidOutputPatch {
	/** 0-100, post-filter/VCA drive (was V1's "Drive"). */
	drive: number;
	/** 0-100, patch output level -- headroom against drums/chord-pad/other Groove voices, not a global Groove volume. */
	volume: number;
}

/**
 * Grouped by signal-path responsibility so the data model matches
 * `acid-bass-voice.ts`'s own node graph (OSC -> FILTER -> ENV/VCA -> GLIDE,
 * with LFO/OUTPUT alongside) -- see spec §8 for why this replaced V1's flat
 * six-field patch.
 */
export interface AcidBassPatch {
	oscillator: AcidOscillatorPatch;
	filter: AcidFilterPatch;
	envelope: AcidEnvelopePatch;
	glide: AcidGlidePatch;
	lfo: AcidLfoPatch;
	output: AcidOutputPatch;
}

/**
 * A step lock temporarily overrides one patch value for just that step,
 * reverting to the patch's own value immediately after (see
 * `acid-bass/sequencer.ts`). Deliberately only five lockable targets --
 * letting every patch field be locked would grow into a hidden automation
 * system (spec §44).
 */
export interface AcidStepLocks {
	cutoff?: number;
	resonance?: number;
	envAmount?: number;
	drive?: number;
	lfoDepth?: number;
}

/**
 * A step's harmonic identity is an interval, not a note name -- reusing the
 * app's one canonical interval representation (`$lib/music/intervals.ts`)
 * rather than inventing a second naming table. Resolved to an absolute pitch
 * at playback time against whatever the current bar's harmonic root is (the
 * active progression chord's root, or `scalePractice.root` with no
 * progression) -- see `resolve.ts`.
 */
export interface AcidBassStep {
	active: boolean;
	interval: IntervalId;
	octave: AcidOctaveOffset;
	accent: boolean;
	/** Glides from this step into the immediately following step (or, if `crossBarSlide` is on, the next bar's first active step) -- no glide across an inactive step in between. Ignored when `ratchet > 1` (a step can't be both a ratchet cluster and a legato slide source, spec §42). */
	slide: boolean;
	/** 0-100, default 100. Evaluated deterministically once per source step per loop pass (see `sequencer.ts`), never `Math.random()`. */
	probability: number;
	/** 1-4, default 1. Subdivides this one step into that many evenly-spaced triggers; accent and locks apply to the whole ratchet group. */
	ratchet: 1 | 2 | 3 | 4;
	/** 10-100, default 82 (replaces V1's fixed `GATE_RATIO` constant with a per-step value). Does not affect a slide source step, which stays open into its destination regardless. */
	gate: number;
	locks?: AcidStepLocks;
}

export type AcidBassPattern = AcidBassStep[];

export interface AcidBassState {
	/** The runtime discriminant `acid-bass/migrate.ts` uses to tell a persisted V1 groove (no `version` field at all) from a current one. */
	version: 2;
	/** Off by default, including for every migrated pre-Acid-Bass or V1 groove -- turning it on/off affects only this voice, never drums, chord backing, transport, or fretboard highlighting. */
	enabled: boolean;
	patch: AcidBassPatch;
	patterns: Record<PatternRole, AcidBassPattern>;
	/** Whether a slide on a pattern's last step glides into the next bar's first active step (spec §30/§76). Defaults `true` for freshly-created V2 state, `false` for anything migrated from V1 -- a migrated groove must not gain new end-of-bar articulation it wasn't authored with. */
	crossBarSlide: boolean;
}
