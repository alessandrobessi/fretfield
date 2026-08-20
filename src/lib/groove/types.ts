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
	 * 0-100: the global Intensity control (not yet wired up) must be at
	 * least this high for the step to sound. `undefined` behaves as 0 --
	 * always plays -- so every step authored before Intensity existed keeps
	 * sounding unconditionally.
	 */
	minIntensity?: number;
}

export interface GroovePattern {
	steps: Record<DrumVoice, GrooveStep[]>;
}

/** Main groove, variation, fill, turnaround -- see AGENTS.md for why these four cover the practice use cases this app targets. */
export type PatternRole = 'A' | 'B' | 'F' | 'T';

export const PATTERN_ROLES: readonly PatternRole[] = ['A', 'B', 'F', 'T'];

export interface Groove {
	patterns: Record<PatternRole, GroovePattern>;
	/** Ordered bar -> pattern-role list; its length is the loop's length in bars (1 for a plain one-bar groove, 12 for the flagship blues form). */
	arrangement: PatternRole[];
	/** 0-100: 0 is straight sixteenths, 100 is a full triplet/shuffle feel. */
	swing: number;
}
