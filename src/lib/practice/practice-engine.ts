import type { DetectedNote } from '$lib/audio/types';
import type { IntervalId } from '$lib/music/intervals';
import type { VoiceLeadingPath } from '$lib/music/voice-leading-paths';
import { evaluateAttempt } from './evaluation';
import {
	createChordToneExercise,
	createIntervalExercise,
	createPathExercise,
	createResolutionExercise
} from './exercise-generators';
import type { RandomSource } from './presets';
import {
	createIdleSession,
	type PracticeAttempt,
	type PracticeContext,
	type PracticeExercise,
	type PracticeMode,
	type PracticeSession,
	type PracticeSettings
} from './types';

const MAX_RECENT_TARGET_KEYS = 3;

/** A stable identity for "what was just asked", so the next exercise avoids repeating it back-to-back (product spec §17's "simple recent-target exclusion"). */
function targetKey(exercise: PracticeExercise): string {
	switch (exercise.prompt.kind) {
		case 'find-interval':
		case 'find-chord-tone':
			return exercise.prompt.interval;
		case 'resolve-note':
			return `pitch:${exercise.prompt.currentPitchClass}`;
		case 'follow-path':
			return `step:${exercise.prompt.stepIndex}`;
	}
}

function generateExercise(
	mode: PracticeMode,
	context: PracticeContext,
	settings: PracticeSettings,
	path: VoiceLeadingPath | null,
	recentTargetKeys: readonly string[],
	random?: RandomSource,
	interval?: IntervalId
): PracticeExercise | null {
	const exclude = new Set(recentTargetKeys);
	const common = { random, exclude, thresholds: settings.thresholds, interval };
	switch (mode) {
		case 'find-interval':
			return createIntervalExercise(context, common);
		case 'find-chord-tone':
			return createChordToneExercise(context, common);
		case 'resolve-note':
			return createResolutionExercise(context, common);
		case 'follow-path':
			return path === null ? null : createPathExercise(context, path, { stepIndex: 0 });
	}
}

export interface StartSessionOptions {
	random?: RandomSource;
	/** Only relevant for `mode: 'follow-path'` — the already-selected, stable path to walk through. */
	path?: VoiceLeadingPath | null;
	/** Pins the generated exercise's target (Find Interval/Find Chord Tone) or starting note (Resolve Note) instead of picking one — useful for a future deep-link into a specific interval, and for deterministic tests. */
	interval?: IntervalId;
}

/** Begins a new session in `mode`, generating its first exercise from `context`. Returns an `idle` session (no exercise) if `context` can't support this mode yet — e.g. no root selected, or no path chosen for Follow Path. */
export function startSession(
	mode: PracticeMode,
	context: PracticeContext,
	settings: PracticeSettings,
	options: StartSessionOptions = {}
): PracticeSession {
	const base = createIdleSession(settings);
	const exercise = generateExercise(
		mode,
		context,
		settings,
		options.path ?? null,
		[],
		options.random,
		options.interval
	);

	if (exercise === null) {
		return { ...base, mode };
	}

	return {
		...base,
		mode,
		status: 'active',
		exerciseStatus: 'waiting-for-note',
		currentExercise: exercise,
		recentTargetKeys: [targetKey(exercise)]
	};
}

/**
 * Registers one played note as an attempt against the current exercise. A
 * note arriving while the session isn't actively waiting (idle, mid-feedback,
 * or between exercises) is recorded as `'ignored'` rather than silently
 * mutating state — callers should only invoke this once per onset (see
 * `liveInput.noteOnsetId`), never per raw audio frame.
 */
export function recordAttempt(session: PracticeSession, played: DetectedNote): PracticeSession {
	const exercise = session.currentExercise;
	if (
		session.status !== 'active' ||
		session.exerciseStatus !== 'waiting-for-note' ||
		exercise === null
	) {
		return { ...session, lastEvaluation: { result: 'ignored', played, positionAmbiguous: false } };
	}

	const evaluation = evaluateAttempt(exercise, played, session.settings.thresholds);
	const attempt: PracticeAttempt = {
		exerciseId: exercise.id,
		evaluation,
		timestampMs: played.timestampMs
	};

	return {
		...session,
		exerciseStatus: 'feedback',
		lastEvaluation: evaluation,
		attempts: [...session.attempts, attempt]
	};
}

