import type { ChordFamily } from './chords';
import { getChordDefinition } from './chords';
import { type IntervalId, transposeByInterval } from './intervals';
import type { PitchClass } from './pitch';

/**
 * A scale is just a named interval set, defined the same way chord formulas
 * already are (`chords.ts`) — no new pitch arithmetic, only a new vocabulary
 * of interval collections.
 */
export interface ScaleDefinition {
	id: string;
	label: string;
	/** Always includes '1'. */
	intervals: IntervalId[];
}

const SCALE_LIST: ScaleDefinition[] = [
	{ id: 'major-pentatonic', label: 'Major Pentatonic', intervals: ['1', '2', '3', '5', '6'] },
	{ id: 'minor-pentatonic', label: 'Minor Pentatonic', intervals: ['1', 'b3', '4', '5', 'b7'] },
	{ id: 'blues', label: 'Blues', intervals: ['1', 'b3', '4', '#4', '5', 'b7'] },
	{ id: 'ionian', label: 'Major (Ionian)', intervals: ['1', '2', '3', '4', '5', '6', '7'] },
	{
		id: 'aeolian',
		label: 'Natural Minor (Aeolian)',
		intervals: ['1', '2', 'b3', '4', '5', 'b6', 'b7']
	},
	{ id: 'dorian', label: 'Dorian', intervals: ['1', '2', 'b3', '4', '5', '6', 'b7'] },
	{ id: 'phrygian', label: 'Phrygian', intervals: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'] },
	{ id: 'lydian', label: 'Lydian', intervals: ['1', '2', '3', '#4', '5', '6', '7'] },
	{ id: 'mixolydian', label: 'Mixolydian', intervals: ['1', '2', '3', '4', '5', '6', 'b7'] },
	{ id: 'locrian', label: 'Locrian', intervals: ['1', 'b2', 'b3', '4', 'b6', 'b7'] },
	{
		id: 'harmonic-minor',
		label: 'Harmonic Minor',
		intervals: ['1', '2', 'b3', '4', '5', 'b6', '7']
	}
];

const SCALES_BY_ID: ReadonlyMap<string, ScaleDefinition> = new Map(
	SCALE_LIST.map((scale) => [scale.id, scale])
);

export function getScaleDefinition(id: string): ScaleDefinition {
	const scale = SCALES_BY_ID.get(id);
	if (!scale) {
		throw new Error(`Unknown scale id: "${id}"`);
	}
	return scale;
}

export function listScales(): readonly ScaleDefinition[] {
	return SCALE_LIST;
}

export function scalePitchClasses(root: PitchClass, scale: ScaleDefinition): PitchClass[] {
	return scale.intervals.map((interval) => transposeByInterval(root, interval));
}

export function scaleContainsPitchClass(
	root: PitchClass,
	scale: ScaleDefinition,
	pitchClass: PitchClass
): boolean {
	return scalePitchClasses(root, scale).includes(pitchClass);
}

/**
 * A starting recommendation, never a restriction — every scale stays
 * pickable for every chord (AGENTS.md §22's "no wrong note" framing extends
 * here). Keyed by chord family, mirroring `FAMILY_DEFAULT_ROLES` in
 * harmony.ts: the same scale can suit different chords very differently, so
 * this is never a single universal list.
 */
const FAMILY_SUGGESTED_SCALES: Record<ChordFamily, string[]> = {
	major: ['major-pentatonic', 'ionian', 'lydian'],
	minor: ['minor-pentatonic', 'aeolian', 'dorian', 'blues'],
	dominant: ['mixolydian', 'blues', 'major-pentatonic'],
	diminished: ['locrian'],
	// TODO(theory): an augmented triad doesn't map cleanly onto a diatonic
	// 7-note scale the way the others do; whole-tone is the usual jazz
	// answer but isn't modeled yet, so this is a deliberately weak fallback
	// rather than a confident recommendation.
	augmented: ['ionian'],
	suspended: ['mixolydian', 'major-pentatonic']
};

export function suggestedScalesFor(chordId: string): ScaleDefinition[] {
	const family = getChordDefinition(chordId).family;
	return FAMILY_SUGGESTED_SCALES[family].map((id) => getScaleDefinition(id));
}
