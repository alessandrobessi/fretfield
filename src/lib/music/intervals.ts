import {
	type NoteSpelling,
	type PitchClass,
	defaultNoteName,
	parseNoteName,
	spellByDegree,
	spellingToName,
	spellingToPitchClass,
	transpose
} from './pitch';

/**
 * Canonical chromatic interval identity, per BLUEPRINT.md §5.1. Each id is
 * the primary label for its semitone distance from the root; enharmonic
 * alternates (b3/#9, #4/b5, b6/#5, 2/9, 4/11, 6/13) are exposed as compound
 * labels rather than separate identities, since the underlying pitch-class
 * relationship is the same — only the display spelling changes with context.
 */
export type IntervalId = '1' | 'b2' | '2' | 'b3' | '3' | '4' | '#4' | '5' | 'b6' | '6' | 'b7' | '7';

interface IntervalDefinition {
	id: IntervalId;
	semitones: number;
	/** Diatonic letter-steps from the root, used for note-name spelling. */
	degreeSteps: number;
	label: string;
	compoundLabel: string;
}

const INTERVALS: Record<IntervalId, IntervalDefinition> = {
	'1': { id: '1', semitones: 0, degreeSteps: 0, label: '1', compoundLabel: '1' },
	b2: { id: 'b2', semitones: 1, degreeSteps: 1, label: 'b2', compoundLabel: 'b2/b9' },
	'2': { id: '2', semitones: 2, degreeSteps: 1, label: '2', compoundLabel: '2/9' },
	b3: { id: 'b3', semitones: 3, degreeSteps: 2, label: 'b3', compoundLabel: 'b3/#9' },
	'3': { id: '3', semitones: 4, degreeSteps: 2, label: '3', compoundLabel: '3' },
	'4': { id: '4', semitones: 5, degreeSteps: 3, label: '4', compoundLabel: '4/11' },
	'#4': { id: '#4', semitones: 6, degreeSteps: 3, label: '#4', compoundLabel: '#4/b5' },
	'5': { id: '5', semitones: 7, degreeSteps: 4, label: '5', compoundLabel: '5' },
	b6: { id: 'b6', semitones: 8, degreeSteps: 5, label: 'b6', compoundLabel: 'b6/#5' },
	'6': { id: '6', semitones: 9, degreeSteps: 5, label: '6', compoundLabel: '6/13' },
	b7: { id: 'b7', semitones: 10, degreeSteps: 6, label: 'b7', compoundLabel: 'b7' },
	'7': { id: '7', semitones: 11, degreeSteps: 6, label: '7', compoundLabel: '7' }
};

export const ALL_INTERVALS: readonly IntervalId[] = [
	'1',
	'b2',
	'2',
	'b3',
	'3',
	'4',
	'#4',
	'5',
	'b6',
	'6',
	'b7',
	'7'
];

const SEMITONES_TO_INTERVAL: readonly IntervalId[] = ALL_INTERVALS.slice().sort(
	(a, b) => INTERVALS[a].semitones - INTERVALS[b].semitones
);

export function intervalSemitones(interval: IntervalId): number {
	return INTERVALS[interval].semitones;
}

export function intervalDegreeSteps(interval: IntervalId): number {
	return INTERVALS[interval].degreeSteps;
}

export function intervalLabel(interval: IntervalId): string {
	return INTERVALS[interval].label;
}

export function intervalCompoundLabel(interval: IntervalId): string {
	return INTERVALS[interval].compoundLabel;
}

export function intervalFromSemitones(semitoneDistance: number): IntervalId {
	const normalized = ((semitoneDistance % 12) + 12) % 12;
	return SEMITONES_TO_INTERVAL[normalized];
}

export function intervalFromRoot(root: PitchClass, note: PitchClass): IntervalId {
	return intervalFromSemitones(note - root);
}

export function transposeByInterval(root: PitchClass, interval: IntervalId): PitchClass {
	return transpose(root, intervalSemitones(interval));
}

/**
 * Spells `note` relative to `root`'s letter, following the diatonic degree
 * progression implied by `interval`. Falls back to null (caller uses
 * {@link defaultNoteName}) for exotic spellings — see {@link spellByDegree}.
 */
export function noteSpellingForInterval(
	root: NoteSpelling,
	interval: IntervalId
): NoteSpelling | null {
	const rootPitchClass = spellingToPitchClass(root);
	const targetPitchClass = transposeByInterval(rootPitchClass, interval);
	return spellByDegree(root, intervalDegreeSteps(interval), targetPitchClass);
}

/**
 * Display-boundary helper: the note name for `note` given the selected
 * `root`, spelled diatonically from the root's own letter identity (itself
 * anchored via {@link defaultNoteName} at selection time).
 */
export function noteNameForPosition(root: PitchClass, note: PitchClass): string {
	const interval = intervalFromRoot(root, note);
	const rootSpelling = parseNoteName(defaultNoteName(root));
	const spelling = noteSpellingForInterval(rootSpelling, interval);
	return spelling ? spellingToName(spelling) : defaultNoteName(note);
}
