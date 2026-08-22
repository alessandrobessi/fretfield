/**
 * Learn This Line's pure state machine (Acid Bass Intelligence V4 §33.2/
 * §33.5) -- session creation, phase transitions, attempt recording, target
 * advance, completion. No Svelte, no DOM, no audio, no Live Input coupling
 * (wiring this to real playback/Live Input is M19/M20); every function here
 * takes a session and returns a new one, the same immutable-update idiom
 * `acid-bass/pattern.ts`/`acid-bass/sequencer.ts` already use.
 *
 * Phase flow:
 *
 * ```text
 * idle -> listen -> ready -> waiting -> feedback -> waiting   (incorrect/wrong-octave: same target)
 *                                     -> feedback -> waiting   (correct, more targets remain)
 *                                     -> feedback -> complete  (correct, last target)
 * ```
 *
 * Every transition function guards its own required starting phase and is a
 * silent no-op otherwise (returns `session` unchanged) -- a caller that
 * calls things out of order gets an inert result, never a thrown exception
 * or corrupted state, the same defensive style `resolveStepLocks`/
 * `stepShouldTrigger` already use elsewhere in this codebase.
 */

import type { GeneratedBassBar } from '$lib/music/bassline/types';

import { evaluateBassAttempt } from './evaluate';
import type { BassTrainingSession } from './types';

/**
 * Builds a fresh, `'idle'`-phase session from one generated bar -- `targets`
 * is the bar's own active steps only (a rest has no pitch to evaluate, see
 * `BassTrainingSession`'s own doc comment). §33's "first Learn This Line
 * implementation trains one generated bar at a time," so there is
 * deliberately no multi-bar session shape here.
 */
export function createBassTrainingSession(bar: GeneratedBassBar): BassTrainingSession {
	return {
		phase: 'idle',
		barIndex: bar.barIndex,
		targets: bar.steps.filter((step) => step.active),
		targetIndex: 0,
		attempts: []
	};
}

/** `idle -> listen`. A no-op (stays `idle`) if the session has no targets at all -- there is nothing to listen for or wait on. */
export function startListening(session: BassTrainingSession): BassTrainingSession {
	if (session.phase !== 'idle' || session.targets.length === 0) return session;
	return { ...session, phase: 'listen' };
}

/** `listen -> ready`, once the one-shot listen playback (M19) finishes. */
export function finishListening(session: BassTrainingSession): BassTrainingSession {
	if (session.phase !== 'listen') return session;
	return { ...session, phase: 'ready' };
}

/** `ready -> waiting` -- the player is now expected to play the current target. */
export function beginWaitingForNote(session: BassTrainingSession): BassTrainingSession {
	if (session.phase !== 'ready') return session;
	return { ...session, phase: 'waiting' };
}

/**
 * `waiting -> feedback`. Evaluates `playedMidi` against the current target's
 * own `midi` (§33.4's `evaluateBassAttempt`) and appends the resulting
 * attempt -- never mutates `targetIndex` here; that only ever happens in
 * `advanceAfterFeedback`, so a caller gets one distinct "show feedback for
 * this attempt" state before anything about the target changes (matches
 * §33's own numbered workflow: "8. feedback; 9. advance").
 */
export function recordAttempt(
	session: BassTrainingSession,
	playedMidi: number
): BassTrainingSession {
	if (session.phase !== 'waiting') return session;
	const target = session.targets[session.targetIndex];
	const result = evaluateBassAttempt(target.midi, playedMidi);
	return {
		...session,
		phase: 'feedback',
		attempts: [...session.attempts, { expectedMidi: target.midi, playedMidi, result }]
	};
}

/**
 * `feedback -> waiting` or `feedback -> complete`. §33.5: only a `'correct'`
 * attempt advances -- `'right-class-wrong-octave'` and `'incorrect'` both
 * "remain on current target, let the player try again" (the octave-vs-class
 * distinction is for feedback wording only, not for whether the game
 * advances). Advancing past the last target completes the session.
 */
export function advanceAfterFeedback(session: BassTrainingSession): BassTrainingSession {
	if (session.phase !== 'feedback') return session;
	const lastAttempt = session.attempts[session.attempts.length - 1];
	if (lastAttempt.result !== 'correct') {
		return { ...session, phase: 'waiting' };
	}
	const nextIndex = session.targetIndex + 1;
	if (nextIndex >= session.targets.length) {
		return { ...session, phase: 'complete', targetIndex: nextIndex };
	}
	return { ...session, phase: 'waiting', targetIndex: nextIndex };
}

/** §33.5: "Correct attempts / total attempts" -- a compact completion summary, deliberately not persisted or accumulated across sessions ("do not build long-term statistics"). */
export function summarizeBassTrainingSession(session: BassTrainingSession): {
	correct: number;
	total: number;
} {
	return {
		correct: session.attempts.filter((attempt) => attempt.result === 'correct').length,
		total: session.attempts.length
	};
}
