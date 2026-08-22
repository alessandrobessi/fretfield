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
 *
 * A later pass added a second full oscillator (`oscillator.osc2*`, alongside
 * Main and Sub) and a second independent LFO (`lfo1`/`lfo2`, replacing the
 * single `lfo` field) -- bumping `version` to 3.
 *
 * Acid Bass Intelligence V4 (`~/Downloads/ACID-BASS-INTELLIGENCE-V4.md`,
 * implemented incrementally -- see `ROADMAP.md` for current milestone
 * status) bumps `version` to 4 and adds, all additive/neutral-by-default on
 * top of the V3 shape: `AcidBassMode` (`mode: 'manual' | 'generated'` on
 * `AcidBassState`, `'manual'` for every migrated groove); `generation:
 * AcidBassGenerationSettings` (style/harmony-mode/seed/density/chromaticism/
 * movement/register/playability/intelligence -- the *settings* a future pure
 * `$lib/music/bassline/` generator will read; the generated plan itself is
 * derived at runtime, never persisted here); and three new patch
 * sub-objects -- `modulation: AcidAuxModulationSection` (three more
 * single-destination modulation sources: Envelope/Accent/Random, alongside
 * the existing `lfo1`/`lfo2` -- still five sources total, still never a
 * many-to-many matrix), `distortion: AcidDistortionPatch` (a shared
 * transfer-curve character, `'soft'` reproducing the existing V3 curve
 * exactly), and `delay: AcidDelayPatch` (one dedicated tempo-synced delay,
 * disabled/dry by default). `acid-bass/migrate.ts` reads `version` as the
 * runtime discriminant to tell a persisted V1 groove (no `version` at all)
 * from a V2 one (singular `lfo`, no `osc2*`) from a V3-or-current one (V3's
 * shape is a strict subset of V4's -- pure additions, no restructuring --
 * so both coerce through the identical trusted-shape path) -- deliberately
 * not a `V2`/`V3`/`V4` suffix on any type name here, the same way V1 never
 * had a `V1` suffix on anything.
 *
 * Deliberately imports `PatternRole` from `groove/pattern-role` (a leaf
 * module with no dependencies of its own), never from `groove/types` --
 * `groove/types.ts` imports `AcidBassState` from *this* file to nest it
 * inside `Groove`, so importing back from `groove/types` here would create a
 * cycle.
 */

import type { IntervalId } from '$lib/music/intervals';

import type { PatternRole } from '$lib/groove/pattern-role';
import type { BassHarmonyMode, BasslineStyleId, BassRegisterMode } from '$lib/music/bassline/types';

export type AcidWave = 'saw' | 'square' | 'triangle' | 'pulse';
export type AcidSubWave = 'square' | 'triangle';
export type AcidSubOctave = -1 | -2;
export type AcidOctaveOffset = -1 | 0 | 1;

export type AcidFilterModel = 'legacy' | 'svf12' | 'acid24';
export type AcidGlideCurve = 'linear' | 'exponential';

export type AcidLfoShape = 'sine' | 'triangle' | 'square' | 'sampleHold';
export type AcidLfoDestination = 'cutoff' | 'pitch' | 'pulseWidth' | 'subLevel' | 'osc2Level';
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
	/**
	 * Osc 2 -- a second full oscillator, independent of the Sub below: its own
	 * wave (any `AcidWave`, including Pulse), and its own tune/fine (not
	 * Main's), which is what makes it useful for detune/unison stacking.
	 * Implemented in the voice as a single type-switched `OscillatorNode`
	 * (like Sub), not a 4-way crossfaded bank (like Main) -- a wave change
	 * here is an infrequent patch edit, same reasoning the codebase already
	 * applies to Sub.
	 */
	osc2Enabled: boolean;
	osc2Wave: AcidWave;
	/** -12..+12 semitones, independent of Main's `tune`. */
	osc2Tune: number;
	/** -50..+50 cents, independent of Main's `fine`. */
	osc2Fine: number;
	/** 0-100. */
	osc2Level: number;
	/** 5..95, meaningful only when `osc2Wave === 'pulse'` -- a static duty cycle regenerated on `setPatch()`, same as Main's pre-worklet Pulse. No live PWM/LFO routing for Osc 2 -- that stays Main-only. */
	osc2PulseWidth: number;
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
	/** 0-100, filter-envelope decay (was V1's "Decay"). Also the amplitude envelope's own decay time (peak -> Sustain level) -- one shared Decay time for both, not a second Amp Decay knob. */
	decay: number;
	/** 0-100, amplitude release. */
	release: number;
	/** 0-100. Scales both the VCA peak and the filter-envelope peak together for an accented step -- deliberately one control, not separate accent-volume/accent-filter/accent-drive knobs (spec §28). */
	accentAmount: number;
	/** 0-100, the amplitude level (as a percentage of peak) the note settles to after Decay, held for as long as the step's gate stays open. 100 reproduces the pre-Sustain behavior exactly (holds at full peak, no audible decay stage) -- every existing/migrated patch defaults here. */
	sustain: number;
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

