import type { DetectedNote } from '$lib/audio/types';
import type { FretPosition } from '$lib/music/fretboard';
import type { HarmonicRole } from '$lib/music/harmony';
import type { IntervalId } from '$lib/music/intervals';
import type { FretboardRegion } from '$lib/music/local-fields';
import type { PitchClass } from '$lib/music/pitch';
import type { ResolvedChord } from '$lib/music/progressions';
import type { Tuning } from '$lib/music/tuning';
import type { VoiceLeadingPath } from '$lib/music/voice-leading-paths';

export type PracticeMode = 'find-interval' | 'find-chord-tone' | 'resolve-note' | 'follow-path';

export type HintLevel = 'hidden' | 'interval' | 'positions';

/** Whether a target can be satisfied by pitch class alone, or requires the exact fret position (only meaningful under an active, region-constrained Local Field). */
export type PositionRequirement = 'pitch-only' | 'physical-position';

/**
 * Structured, never a pre-rendered string — the same principle the rest of
 * the engine follows (AGENTS.md §5). UI derives display text from these
 * fields via the existing label helpers (`intervalCompoundLabel`,
 * `noteNameForPosition`, `roleCharacter`), never from a stored sentence.
 */
export type PracticePrompt =
	| { kind: 'find-interval'; root: PitchClass; chordId: string; interval: IntervalId }
	| { kind: 'find-chord-tone'; root: PitchClass; chordId: string; interval: IntervalId }
	| {
			kind: 'resolve-note';
			fromRoot: PitchClass;
			fromChordId: string;
			toRoot: PitchClass;
			toChordId: string;
			currentPitchClass: PitchClass;
	  }
	| {
			kind: 'follow-path';
			root: PitchClass;
			chordId: string;
			stepIndex: number;
			totalSteps: number;
	  };

export type PracticeTargetRank = 'exact' | 'strong-alternative' | 'valid-alternative';

export interface PracticeTarget {
	id: string;
	pitchClass: PitchClass;
	interval: IntervalId | null;
	role: HarmonicRole | null;
	rank: PracticeTargetRank;
	positionRequirement: PositionRequirement;
	/** Every fret on the neck that produces this pitch class (region-filtered when `positionRequirement` is `physical-position`). */
	positions: FretPosition[];
}

/**
 * Everything a generator needs, gathered from the *existing* engine state
 * (root/chord/progression/path/region selection) — plain data only, no
 * dependency on any Svelte store, so generators stay pure and testable.
 */
export interface PracticeContext {
	tuning: Tuning;
	fretCount: number;
	root: PitchClass | null;
	chordId: string;
	progression: ResolvedChord[];
	activeChordIndex: number;
	selectedPath: VoiceLeadingPath | null;
	region: FretboardRegion | null;
	localFieldOnly: boolean;
}

export interface PracticeExercise {
	id: string;
	mode: PracticeMode;
	prompt: PracticePrompt;
	context: PracticeContext;
	/** The primary, "asked-for" target(s) — usually exactly one. */
	targets: PracticeTarget[];
	/** Musically valid but not what was specifically asked for; ranked strong/valid. */
	alternatives: PracticeTarget[];
}

export interface PracticeExplanation {
	pitchClass: PitchClass;
	interval: IntervalId | null;
	role: HarmonicRole | null;
	roleDescription: string | null;
}

export type PracticeResult =
	'exact' | 'strong-alternative' | 'valid-alternative' | 'incorrect' | 'ignored';

export interface PracticeEvaluation {
	result: PracticeResult;
	played: DetectedNote;
	matchedTarget?: PracticeTarget;
	/** True when the physical position couldn't be proven from audio alone — never used to reject an otherwise-correct pitch. */
	positionAmbiguous: boolean;
	explanation?: PracticeExplanation;
}

export interface PracticeEvaluationThresholds {
	strongAlternative: number;
	validAlternative: number;
}

export const DEFAULT_PRACTICE_THRESHOLDS: PracticeEvaluationThresholds = {
	strongAlternative: 0.6,
	validAlternative: 0.35
};

export interface PracticeSettings {
	hintLevel: HintLevel;
	localFieldOnly: boolean;
	thresholds: PracticeEvaluationThresholds;
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
	hintLevel: 'positions',
	localFieldOnly: false,
	thresholds: DEFAULT_PRACTICE_THRESHOLDS
};

export interface PracticeAttempt {
	exerciseId: string;
	evaluation: PracticeEvaluation;
	timestampMs: number;
}

/** Mirrors the DetectedNote → evaluation pipeline (product spec §7), independent of any specific mode. */
export type PracticeExerciseStatus =
	'idle' | 'prompting' | 'waiting-for-note' | 'evaluating' | 'feedback';

export interface PracticeStats {
	attempts: number;
	correct: number;
	strongAlternatives: number;
	exercisesCompleted: number;
}

export function computePracticeStats(attempts: readonly PracticeAttempt[]): PracticeStats {
	let correct = 0;
	let strongAlternatives = 0;
	let exercisesCompleted = 0;
	const seenExercises = new Set<string>();

	for (const attempt of attempts) {
		if (attempt.evaluation.result === 'exact') correct += 1;
		if (attempt.evaluation.result === 'strong-alternative') strongAlternatives += 1;
		if (
			(attempt.evaluation.result === 'exact' ||
				attempt.evaluation.result === 'strong-alternative') &&
			!seenExercises.has(attempt.exerciseId)
		) {
			seenExercises.add(attempt.exerciseId);
			exercisesCompleted += 1;
		}
	}

	return { attempts: attempts.length, correct, strongAlternatives, exercisesCompleted };
}

export interface PracticeSession {
	mode: PracticeMode;
	status: 'idle' | 'active' | 'completed';
	exerciseStatus: PracticeExerciseStatus;
	currentExercise: PracticeExercise | null;
	lastEvaluation: PracticeEvaluation | null;
	attempts: PracticeAttempt[];
	settings: PracticeSettings;
	/** Small rolling history of recently-used target keys, so sequential practice doesn't repeat the same target back to back. */
	recentTargetKeys: string[];
}

export function createIdleSession(
	settings: PracticeSettings = DEFAULT_PRACTICE_SETTINGS
): PracticeSession {
	return {
		mode: 'find-interval',
		status: 'idle',
		exerciseStatus: 'idle',
		currentExercise: null,
		lastEvaluation: null,
		attempts: [],
		settings,
		recentTargetKeys: []
	};
}
