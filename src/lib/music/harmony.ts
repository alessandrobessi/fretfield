import type { ChordDefinition } from './chords';
import { type FretPosition, createFretboard } from './fretboard';
import { type IntervalId, intervalFromRoot } from './intervals';
import type { PitchClass } from './pitch';
import type { Tuning } from './tuning';

/**
 * Full semantic role vocabulary from BLUEPRINT.md §5.2. Only 'root',
 * 'structural', and 'stable' are populated in this phase (chord-tone
 * visualization); the remaining roles belong to Harmonic Field mode.
 */
export type HarmonicRole =
	| 'root'
	| 'structural'
	| 'stable'
	| 'extension'
	| 'color'
	| 'tension'
	| 'alteration'
	| 'chromatic-approach'
	| 'avoid';

/**
 * Classifies a single interval's role over `chord`. Never a universal
 * interval→role table (AGENTS.md §6): the role always depends on whether —
 * and how — this specific chord uses the interval.
 *
 * // TODO(theory): non-chord-tone roles (extension/color/tension/alteration/
 * // chromatic-approach/avoid) are Harmonic Field mode (ROADMAP.md Phase 4)
 * // and are intentionally left unclassified (null) here rather than guessed.
 */
export function analyzeInterval(chord: ChordDefinition, interval: IntervalId): HarmonicRole | null {
	if (interval === '1') {
		return 'root';
	}
	if (!chord.required.includes(interval)) {
		return null;
	}
	return chord.structuralIntervals.includes(interval) ? 'structural' : 'stable';
}

export interface AnalyzedFretPosition extends FretPosition {
	interval: IntervalId;
	chordTone: boolean;
	role: HarmonicRole | null;
}

export interface AnalyzeFretboardOptions {
	tuning: Tuning;
	fretCount: number;
	root: PitchClass;
	chord: ChordDefinition;
}

/** The single entry point the UI calls — computed once per state change. */
export function analyzeFretboard(options: AnalyzeFretboardOptions): AnalyzedFretPosition[] {
	const { tuning, fretCount, root, chord } = options;
	return createFretboard(tuning, fretCount).map((position) => {
		const interval = intervalFromRoot(root, position.pitchClass);
		return {
			...position,
			interval,
			chordTone: interval === '1' || chord.required.includes(interval),
			role: analyzeInterval(chord, interval)
		};
	});
}
