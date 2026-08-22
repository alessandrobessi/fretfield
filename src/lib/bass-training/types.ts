/**
 * Learn This Line (Acid Bass Intelligence V4 §33) -- a dedicated Acid Bass
 * training session, evaluating pitch only. Not ordinary Scale Practice
 * grading, and not persisted (§33.2: "Session state is not persisted").
 *
 * Pure domain: no Svelte, no DOM, no audio, no Live Input coupling. `session.ts`
 * (M18) implements the state machine these types describe; wiring it to real
 * playback/Live Input is a later milestone (M19/M20).
 */

import type { GeneratedBassNoteStep } from '$lib/music/bassline/types';

export type BassTrainingPhase = 'idle' | 'listen' | 'ready' | 'waiting' | 'feedback' | 'complete';

export type BassAttemptResult = 'correct' | 'right-class-wrong-octave' | 'incorrect';

export interface BassTrainingAttempt {
	expectedMidi: number;
	playedMidi: number;
	result: BassAttemptResult;
}

/**
 * §33.1: initial V4 evaluates note pitch and sequence order only -- never
 * onset timing, duration, groove, dynamics, or exact physical fret/string
 * position. `targets` holds only the bar's *active* steps (a rest has no
 * pitch to evaluate) -- see `session.ts`'s `createBassTrainingSession`.
 */
export interface BassTrainingSession {
	phase: BassTrainingPhase;
	barIndex: number;
	targets: readonly GeneratedBassNoteStep[];
	targetIndex: number;
	attempts: readonly BassTrainingAttempt[];
}
