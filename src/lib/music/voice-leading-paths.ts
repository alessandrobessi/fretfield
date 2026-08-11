import {
	type ConnectionWeights,
	DEFAULT_CONNECTION_WEIGHTS,
	scoreConnectionTo
} from './connection-score';
import { getChordDefinition } from './chords';
import type { FretPosition } from './fretboard';
import { type AnalyzedFretPosition, analyzeFretboard } from './harmony';
import type { FretboardRegion } from './local-fields';
import type { ResolvedChord } from './progressions';
import type { Tuning } from './tuning';

export type PathPreset = 'balanced' | 'minimal-movement' | 'guide-tones';

/**
 * Named weight components (BLUEPRINT's "Weight components" guidance) —
 * harmonic quality, physical movement, and running-position continuity are
 * kept separate rather than folded into one opaque score, per the brief.
 */
export interface PathScore {
	harmonic: number;
	movement: number;
	position: number;
	style: number;
	total: number;
}

export interface VoiceLeadingPath {
	positions: FretPosition[];
	score: PathScore;
}

interface PathWeights {
	connection: ConnectionWeights;
	fretDistancePenalty: number;
	stringChangePenalty: number;
	positionDeviationPenalty: number;
	styleBonus: number;
}

const GUIDE_TONE_CONNECTION_WEIGHTS: ConnectionWeights = {
	...DEFAULT_CONNECTION_WEIGHTS,
	structuralTarget: 0.5,
	guideTone: 0.4,
	functionalResolution: 0.45
};

/** Presets are weight configs over the one DP — never separate algorithms. */
export const PATH_PRESETS: Record<PathPreset, PathWeights> = {
	balanced: {
		connection: DEFAULT_CONNECTION_WEIGHTS,
		fretDistancePenalty: 0.05,
		stringChangePenalty: 0.05,
		positionDeviationPenalty: 0.03,
		styleBonus: 0
	},
	'minimal-movement': {
		connection: DEFAULT_CONNECTION_WEIGHTS,
		fretDistancePenalty: 0.15,
		stringChangePenalty: 0.1,
		positionDeviationPenalty: 0.08,
		styleBonus: 0.1 // bonus for staying on the same string as the previous note
	},
	'guide-tones': {
		connection: GUIDE_TONE_CONNECTION_WEIGHTS,
		fretDistancePenalty: 0.03,
		stringChangePenalty: 0.02,
		positionDeviationPenalty: 0.01,
		styleBonus: 0.15 // bonus for landing on a structural (3rd/7th-family) tone
	}
};

export interface FindVoiceLeadingPathsOptions {
	preset?: PathPreset;
	region?: FretboardRegion;
	/** How many ranked, distinct paths to return. Default 3. */
	k?: number;
}

function candidatesForChord(
	chord: ResolvedChord,
	tuning: Tuning,
	fretCount: number,
	region?: FretboardRegion
): AnalyzedFretPosition[] {
	const analyzed = analyzeFretboard({
		tuning,
		fretCount,
		root: chord.root,
		chord: getChordDefinition(chord.chordId)
	});
	return analyzed.filter(
		(position) =>
			position.role !== 'avoid' &&
			(region === undefined || (position.fret >= region.minFret && position.fret <= region.maxFret))
	);
}

const emptyScore = (): PathScore => ({ harmonic: 0, movement: 0, position: 0, style: 0, total: 0 });

function edgeScore(
	from: AnalyzedFretPosition,
	to: AnalyzedFretPosition,
	currentChord: ResolvedChord,
	nextChord: ResolvedChord,
	runningAverageFret: number,
	preset: PathPreset,
	weights: PathWeights
): PathScore {
	const harmonic = scoreConnectionTo(
		from.pitchClass,
		currentChord,
		nextChord,
		to.pitchClass,
		weights.connection
	);

	const fretDistance = Math.abs(from.fret - to.fret);
	const stringChanged = from.stringIndex !== to.stringIndex;
	const movement =
		-(fretDistance * weights.fretDistancePenalty) -
		(stringChanged ? weights.stringChangePenalty : 0);

	const position = -Math.abs(to.fret - runningAverageFret) * weights.positionDeviationPenalty;

	let style = 0;
	if (preset === 'guide-tones' && to.role === 'structural') style = weights.styleBonus;
	if (preset === 'minimal-movement' && !stringChanged) style = weights.styleBonus;

	return { harmonic, movement, position, style, total: harmonic + movement + position + style };
}

interface DPCell {
	cumulative: PathScore;
	prevIndex: number | null;
	fretSum: number;
	fretCount: number;
}

const PENALTY_FOR_REUSED_NODE = 1000;

