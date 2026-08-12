import type { DetectedNote } from '$lib/audio/types';
import {
	STANDARD_4_STRING_ABSOLUTE_TUNING,
	findFretPositionsForMidi
} from '$lib/music/absolute-pitch';
import { getChordDefinition } from '$lib/music/chords';
import { DEFAULT_CONNECTION_WEIGHTS, scoreConnectionTo } from '$lib/music/connection-score';
import type { FretPosition } from '$lib/music/fretboard';
import { analyzeInterval, roleCharacter } from '$lib/music/harmony';
import { intervalFromRoot } from '$lib/music/intervals';
import { inferLivePosition } from '$lib/music/live-position';
import type { ResolvedChord } from '$lib/music/progressions';
import {
	DEFAULT_PRACTICE_THRESHOLDS,
	type PracticeContext,
	type PracticeEvaluation,
	type PracticeEvaluationThresholds,
	type PracticeExercise,
	type PracticeExplanation,
	type PracticeTarget
} from './types';

/**
 * Whether a physical-position-constrained target is satisfied by the note
 * actually played. Never rejects an otherwise-correct pitch solely because
 * the exact string/fret can't be proven from audio (product spec §6) —
 * reuses the same `inferLivePosition` priority system Live Input already
 * uses, rather than inventing separate confidence math.
 */
function checkPositionConstraint(
	target: PracticeTarget,
	candidates: FretPosition[],
	context: PracticeContext
): { satisfied: boolean; ambiguous: boolean } {
	if (target.positionRequirement === 'pitch-only') {
		return { satisfied: true, ambiguous: false };
	}

	const isAllowed = (position: FretPosition): boolean =>
		target.positions.some(
			(p) => p.stringIndex === position.stringIndex && p.fret === position.fret
		);

	if (candidates.length === 0) return { satisfied: true, ambiguous: true };
	if (candidates.length === 1) return { satisfied: isAllowed(candidates[0]), ambiguous: false };

	const inference = inferLivePosition(candidates, {
		voiceLeadingPathPosition: context.selectedPath?.positions[context.activeChordIndex] ?? null,
		localFieldRegion: context.region
	});
	if (inference.likelyPosition !== null) {
		return { satisfied: isAllowed(inference.likelyPosition), ambiguous: false };
	}
	return { satisfied: candidates.some(isAllowed), ambiguous: true };
}

function explainTarget(target: PracticeTarget): PracticeExplanation {
	return {
		pitchClass: target.pitchClass,
		interval: target.interval,
		role: target.role,
		roleDescription: target.role ? roleCharacter(target.role) : null
	};
}

/** The chord this exercise's played note should be explained against — the chord being resolved *into* for Resolve Note, since that's what the evaluation is about. */
function activeChordFor(exercise: PracticeExercise): ResolvedChord {
	const prompt = exercise.prompt;
	switch (prompt.kind) {
		case 'find-interval':
		case 'find-chord-tone':
		case 'follow-path':
			return { root: prompt.root, chordId: prompt.chordId };
		case 'resolve-note':
			return { root: prompt.toRoot, chordId: prompt.toChordId };
	}
}

function explainPlayedPitch(exercise: PracticeExercise, played: DetectedNote): PracticeExplanation {
	const chord = activeChordFor(exercise);
	const interval = intervalFromRoot(chord.root, played.pitchClass);
	const role = analyzeInterval(getChordDefinition(chord.chordId), interval);
	return { pitchClass: played.pitchClass, interval, role, roleDescription: roleCharacter(role) };
}

function findTarget(
	targets: PracticeTarget[],
	pitchClass: DetectedNote['pitchClass']
): PracticeTarget | undefined {
	return targets.find((target) => target.pitchClass === pitchClass);
}

/**
 * A landing note for Resolve Note that isn't one of the next chord's
 * *required* tones (e.g. a legitimate extension) still deserves credit if
 * the existing connection engine scores it well — reusing `scoreConnectionTo`
 * exactly as voice-leading path search already does, never a second lookup.
 */
function resolveNoteFallback(
	exercise: PracticeExercise,
	played: DetectedNote,
	thresholds: PracticeEvaluationThresholds
): PracticeEvaluation | null {
	if (exercise.prompt.kind !== 'resolve-note') return null;
	const { fromRoot, fromChordId, toRoot, toChordId, currentPitchClass } = exercise.prompt;
	const fromChord: ResolvedChord = { root: fromRoot, chordId: fromChordId };
	const toChord: ResolvedChord = { root: toRoot, chordId: toChordId };

	const score = scoreConnectionTo(
		currentPitchClass,
		fromChord,
		toChord,
		played.pitchClass,
		DEFAULT_CONNECTION_WEIGHTS
	);
	if (score < thresholds.validAlternative) return null;

	const candidates = findFretPositionsForMidi(
		STANDARD_4_STRING_ABSOLUTE_TUNING,
		exercise.context.fretCount,
		played.midi
	);
	const interval = intervalFromRoot(toRoot, played.pitchClass);
	const role = analyzeInterval(getChordDefinition(toChordId), interval);
	const target: PracticeTarget = {
		id: `${exercise.id}:fallback:${played.pitchClass}`,
		pitchClass: played.pitchClass,
		interval,
		role,
		rank: score >= thresholds.strongAlternative ? 'strong-alternative' : 'valid-alternative',
		positionRequirement: 'pitch-only',
		positions: []
	};
	const { ambiguous } = checkPositionConstraint(target, candidates, exercise.context);

	return {
		result: target.rank,
		played,
		matchedTarget: target,
		positionAmbiguous: ambiguous,
		explanation: explainTarget(target)
	};
}

/**
 * Centralized evaluation for every practice mode — the only place a played
 * note is compared against an exercise's targets. Never duplicates theory:
 * a target's interval/role were already computed by the generator using the
 * existing engine, and the Resolve Note fallback reuses `scoreConnectionTo`
 * directly rather than a parallel scoring table.
 */
export function evaluateAttempt(
	exercise: PracticeExercise,
	played: DetectedNote,
	thresholds: PracticeEvaluationThresholds = DEFAULT_PRACTICE_THRESHOLDS
): PracticeEvaluation {
	const candidates = findFretPositionsForMidi(
		STANDARD_4_STRING_ABSOLUTE_TUNING,
		exercise.context.fretCount,
		played.midi
	);

	const exactMatch = findTarget(exercise.targets, played.pitchClass);
	if (exactMatch) {
		const { satisfied, ambiguous } = checkPositionConstraint(
			exactMatch,
			candidates,
			exercise.context
		);
		return {
			result: satisfied ? 'exact' : 'incorrect',
			played,
			matchedTarget: exactMatch,
			positionAmbiguous: ambiguous,
			explanation: explainTarget(exactMatch)
		};
	}

	const altMatch = findTarget(exercise.alternatives, played.pitchClass);
	if (altMatch) {
		const { satisfied, ambiguous } = checkPositionConstraint(
			altMatch,
			candidates,
			exercise.context
		);
		return {
			result: satisfied
				? (altMatch.rank as 'strong-alternative' | 'valid-alternative')
				: 'incorrect',
			played,
			matchedTarget: altMatch,
			positionAmbiguous: ambiguous,
			explanation: explainTarget(altMatch)
		};
	}

	const fallback = resolveNoteFallback(exercise, played, thresholds);
	if (fallback) return fallback;

	return {
		result: 'incorrect',
		played,
		positionAmbiguous: false,
		explanation: explainPlayedPitch(exercise, played)
	};
}