// ---------------------------------------------------------------------------
// V4: bassline generation settings (Acid Bass Intelligence V4)
// ---------------------------------------------------------------------------

export type AcidBassMode = 'manual' | 'generated';

/**
 * Re-exported, not redefined -- `$lib/music/bassline/types.ts` is the
 * canonical home (the V4 architecture's innermost layer; this module
 * bridges *into* Acid Bass domain data from there, never the reverse, per
 * `~/Downloads/ACID-BASS-INTELLIGENCE-V4.md` §5/§45).
 */
export type { BasslineStyleId, BassHarmonyMode, BassRegisterMode };

/**
 * Persisted alongside a groove; the generated plan itself is derived from
 * these settings (plus the current progression/scale/zone/tuning context)
 * at runtime and never persisted -- see the file header.
 */
export interface AcidBassGenerationSettings {
	style: BasslineStyleId;
	harmonyMode: BassHarmonyMode;
	/** Unsigned 32-bit deterministic generator seed -- the pure generator never calls `Math.random()`. */
	seed: number;
	/** 0-100. Amount of available rhythmic slots to activate. */
	density: number;
	/** 0-100. Permission to transform weak notes into targeted chromatic motion. */
	chromaticism: number;
	/** 0-100. Preference for melodic movement versus repetition/root anchoring. */
	movement: number;
	register: BassRegisterMode;
	/** 0-100. Strength of physical fretboard-motion penalties. */
	playability: number;
	/** 0-100. Strength of synthesis/articulation response to musical function -- 0 means generated notes still exist, but the Acid Intelligence bridge (a later milestone) adds no extra expression locks/decisions. */
	intelligence: number;
}

// ---------------------------------------------------------------------------
// V4: distortion character
// ---------------------------------------------------------------------------

export type AcidDistortionCharacter = 'soft' | 'diode' | 'hard';

/** Shared transfer-curve character for both pre-filter Saturation and post-VCA Drive -- existing controls still determine amount/pregain independently. `soft` reproduces the existing V3 tanh-like curve exactly. */
export interface AcidDistortionPatch {
	character: AcidDistortionCharacter;
}

// ---------------------------------------------------------------------------
// V4: auxiliary modulation (Envelope/Accent/Random -- alongside lfo1/lfo2)
// ---------------------------------------------------------------------------

/** The common destination vocabulary shared by every V4 modulation source, including LFO 1/LFO 2. Wider than the original `AcidLfoDestination` (adds `resonance`/`drive`) -- `AcidLfoDestination` stays its own narrower type until a later milestone actually widens what LFO 1/LFO 2 can target. */
export type AcidModulationDestination =
	'cutoff' | 'resonance' | 'pitch' | 'pulseWidth' | 'subLevel' | 'osc2Level' | 'drive';

/**
 * One auxiliary modulation source, exactly one destination -- the same
 * single-destination discipline `AcidLfoPatch` already keeps. Depth is
 * bipolar so a source can push a destination up or down.
 */
export interface AcidAuxModulationPatch {
	enabled: boolean;
	destination: AcidModulationDestination;
	/** -100..100. */
	depth: number;
}

