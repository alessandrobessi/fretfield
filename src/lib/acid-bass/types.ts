/**
 * The Acid Bass voice's own data model -- plain data, no functions, no class
 * instances, round-trips through JSON unchanged (nested inside `Groove`, see
 * `groove/types.ts`). A monophonic 303-inspired synth bass living inside the
 * Groove Engine, reusing the same A/B/F/T pattern roles the drum patterns
 * use -- there is no independent bass arrangement.
 *
 * Deliberately imports `PatternRole` from `groove/pattern-role` (a leaf
 * module with no dependencies of its own), never from `groove/types` --
 * `groove/types.ts` imports `AcidBassState` from *this* file to nest it
 * inside `Groove`, so importing back from `groove/types` here would create a
 * cycle.
 */

import type { IntervalId } from '$lib/music/intervals';

import type { PatternRole } from '$lib/groove/pattern-role';

export type AcidWave = 'saw' | 'square';

export type AcidOctaveOffset = -1 | 0 | 1;

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
	/** Glides from this step into the immediately following step if (and only if) that step is active -- no glide across rests, no cross-bar glide in v1. */
	slide: boolean;
}

export type AcidBassPattern = AcidBassStep[];

/**
 * Six musical macro controls, each a plain 0-100 UI-facing range mapped to
 * DSP parameters in `resolve.ts` -- deliberately not a literal 303 panel
 * (see AGENTS.md's Acid Bass doctrine once written): no pulse width, no
 * oscillator tuning, no per-step filter locks.
 */
export interface AcidBassPatch {
	wave: AcidWave;
	/** 0-100: base filter cutoff, dark/round to bright/open. */
	tone: number;
	/** 0-100: filter Q, broad/round to narrow/squelchy. */
	resonance: number;
	/** 0-100: how much each note's envelope opens the filter above the Tone base. */
	motion: number;
	/** 0-100: filter-envelope/amplitude decay, short/percussive to long/connected. */
	decay: number;
	/** 0-100: post-voice saturation amount. */
	drive: number;
}

export interface AcidBassState {
	/** Off by default, including for every migrated pre-Acid-Bass groove -- turning it on/off affects only this voice, never drums, chord backing, transport, or fretboard highlighting. */
	enabled: boolean;
	patch: AcidBassPatch;
	patterns: Record<PatternRole, AcidBassPattern>;
}