export interface AdvanceOptions {
	random?: RandomSource;
	/** Only relevant for `mode: 'follow-path'`. */
	path?: VoiceLeadingPath | null;
}

function advanceFollowPath(
	session: PracticeSession,
	context: PracticeContext,
	path: VoiceLeadingPath | null
): PracticeSession {
	if (
		path === null ||
		session.currentExercise === null ||
		session.currentExercise.prompt.kind !== 'follow-path'
	) {
		return { ...session, status: 'idle', exerciseStatus: 'idle', currentExercise: null };
	}

	const succeeded =
		session.lastEvaluation?.result === 'exact' ||
		session.lastEvaluation?.result === 'strong-alternative';
	const currentStep = session.currentExercise.prompt.stepIndex;
	// A wrong attempt keeps the same step (product spec §4.D: never auto-skip
	// past a target the player hasn't actually reached).
	const nextStep = succeeded ? currentStep + 1 : currentStep;

	if (nextStep >= path.positions.length) {
		return {
			...session,
			status: 'completed',
			exerciseStatus: 'idle',
			currentExercise: null,
			lastEvaluation: null
		};
	}

	const exercise = createPathExercise(context, path, { stepIndex: nextStep });
	if (exercise === null) {
		return { ...session, status: 'idle', exerciseStatus: 'idle', currentExercise: null };
	}

	return {
		...session,
		status: 'active',
		exerciseStatus: 'waiting-for-note',
		currentExercise: exercise,
		lastEvaluation: null
	};
}

/**
 * Moves from `feedback` to the next exercise. For every mode except Follow
 * Path this is always a fresh, recent-target-excluded exercise. Follow Path
 * is the one mode where "next" depends on the *previous* result: a
 * successful attempt advances to the path's next step, an unsuccessful one
 * retries the same step — the selected path itself never changes underneath
 * the player mid-exercise (product spec §4.D).
 */
export function advanceToNextExercise(
	session: PracticeSession,
	context: PracticeContext,
	options: AdvanceOptions = {}
): PracticeSession {
	if (session.mode === 'follow-path') {
		return advanceFollowPath(session, context, options.path ?? null);
	}

	const exercise = generateExercise(
		session.mode,
		context,
		session.settings,
		null,
		session.recentTargetKeys,
		options.random
	);
	if (exercise === null) {
		return { ...session, status: 'idle', exerciseStatus: 'idle', currentExercise: null };
	}

	const recentTargetKeys = [targetKey(exercise), ...session.recentTargetKeys].slice(
		0,
		MAX_RECENT_TARGET_KEYS
	);

	return {
		...session,
		status: 'active',
		exerciseStatus: 'waiting-for-note',
		currentExercise: exercise,
		lastEvaluation: null,
		recentTargetKeys
	};
}

export function stopSession(settings: PracticeSettings): PracticeSession {
	return createIdleSession(settings);
}

export function updateSettings(
	session: PracticeSession,
	settings: Partial<PracticeSettings>
): PracticeSession {
	return { ...session, settings: { ...session.settings, ...settings } };
}

/**
 * Whether `exercise` was generated from a context still compatible with
 * `context` — root, chord, and the full progression sequence must match.
 * When this goes false (the user changed tonic or progression mid-exercise),
 * the caller should regenerate rather than silently keep evaluating against
 * a stale key (product spec §13).
 */
export function isContextCompatible(exercise: PracticeExercise, context: PracticeContext): boolean {
	if (exercise.context.chordId !== context.chordId) return false;
	if (exercise.context.root !== context.root) return false;
	if (exercise.context.progression.length !== context.progression.length) return false;
	for (let i = 0; i < exercise.context.progression.length; i++) {
		if (exercise.context.progression[i].root !== context.progression[i].root) return false;
		if (exercise.context.progression[i].chordId !== context.progression[i].chordId) return false;
	}
	return true;
}