/**
 * Three fixed sources -- Envelope (the existing note-envelope timing as a
 * modulation contour), Accent (contributes only on accented triggers), and
 * Random (one deterministic held bipolar value per trigger, never audio-rate
 * noise, never `Math.random()` inside the audio voice). Together with
 * `lfo1`/`lfo2` this is five single-destination sources total -- still not a
 * many-to-many modulation matrix.
 */
export interface AcidAuxModulationSection {
	envelope: AcidAuxModulationPatch;
	accent: AcidAuxModulationPatch;
	random: AcidAuxModulationPatch;
}

// ---------------------------------------------------------------------------
// V4: tempo-synced delay
// ---------------------------------------------------------------------------

export type AcidDelayDivision = '1/4' | '1/8' | '1/8D' | '1/8T' | '1/16' | '1/16D' | '1/16T';

/** One dedicated tempo-synced delay -- not a general effects rack. `enabled: false` or `mix: 0` must reproduce dry V3 output exactly. */
export interface AcidDelayPatch {
	enabled: boolean;
	division: AcidDelayDivision;
	/** 0-100 UI value; internally capped well below unity feedback (see `delay.ts`'s `delayFeedbackToGain`, M17). */
	feedback: number;
	/** 0-100 wet mix -- a send amount, not a dry/wet crossfade (see `delay.ts`'s `delayMixToSendGain`, M17): the dry signal always stays at full level. */
	mix: number;
}

/**
 * Grouped by signal-path responsibility so the data model matches
 * `acid-bass-voice.ts`'s own node graph (OSC -> FILTER -> ENV/VCA -> GLIDE,
 * with LFO/OUTPUT alongside) -- see spec §8 for why this replaced V1's flat
 * six-field patch.
 *
 * Two independent LFO slots (`lfo1`/`lfo2`), not an array/tuple -- keeps the
 * existing spread-based updater style (`{...patch, lfo1: {...}}`) and keeps
 * persisted JSON self-describing. Each is a full, independent `AcidLfoPatch`
 * (its own shape/destination/rate/depth) -- still single-destination each,
 * not a many-to-many modulation matrix (deliberately declined as bigger than
 * what was asked for).
 */
export interface AcidBassPatch {
	oscillator: AcidOscillatorPatch;
	filter: AcidFilterPatch;
	envelope: AcidEnvelopePatch;
	glide: AcidGlidePatch;
	lfo1: AcidLfoPatch;
	lfo2: AcidLfoPatch;
	/** V4: three more single-destination modulation sources, alongside lfo1/lfo2. */
	modulation: AcidAuxModulationSection;
	/** V4: shared distortion character for Saturation and Drive. */
	distortion: AcidDistortionPatch;
	/** V4: one dedicated tempo-synced delay. */
	delay: AcidDelayPatch;
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
	/** Applies to LFO 1's depth only -- kept singular rather than growing to `lfo1Depth`/`lfo2Depth` when the second LFO was added, per this type's own "deliberately only five lockable targets" doctrine. */
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
	/** The runtime discriminant `acid-bass/migrate.ts` uses to tell a persisted V1 groove (no `version` field at all) from a V2 one (singular `patch.lfo`) from a V3-or-current one (4: `mode`/`generation`/`patch.modulation`/`patch.distortion`/`patch.delay` -- V3's own shape is a strict subset, so it coerces through the same trusted path). */
	version: 4;
	/** Off by default, including for every migrated pre-Acid-Bass or V1 groove -- turning it on/off affects only this voice, never drums, chord backing, transport, or fretboard highlighting. */
	enabled: boolean;
	/** V4: `'manual'` for every migrated groove and every fresh groove by default -- V4 must never silently replace a user's manual sequencer with generated music. */
	mode: AcidBassMode;
	patch: AcidBassPatch;
	patterns: Record<PatternRole, AcidBassPattern>;
	/** Whether a slide on a pattern's last step glides into the next bar's first active step (spec §30/§76). Defaults `true` for freshly-created V2 state, `false` for anything migrated from V1 -- a migrated groove must not gain new end-of-bar articulation it wasn't authored with. */
	crossBarSlide: boolean;
	/** V4: settings for the (not-yet-implemented, as of this milestone) bassline generator -- see `AcidBassGenerationSettings`. */
	generation: AcidBassGenerationSettings;
}
