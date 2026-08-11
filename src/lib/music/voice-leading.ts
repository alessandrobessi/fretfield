import {
	ALL_CONNECTION_INTERVALS,
	type ConnectionWeights,
	DEFAULT_CONNECTION_WEIGHTS,
	type NoteConnection,
	analyzeConnection
} from './connection-score';
import { transposeByInterval } from './intervals';
import type { PitchClass } from './pitch';
import type { ResolvedChord } from './progressions';

/** `NoteConnection` for every one of the 12 pitch classes, indexed by pitch class (0-11). */
export type ChordTransition = readonly NoteConnection[];

/**
 * Analyzes a single transition in a progression: for every pitch class in
 * `current`'s full harmonic field (not just its chord tones — chromatic
 * approaches matter too), scores its connection into `next`.
 */
export function analyzeTransition(
	current: ResolvedChord,
	next: ResolvedChord,
	weights: ConnectionWeights = DEFAULT_CONNECTION_WEIGHTS
): ChordTransition {
	const connections: NoteConnection[] = new Array(12);
	for (const interval of ALL_CONNECTION_INTERVALS) {
		const pitchClass = transposeByInterval(current.root, interval);
		connections[pitchClass] = analyzeConnection(pitchClass, current, next, weights);
	}
	return connections;
}

export function connectionFor(transition: ChordTransition, pitchClass: PitchClass): NoteConnection {
	return transition[pitchClass];
}
