/**
 * The Groove Engine's core data model — plain data (no functions, no class
 * instances) so a `Groove` round-trips through JSON unchanged for the Saved
 * Material Library (saved-grooves.svelte.ts), same as the old single-pattern
 * `GroovePattern` model did before it (see `migrate.ts`). A `Groove` holds up
 * to four reusable 16-step patterns (roles `A`/`B`/`F`/`T` —
 * main/variation/fill/turnaround, see AGENTS.md) and an arrangement that
 * assigns one role to each bar of a loop, so a 12-bar form plays back
 * without needing twelve separate hand-authored patterns.
 */

import type { AcidBassState } from '$lib/acid-bass/types';
import type { ChordPadFxState } from '$lib/chord-pad-fx/types';

import type { PatternRole } from './pattern-role';
import type { TimeSignature } from './time-signature';

export type { TimeSignature } from './time-signature';
export { PATTERN_ROLES, type PatternRole } from './pattern-role';

/** The six-voice kit recommended by AGENTS.md -- enough for funk/blues/jazz/soul/rock/bossa without a full General-MIDI-style drum palette. */
export type DrumVoice = 'kick' | 'snare' | 'closedHat' | 'openHat' | 'ride' | 'rim';

export const DRUM_VOICES: readonly DrumVoice[] = [
	'kick',
	'snare',
	'closedHat',
	'openHat',
	'ride',
	'rim'
];

export const STEPS_PER_BAR = 16;

/** 0 = off, 0.35 = ghost, 0.7 = normal, 1 = accent -- cycled off->ghost->normal->accent->off by clicking a step, or set directly (Shift-click = accent, Alt/Option-click = off). */
export type StepVelocity = 0 | 0.35 | 0.7 | 1;

export interface GrooveStep {
	velocity: StepVelocity;
	/**
	 * 0-100: the global Intensity control must be at least this high for the
	 * step to sound (see `groove/intensity.ts`). `undefined` behaves as 0 --
	 * always plays -- so every step authored before Intensity existed keeps
	 * sounding unconditionally.
	 */
	minIntensity?: number;
}

export interface GroovePattern {
	steps: Record<DrumVoice, GrooveStep[]>;
}

/** Straight = no swing, ever. Shuffle/Swing both delay the "and" of each beat by `feelAmount` (see `groove/feel.ts`) -- kept as separate labels since they read as different musical intents even though the underlying timing math is identical. */
export type GrooveFeel = 'straight' | 'shuffle' | 'swing';

export interface Groove {
	patterns: Record<PatternRole, GroovePattern>;
	/** Ordered bar -> pattern-role list; its length is the loop's length in bars (1 for a plain one-bar groove, 12 for the flagship blues form). */
	arrangement: PatternRole[];
	feel: GrooveFeel;
	/** 0-100, meaningful only when `feel !== 'straight'`: 0 is a straight halfway split, 100 is a full triplet feel. */
	feelAmount: number;
	/** One meter for the whole groove -- every pattern's step count derives from this (see `groove/time-signature.ts`). No per-bar/mixed-meter concept. */
	timeSignature: TimeSignature;
	/** The Acid Bass voice's own A/B/F/T patterns, sharing this groove's arrangement/pattern-role selection -- there is no independent bass arrangement (see `acid-bass/types.ts`). */
	acidBass: AcidBassState;
	/** The chord-backing pad's own FX rack (Reverb/Delay/Chorus, stage 1 of 2 -- see `chord-pad-fx/types.ts`) -- a wholly separate accompaniment layer from Acid Bass, with no pattern/arrangement concept of its own. */
	chordPadFx: ChordPadFxState;
}
