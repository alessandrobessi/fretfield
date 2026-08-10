import type { IntervalId } from './intervals';

export type ChordFamily = 'major' | 'minor' | 'dominant' | 'diminished' | 'augmented' | 'suspended';

/**
 * A composable chord formula (BLUEPRINT.md §7), not a UI-specific object.
 *
 * `structuralIntervals` is the subset of `required` (besides the root) that
 * defines the chord's quality — thirds and sevenths in most chords, but the
 * altered fifth in diminished/augmented triads where there is no third-family
 * tone to carry that role. This is encoded explicitly per chord rather than
 * inferred from a universal "5 = stable" rule, per AGENTS.md §6.
 */
export interface ChordDefinition {
	id: string;
	label: string;
	symbol: string;
	family: ChordFamily;
	required: IntervalId[];
	structuralIntervals: IntervalId[];
	optional?: IntervalId[];
	extensions?: IntervalId[];
	altered?: IntervalId[];
	aliases?: string[];
}

const CHORD_LIST: ChordDefinition[] = [
	{
		id: 'major',
		label: 'Major',
		symbol: '',
		family: 'major',
		required: ['1', '3', '5'],
		structuralIntervals: ['3']
	},
	{
		id: 'minor',
		label: 'Minor',
		symbol: 'm',
		family: 'minor',
		required: ['1', 'b3', '5'],
		structuralIntervals: ['b3'],
		aliases: ['min', '-']
	},
	{
		id: 'diminished',
		label: 'Diminished',
		symbol: 'dim',
		family: 'diminished',
		required: ['1', 'b3', '#4'],
		structuralIntervals: ['b3', '#4'],
		aliases: ['°']
	},
	{
		id: 'augmented',
		label: 'Augmented',
		symbol: 'aug',
		family: 'augmented',
		required: ['1', '3', 'b6'],
		structuralIntervals: ['3', 'b6'],
		aliases: ['+']
	},
	{
		id: 'sus2',
		label: 'Suspended 2',
		symbol: 'sus2',
		family: 'suspended',
		required: ['1', '2', '5'],
		structuralIntervals: ['2']
	},
	{
		id: 'sus4',
		label: 'Suspended 4',
		symbol: 'sus4',
		family: 'suspended',
		required: ['1', '4', '5'],
		structuralIntervals: ['4']
	},
	{
		id: 'dominant-7',
		label: 'Dominant 7',
		symbol: '7',
		family: 'dominant',
		required: ['1', '3', '5', 'b7'],
		structuralIntervals: ['3', 'b7']
	},
	{
		id: 'major-7',
		label: 'Major 7',
		symbol: 'maj7',
		family: 'major',
		required: ['1', '3', '5', '7'],
		structuralIntervals: ['3', '7']
	},
	{
		id: 'minor-7',
		label: 'Minor 7',
		symbol: 'm7',
		family: 'minor',
		required: ['1', 'b3', '5', 'b7'],
		structuralIntervals: ['b3', 'b7'],
		aliases: ['min7', '-7']
	},
	{
		id: 'minor-7-b5',
		label: 'Minor 7 b5',
		symbol: 'm7b5',
		family: 'diminished',
		required: ['1', 'b3', '#4', 'b7'],
		structuralIntervals: ['b3', '#4', 'b7'],
		aliases: ['half-diminished', 'ø7']
	},
	{
		id: 'diminished-7',
		label: 'Diminished 7',
		symbol: 'dim7',
		family: 'diminished',
		required: ['1', 'b3', '#4', '6'],
		structuralIntervals: ['b3', '#4', '6'],
		aliases: ['°7']
	}
];

const CHORDS_BY_ID: ReadonlyMap<string, ChordDefinition> = new Map(
	CHORD_LIST.map((chord) => [chord.id, chord])
);

export function getChordDefinition(id: string): ChordDefinition {
	const chord = CHORDS_BY_ID.get(id);
	if (!chord) {
		throw new Error(`Unknown chord id: "${id}"`);
	}
	return chord;
}

export function listChords(): readonly ChordDefinition[] {
	return CHORD_LIST;
}
