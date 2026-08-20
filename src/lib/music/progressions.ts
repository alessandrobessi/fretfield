import { getChordDefinition } from './chords';
import { type IntervalId, transposeByInterval } from './intervals';
import { defaultNoteName, type PitchClass } from './pitch';

/** A scale degree expressed the same way chord formulas are: an interval from the tonic, plus a chord quality. */
export interface ProgressionDegree {
	fromTonic: IntervalId;
	chordId: string;
}

export interface ProgressionTemplate {
	id: string;
	label: string;
	mode: 'major' | 'minor' | 'dominant';
	degrees: ProgressionDegree[];
}

export interface ResolvedChord {
	root: PitchClass;
	chordId: string;
}

const PROGRESSION_TEMPLATES: ProgressionTemplate[] = [
	{
		id: 'major-ii-v-i',
		label: 'Major ii–V–I',
		mode: 'major',
		degrees: [
			{ fromTonic: '2', chordId: 'minor-7' }, // ii
			{ fromTonic: '5', chordId: 'dominant-7' }, // V
			{ fromTonic: '1', chordId: 'major-7' } // I
		]
	},
	{
		id: 'minor-ii-v-i',
		label: 'Minor iiø–V–i',
		mode: 'minor',
		degrees: [
			{ fromTonic: '2', chordId: 'minor-7-b5' }, // iiø
			{ fromTonic: '5', chordId: 'dominant-7' }, // V (harmonic minor dominant)
			{ fromTonic: '1', chordId: 'minor' } // i
		]
	},
	{
		id: 'i-vi-ii-v',
		label: 'I–vi–ii–V',
		mode: 'major',
		degrees: [
			{ fromTonic: '1', chordId: 'major-7' }, // I
			{ fromTonic: '6', chordId: 'minor-7' }, // vi
			{ fromTonic: '2', chordId: 'minor-7' }, // ii
			{ fromTonic: '5', chordId: 'dominant-7' } // V
		]
	},
	{
		id: 'i-iv-v',
		label: 'I–IV–V',
		mode: 'major',
		degrees: [
			{ fromTonic: '1', chordId: 'major' }, // I
			{ fromTonic: '4', chordId: 'major' }, // IV
			{ fromTonic: '5', chordId: 'major' } // V
		]
	},
	{
		id: '12-bar-blues',
		label: '12-Bar Dominant Blues',
		mode: 'dominant',
		degrees: (['1', '4', '1', '1', '4', '4', '1', '1', '5', '4', '1', '5'] as IntervalId[]).map(
			(fromTonic) => ({ fromTonic, chordId: 'dominant-7' })
		)
	},
	{
		id: '12-bar-minor-blues',
		label: '12-Bar Minor Blues',
		mode: 'minor',
		degrees: [
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '4', chordId: 'minor-7' },
			{ fromTonic: '4', chordId: 'minor-7' },
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: 'b6', chordId: 'major-7' }, // bVImaj7
			{ fromTonic: '5', chordId: 'dominant-7' }, // V7
			{ fromTonic: '1', chordId: 'minor-7' },
			{ fromTonic: '5', chordId: 'dominant-7' } // V7 turnaround
		]
	},
	{
		id: 'i-vi7-ii-v',
		label: 'I–VI7–ii–V (Rhythm Changes)',
		mode: 'major',
		degrees: [
			{ fromTonic: '1', chordId: 'major-7' }, // I
			{ fromTonic: '6', chordId: 'dominant-7' }, // VI7 (secondary dominant of ii)
			{ fromTonic: '2', chordId: 'minor-7' }, // ii
			{ fromTonic: '5', chordId: 'dominant-7' } // V
		]
	},
	{
		id: 'iii-vi7-ii-v',
		label: 'iii–VI7–ii–V (Extended Turnaround)',
		mode: 'major',
		degrees: [
			{ fromTonic: '3', chordId: 'minor-7' }, // iii
			{ fromTonic: '6', chordId: 'dominant-7' }, // VI7 (secondary dominant of ii)
			{ fromTonic: '2', chordId: 'minor-7' }, // ii
			{ fromTonic: '5', chordId: 'dominant-7' } // V
		]
	},
	{
		id: 'backdoor-ii-v-i',
		label: 'Backdoor ii–V–I',
		mode: 'major',
		degrees: [
			{ fromTonic: '4', chordId: 'minor-7' }, // iv-7 (borrowed from the parallel minor)
			{ fromTonic: 'b7', chordId: 'dominant-7' }, // bVII7
			{ fromTonic: '1', chordId: 'major-7' } // I
		]
	},
	{
		id: 'coltrane-changes',
		label: 'Coltrane Changes (Major-3rd Turnaround)',
		mode: 'major',
		degrees: [
			{ fromTonic: '1', chordId: 'major-7' }, // I
			{ fromTonic: 'b3', chordId: 'dominant-7' }, // V7 of bVI
			{ fromTonic: 'b6', chordId: 'major-7' }, // bVI
			{ fromTonic: '7', chordId: 'dominant-7' }, // V7 of III
			{ fromTonic: '3', chordId: 'major-7' }, // III
			{ fromTonic: '5', chordId: 'dominant-7' }, // V7 of I
			{ fromTonic: '1', chordId: 'major-7' } // I
		]
	}
];

const TEMPLATES_BY_ID: ReadonlyMap<string, ProgressionTemplate> = new Map(
	PROGRESSION_TEMPLATES.map((template) => [template.id, template])
);

export function getProgressionTemplate(id: string): ProgressionTemplate {
	const template = TEMPLATES_BY_ID.get(id);
	if (!template) {
		throw new Error(`Unknown progression template id: "${id}"`);
	}
	return template;
}

export function listProgressionTemplates(): readonly ProgressionTemplate[] {
	return PROGRESSION_TEMPLATES;
}

/**
 * Resolves a template into concrete chords for `tonic`, by transposing each
 * degree's interval-from-tonic — the same primitive (`transposeByInterval`)
 * chord formulas already use, so transposition invariance is automatic.
 */
export function buildProgression(
	tonic: PitchClass,
	template: ProgressionTemplate
): ResolvedChord[] {
	return template.degrees.map((degree) => ({
		root: transposeByInterval(tonic, degree.fromTonic),
		chordId: degree.chordId
	}));
}

/** A simple chord symbol like "Dm7" or "G7" — root's letter name plus the chord's own symbol. */
export function resolvedChordSymbol(resolved: ResolvedChord): string {
	return `${defaultNoteName(resolved.root)}${getChordDefinition(resolved.chordId).symbol}`;
}
