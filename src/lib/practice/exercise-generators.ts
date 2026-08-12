import type { ResolutionTarget } from '$lib/music/connection-score';
import { getChordDefinition } from '$lib/music/chords';
import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import { analyzeInterval, roleStability } from '$lib/music/harmony';
import {
	ALL_INTERVALS,
	type IntervalId,
	intervalFromRoot,
	transposeByInterval
} from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';
import type { ResolvedChord } from '$lib/music/progressions';
import { analyzeTransition, connectionFor } from '$lib/music/voice-leading';
import type { VoiceLeadingPath } from '$lib/music/voice-leading-paths';
import {
	DEFAULT_INTERVAL_PRACTICE_POOL,
	type RandomSource,
	defaultRandomSource,
	pickExcluding
} from './presets';
import {
	DEFAULT_PRACTICE_THRESHOLDS,
	type PositionRequirement,
	type PracticeContext,
	type PracticeEvaluationThresholds,
	type PracticeExercise,
	type PracticeTarget,
	type PracticeTargetRank
} from './types';

interface CommonGeneratorOptions {
	random?: RandomSource;
	exclude?: ReadonlySet<string>;
	thresholds?: PracticeEvaluationThresholds;
}

export interface CreateIntervalExerciseOptions extends CommonGeneratorOptions {
	interval?: IntervalId;
	pool?: readonly IntervalId[];
}

export interface CreateChordToneExerciseOptions extends CommonGeneratorOptions {
	interval?: IntervalId;
	pool?: readonly IntervalId[];
}

export interface CreateResolutionExerciseOptions extends CommonGeneratorOptions {
	interval?: IntervalId;
	pool?: readonly IntervalId[];
}

export interface CreatePathExerciseOptions {
	stepIndex?: number;
}

/** Every fret producing `pitchClass`, region-constrained (and marked position-significant) only when Local-Field-only practice is on and a region is active. */
function resolveTargetPositions(
	context: PracticeContext,
	pitchClass: PitchClass
): { positions: FretPosition[]; positionRequirement: PositionRequirement } {
	const all = createFretboard(context.tuning, context.fretCount).filter(
		(p) => p.pitchClass === pitchClass
	);
	if (context.localFieldOnly && context.region !== null) {
		const region = context.region;
		const constrained = all.filter((p) => p.fret >= region.minFret && p.fret <= region.maxFret);
		// Never present an unplayable exercise: if this particular pitch class
		// happens not to occur inside the region, fall back to the full neck
		// rather than an empty target.
		if (constrained.length > 0) {
			return { positions: constrained, positionRequirement: 'physical-position' };
		}
	}
	return { positions: all, positionRequirement: 'pitch-only' };
}

function rankFor(
	score: number,
	thresholds: PracticeEvaluationThresholds
): PracticeTargetRank | null {
	if (score >= thresholds.strongAlternative) return 'strong-alternative';
	if (score >= thresholds.validAlternative) return 'valid-alternative';
	return null;
}

/**
 * Every other reasonably-good tone of the *same* chord as a musically valid
 * (if unrequested) answer — reuses `roleStability`, the engine's existing
 * 0-1 stability score per role, rather than a second scoring model.
 */
function buildRoleBasedAlternatives(
	context: PracticeContext,
	root: PitchClass,
	chordId: string,
	excludeInterval: IntervalId,
	thresholds: PracticeEvaluationThresholds
): PracticeTarget[] {
	const chordDef = getChordDefinition(chordId);
	const alternatives: PracticeTarget[] = [];

	for (const interval of ALL_INTERVALS) {
		if (interval === excludeInterval) continue;
		const role = analyzeInterval(chordDef, interval);
		const rank = rankFor(roleStability(role), thresholds);
		if (rank === null) continue;

		const pitchClass = transposeByInterval(root, interval);
		const { positions, positionRequirement } = resolveTargetPositions(context, pitchClass);
		alternatives.push({
			id: `alt:${interval}`,
			pitchClass,
			interval,
			role,
			rank,
			positionRequirement,
			positions
		});
	}

	return alternatives;
}

function createSingleTargetExercise(
	mode: 'find-interval' | 'find-chord-tone',
	context: PracticeContext,
	pool: readonly IntervalId[],
	options: CommonGeneratorOptions & { interval?: IntervalId }
): PracticeExercise | null {
	if (context.root === null || pool.length === 0) return null;

	const random = options.random ?? defaultRandomSource;
	const interval =
		options.interval ?? pickExcluding(pool, options.exclude ?? new Set(), (i) => i, random);

	const chordDef = getChordDefinition(context.chordId);
	const role = analyzeInterval(chordDef, interval);
	const targetPitchClass = transposeByInterval(context.root, interval);
	const { positions, positionRequirement } = resolveTargetPositions(context, targetPitchClass);

	const target: PracticeTarget = {
		id: `${mode}:${interval}`,
		pitchClass: targetPitchClass,
		interval,
		role,
		rank: 'exact',
		positionRequirement,
		positions
	};

	const thresholds = options.thresholds ?? DEFAULT_PRACTICE_THRESHOLDS;
	const alternatives = buildRoleBasedAlternatives(
		context,
		context.root,
		context.chordId,
		interval,
		thresholds
	);

	return {
		id: `${mode}:${interval}`,
		mode,
		prompt: { kind: mode, root: context.root, chordId: context.chordId, interval },
		context,
		targets: [target],
		alternatives
	};
}

