/**
 * The bassline generator's own domain model (Acid Bass Intelligence V4,
 * `~/Downloads/ACID-BASS-INTELLIGENCE-V4.md` §6/§8) -- pure TypeScript, no
 * Svelte/DOM/audio/store/Groove imports (see this file's own directory
 * boundary rules, AGENTS.md's Acid Bass Intelligence V4 authorization note).
 * This is the innermost layer of the V4 architecture: `$lib/acid-bass/*`
 * bridges *into* Acid Bass domain/performance data from here, never the
 * reverse -- so `BasslineStyleId`/`BassHarmonyMode`/`BassRegisterMode` are
 * canonically defined here and re-exported (not redefined) by
 * `$lib/acid-bass/types.ts`, which needs the same vocabulary for its
 * persisted `AcidBassGenerationSettings`.
 *
 * Two halves: *context* (§8's `BasslineGenerationContext` and friends --
 * everything the generator reads) and *result* (`GeneratedBassStep`/
 * `GeneratedBassBar`/`GeneratedBasslinePlan` -- what it produces). No
 * generation logic lives here yet (that starts at M4/rhythm.ts) -- this
 * milestone (M2) is the type skeleton plus `random.ts`'s deterministic PRNG
 * and `context.ts`'s wrap-aware bar-context helpers.
 */

import type { AbsoluteTuning } from '$lib/music/absolute-pitch';
import type { FretPosition } from '$lib/music/fretboard';
import type { HarmonicRole } from '$lib/music/harmony';
import type { IntervalId } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';

// ---------------------------------------------------------------------------
// Generation settings vocabulary
// ---------------------------------------------------------------------------

export type BasslineStyleId = 'rooted' | 'funk' | 'acid' | 'chromatic' | 'melodic' | 'walking';
export type BassHarmonyMode = 'chord' | 'key' | 'voice-leading';
export type BassRegisterMode = 'low' | 'mid' | 'high' | 'zone';

// ---------------------------------------------------------------------------
// Phrase / musical-function vocabulary
// ---------------------------------------------------------------------------

/** Adapted from Groove's own `PatternRole` (`A`/`B`/`F`/`T`) by the acid-bass bridge layer (`generation-context.ts`, M3) -- this module never imports `PatternRole`/Groove itself. */
export type BassPhraseRole = 'main' | 'variation' | 'fill' | 'turnaround';

export type BassNoteFunction =
	| 'root'
	| 'chord-tone'
	| 'scale-tone'
	| 'passing-tone'
	| 'chromatic-approach'
	| 'diatonic-approach'
	| 'enclosure-upper'
	| 'enclosure-lower'
	| 'voice-leading-target'
	| 'pedal'
	| 'anticipation';

// ---------------------------------------------------------------------------
// Context -- everything the generator reads (input)
// ---------------------------------------------------------------------------

export interface BasslineMeterContext {
	stepsPerBar: number;
	stepsPerBeatGroup: number;
	isCompound: boolean;
}

export interface BasslineChordContext {
	root: PitchClass;
	chordId: string;
	/** `null` means the chord's scale was explicitly cleared (the fretboard's own "—") -- chord tones and chord-family harmonic analysis stay legal, but scale-tone candidates are not; never silently substitute another scale. */
	scaleId: string | null;
}

export interface BasslineBarContext {
	barIndex: number;
	phraseRole: BassPhraseRole;
	chord: BasslineChordContext;
	/** Wrapped across the generation cycle -- see `context.ts`'s `buildBarContexts`. */
	previousChord: BasslineChordContext;
	nextChord: BasslineChordContext;
}

export interface BasslineGenerationContext {
	tonic: PitchClass;
	bars: BasslineBarContext[];
	meter: BasslineMeterContext;
	style: BasslineStyleId;
	harmonyMode: BassHarmonyMode;
	/** 0-100. */
	density: number;
	/** 0-100. */
	chromaticism: number;
	/** 0-100. */
	movement: number;
	register: BassRegisterMode;
	/** 0-100. */
	playability: number;
	zone: { minFret: number; maxFret: number };
	tuning: AbsoluteTuning;
	fretCount: number;
	/** Unsigned 32-bit -- see `random.ts`. The pure generator never calls `Math.random()`; this is its only source of variation. */
	seed: number;
}

// ---------------------------------------------------------------------------
// Result -- what the generator produces (output)
// ---------------------------------------------------------------------------

export interface BassNoteExplanation {
	headline: string;
	detail: string;
	role: HarmonicRole | null;
	function: BassNoteFunction;
	intervalFromChord: IntervalId;
	intervalFromKey: IntervalId;
	targetMidi?: number;
	targetInterval?: IntervalId;
}

/** An inactive rhythmic slot -- deliberately no fake MIDI/pitch-class/interval placeholder data, per spec §8's own preferred discriminated-union shape. */
export interface GeneratedBassRestStep {
	stepIndex: number;
	active: false;
}

export interface GeneratedBassNoteStep {
	stepIndex: number;
	active: true;
	/** Absolute sounding pitch -- audio uses this directly. */
	midi: number;
	pitchClass: PitchClass;
	intervalFromChord: IntervalId;
	intervalFromKey: IntervalId;
	function: BassNoteFunction;
	harmonicRole: HarmonicRole;
	accent: boolean;
	slide: boolean;
	/** 10-100, the same legal range the existing manual `AcidBassStep.gate` already uses. */
	gate: number;
	/** Generated V4 starts deterministic and intentional: no probability randomness and no ratchets unless a future explicit product request adds them to generated behavior (spec §8/§25.4). */
	probability: 100;
	ratchet: 1;
	preferredPosition: FretPosition | null;
	alternativePositions: FretPosition[];
	explanation: BassNoteExplanation;
}

export type GeneratedBassStep = GeneratedBassRestStep | GeneratedBassNoteStep;

export interface GeneratedBassBar {
	barIndex: number;
	phraseRole: BassPhraseRole;
	chord: BasslineChordContext;
	/** Always exactly `meter.stepsPerBar` entries -- inactive entries still exist so the plan maps 1:1 to transport steps. */
	steps: GeneratedBassStep[];
}

/** Derived on demand, never persisted (spec §7.7) -- only `AcidBassGenerationSettings` (`$lib/acid-bass/types.ts`) and its `seed` are saved. */
export interface GeneratedBasslinePlan {
	seed: number;
	style: BasslineStyleId;
	harmonyMode: BassHarmonyMode;
	bars: GeneratedBassBar[];
}