function runDP(
	layers: AnalyzedFretPosition[][],
	progression: ResolvedChord[],
	preset: PathPreset,
	weights: PathWeights,
	penalized: ReadonlySet<string>
): { path: FretPosition[]; score: PathScore } | null {
	if (layers.length === 0 || layers.some((layer) => layer.length === 0)) return null;

	const dp: DPCell[][] = [
		layers[0].map((node) => ({
			cumulative: emptyScore(),
			prevIndex: null,
			fretSum: node.fret,
			fretCount: 1
		}))
	];
	applyReuseePenalty(dp[0], layers[0], 0, penalized);

	for (let layerIndex = 1; layerIndex < layers.length; layerIndex++) {
		const prevLayer = layers[layerIndex - 1];
		const prevDP = dp[layerIndex - 1];
		const currentLayer = layers[layerIndex];
		const currentChord = progression[layerIndex - 1];
		const nextChord = progression[layerIndex];

		const layerCells: DPCell[] = currentLayer.map((toNode) => {
			let best: DPCell | null = null;
			for (let fromIdx = 0; fromIdx < prevLayer.length; fromIdx++) {
				const fromNode = prevLayer[fromIdx];
				const fromCell = prevDP[fromIdx];
				const runningAverage = fromCell.fretSum / fromCell.fretCount;
				const edge = edgeScore(
					fromNode,
					toNode,
					currentChord,
					nextChord,
					runningAverage,
					preset,
					weights
				);
				const total = fromCell.cumulative.total + edge.total;
				if (best === null || total > best.cumulative.total) {
					best = {
						cumulative: {
							harmonic: fromCell.cumulative.harmonic + edge.harmonic,
							movement: fromCell.cumulative.movement + edge.movement,
							position: fromCell.cumulative.position + edge.position,
							style: fromCell.cumulative.style + edge.style,
							total
						},
						prevIndex: fromIdx,
						fretSum: fromCell.fretSum + toNode.fret,
						fretCount: fromCell.fretCount + 1
					};
				}
			}
			// best is never null here: the fromIdx loop always runs at least once (prevLayer is non-empty).
			return best as DPCell;
		});

		applyReuseePenalty(layerCells, currentLayer, layerIndex, penalized);
		dp.push(layerCells);
	}

	const lastLayer = dp[dp.length - 1];
	let bestIndex = 0;
	for (let i = 1; i < lastLayer.length; i++) {
		if (lastLayer[i].cumulative.total > lastLayer[bestIndex].cumulative.total) bestIndex = i;
	}

	const path: FretPosition[] = [];
	let layerIndex = layers.length - 1;
	let index: number | null = bestIndex;
	while (index !== null) {
		const node = layers[layerIndex][index];
		path.unshift({ stringIndex: node.stringIndex, fret: node.fret, pitchClass: node.pitchClass });
		index = dp[layerIndex][index].prevIndex;
		layerIndex -= 1;
	}

	return { path, score: dp[dp.length - 1][bestIndex].cumulative };
}

/**
 * Discourages (without forbidding) reusing the same pitch class at the same
 * progression step. Keyed by pitch class rather than exact string/fret so
 * top-K surfaces genuinely different note choices (e.g. "F→F→E" vs.
 * "C→B→C") rather than the same notes replayed an octave apart.
 */
function applyReuseePenalty(
	cells: DPCell[],
	nodes: AnalyzedFretPosition[],
	layerIndex: number,
	penalized: ReadonlySet<string>
): void {
	for (let i = 0; i < cells.length; i++) {
		const key = `${layerIndex}:${nodes[i].pitchClass}`;
		if (penalized.has(key)) {
			cells[i] = {
				...cells[i],
				cumulative: {
					...cells[i].cumulative,
					total: cells[i].cumulative.total - PENALTY_FOR_REUSED_NODE
				}
			};
		}
	}
}

/**
 * Finds up to `k` distinct, ranked voice-leading paths through `progression`
 * — one fret position per chord. Uses an exact layered dynamic program
 * (Viterbi-style): the state space (fretCount+1 × strings, per chord) is
 * small enough that an exact search is simpler and fully deterministic
 * compared to a heuristic beam search. Top-K is extracted by penalizing the
 * previous best path's exact node choices and re-running the DP.
 */
export function findVoiceLeadingPaths(
	progression: ResolvedChord[],
	tuning: Tuning,
	fretCount: number,
	options: FindVoiceLeadingPathsOptions = {}
): VoiceLeadingPath[] {
	if (progression.length === 0) return [];

	const preset = options.preset ?? 'balanced';
	const k = options.k ?? 3;
	const weights = PATH_PRESETS[preset];

	const layers = progression.map((chord) =>
		candidatesForChord(chord, tuning, fretCount, options.region)
	);
	if (layers.some((layer) => layer.length === 0)) return [];

	const results: VoiceLeadingPath[] = [];
	const penalized = new Set<string>();
	const seenSignatures = new Set<string>();

	for (let i = 0; i < k; i++) {
		const result = runDP(layers, progression, preset, weights, penalized);
		if (result === null) break;

		const signature = result.path.map((p) => p.pitchClass).join('|');
		if (seenSignatures.has(signature)) break; // no further distinct pitch-class paths available

		seenSignatures.add(signature);
		results.push({ positions: result.path, score: result.score });
		result.path.forEach((p, layerIndex) => penalized.add(`${layerIndex}:${p.pitchClass}`));
	}

	return results;
}