/** "What can I play now?" made into a task: locate one specific interval relative to the selected root. Chord-agnostic — the target depends only on the root. */
export function createIntervalExercise(
	context: PracticeContext,
	options: CreateIntervalExerciseOptions = {}
): PracticeExercise | null {
	const pool = options.pool ?? DEFAULT_INTERVAL_PRACTICE_POOL;
	return createSingleTargetExercise('find-interval', context, pool, options);
}

/** Locate one of the *current chord's* own required tones (its 3rd, its b7, ...) — reuses the exact same chord formulas Chord Field already renders. */
export function createChordToneExercise(
	context: PracticeContext,
	options: CreateChordToneExerciseOptions = {}
): PracticeExercise | null {
	if (context.root === null) return null;
	const chordDef = getChordDefinition(context.chordId);
	const pool = options.pool ?? chordDef.required.filter((interval) => interval !== '1');
	return createSingleTargetExercise('find-chord-tone', context, pool, options);
}

function resolutionTargetToPractice(
	resolution: ResolutionTarget,
	rank: PracticeTargetRank,
	context: PracticeContext,
	toChord: ResolvedChord
): PracticeTarget {
	const role = analyzeInterval(getChordDefinition(toChord.chordId), resolution.targetInterval);
	const { positions, positionRequirement } = resolveTargetPositions(
		context,
		resolution.targetPitchClass
	);
	return {
		id: `resolve-note-target:${resolution.targetPitchClass}`,
		pitchClass: resolution.targetPitchClass,
		interval: resolution.targetInterval,
		role,
		rank,
		positionRequirement,
		positions
	};
}

/**
 * "Given what you are playing now, can you find a strong resolution into the
 * next chord?" The "given" note is one of the *current* chord's own tones
 * (picked deterministically/randomly, never hardcoded); its resolution
 * targets come entirely from `analyzeTransition`/`connectionFor` — the same
 * engine Progression Field already uses. This is what makes G7→Cmaj7's
 * F→E and B→C emerge from interval math rather than a lookup table.
 */
export function createResolutionExercise(
	context: PracticeContext,
	options: CreateResolutionExerciseOptions = {}
): PracticeExercise | null {
	if (context.progression.length < 2) return null;

	const fromIndex = context.activeChordIndex;
	const toIndex = (fromIndex + 1) % context.progression.length;
	const fromChord = context.progression[fromIndex];
	const toChord = context.progression[toIndex];

	const fromChordDef = getChordDefinition(fromChord.chordId);
	const pool = options.pool ?? fromChordDef.required;
	if (pool.length === 0) return null;

	const random = options.random ?? defaultRandomSource;
	const currentInterval =
		options.interval ?? pickExcluding(pool, options.exclude ?? new Set(), (i) => i, random);
	const currentPitchClass = transposeByInterval(fromChord.root, currentInterval);

	const transition = analyzeTransition(fromChord, toChord);
	const connection = connectionFor(transition, currentPitchClass);
	if (connection.targets.length === 0) return null;

	const thresholds = options.thresholds ?? DEFAULT_PRACTICE_THRESHOLDS;
	const [primary, ...rest] = connection.targets;

	const targets = [resolutionTargetToPractice(primary, 'exact', context, toChord)];
	const alternatives = rest
		.map((resolution) => ({ resolution, rank: rankFor(resolution.harmonicStrength, thresholds) }))
		.filter(
			(entry): entry is { resolution: ResolutionTarget; rank: PracticeTargetRank } =>
				entry.rank !== null
		)
		.map(({ resolution, rank }) => resolutionTargetToPractice(resolution, rank, context, toChord));

	return {
		id: `resolve-note:${fromIndex}:${currentPitchClass}`,
		mode: 'resolve-note',
		prompt: {
			kind: 'resolve-note',
			fromRoot: fromChord.root,
			fromChordId: fromChord.chordId,
			toRoot: toChord.root,
			toChordId: toChord.chordId,
			currentPitchClass
		},
		context,
		targets,
		alternatives
	};
}

/**
 * Presents one step of an *already-selected* Voice-Leading Path. Deliberately
 * takes `path` as an explicit argument rather than reading it from context —
 * the caller (the practice store, advancing through a session) is
 * responsible for reusing the exact same path reference for every step, so
 * the path's identity never changes mid-exercise (product spec §4.D).
 */
export function createPathExercise(
	context: PracticeContext,
	path: VoiceLeadingPath,
	options: CreatePathExerciseOptions = {}
): PracticeExercise | null {
	const stepIndex = options.stepIndex ?? 0;
	if (stepIndex < 0 || stepIndex >= path.positions.length) return null;
	if (context.progression.length !== path.positions.length) return null;

	const chord = context.progression[stepIndex];
	const stepPosition = path.positions[stepIndex];
	const interval = intervalFromRoot(chord.root, stepPosition.pitchClass);
	const role = analyzeInterval(getChordDefinition(chord.chordId), interval);
	const { positions, positionRequirement } = resolveTargetPositions(
		context,
		stepPosition.pitchClass
	);

	const target: PracticeTarget = {
		id: `follow-path:${stepIndex}:${stepPosition.pitchClass}`,
		pitchClass: stepPosition.pitchClass,
		interval,
		role,
		rank: 'exact',
		positionRequirement,
		positions
	};

	return {
		id: `follow-path:${stepIndex}:${stepPosition.pitchClass}`,
		mode: 'follow-path',
		prompt: {
			kind: 'follow-path',
			root: chord.root,
			chordId: chord.chordId,
			stepIndex,
			totalSteps: path.positions.length
		},
		context,
		targets: [target],
		alternatives: []
	};
}
