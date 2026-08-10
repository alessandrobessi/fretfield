/**
 * Pitch classes are represented as normalized integers 0-11 (C=0 .. B=11),
 * per AGENTS.md: interval arithmetic operates on numbers, never on note-name
 * strings. Note names are a display concern, computed at the boundary.
 */

declare const pitchClassBrand: unique symbol;
export type PitchClass = number & { readonly [pitchClassBrand]: true };

export function normalizePitchClass(semitones: number): PitchClass {
	return (((semitones % 12) + 12) % 12) as PitchClass;
}

export function transpose(pitch: PitchClass, semitones: number): PitchClass {
	return normalizePitchClass(pitch + semitones);
}

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** A letter + accidental spelling of a note, independent of octave. */
export interface NoteSpelling {
	letter: Letter;
	/** Negative = flats, positive = sharps, 0 = natural. */
	accidental: number;
}

const LETTER_ORDER: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const LETTER_SEMITONES: Record<Letter, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11
};

const ACCIDENTAL_SYMBOLS: Record<number, string> = {
	[-2]: 'bb',
	[-1]: 'b',
	[0]: '',
	[1]: '#',
	[2]: '##'
};

export function spellingToPitchClass(spelling: NoteSpelling): PitchClass {
	return normalizePitchClass(LETTER_SEMITONES[spelling.letter] + spelling.accidental);
}

export function spellingToName(spelling: NoteSpelling): string {
	const symbol = ACCIDENTAL_SYMBOLS[spelling.accidental];
	if (symbol === undefined) {
		throw new Error(`Unsupported accidental: ${spelling.accidental}`);
	}
	return `${spelling.letter}${symbol}`;
}

const NOTE_NAME_PATTERN = /^([A-G])(#{1,2}|b{1,2})?$/;

export function parseNoteName(input: string): NoteSpelling {
	const match = NOTE_NAME_PATTERN.exec(input.trim());
	if (!match) {
		throw new Error(`Invalid note name: "${input}"`);
	}
	const [, letter, accidentalSymbol] = match;
	const accidental =
		!accidentalSymbol || accidentalSymbol.length === 0
			? 0
			: accidentalSymbol[0] === '#'
				? accidentalSymbol.length
				: -accidentalSymbol.length;
	return { letter: letter as Letter, accidental };
}

export function noteNameToPitchClass(input: string): PitchClass {
	return spellingToPitchClass(parseNoteName(input));
}

/**
 * Fixed, context-free 12-note spelling per AGENTS.md §5 — used only as the
 * anchor spelling for a freshly selected root. Every other note on the neck
 * is then spelled relative to that root via {@link spellByDegree}, not from
 * this table, so harmonic context still drives enharmonic choice.
 */
const DEFAULT_NAMES: readonly string[] = [
	'C',
	'Db',
	'D',
	'Eb',
	'E',
	'F',
	'F#',
	'G',
	'Ab',
	'A',
	'Bb',
	'B'
];

export function defaultNoteName(pitch: PitchClass): string {
	return DEFAULT_NAMES[pitch];
}

/**
 * Spells `targetPitchClass` as a letter reached by stepping `degreeSteps`
 * scale-degree letters from `root` (diatonic letter progression), with the
 * accidental required to hit the target pitch. Returns null when that would
 * require a triple-or-greater accidental — an exotic spelling outside this
 * engine's scope; callers should fall back to {@link defaultNoteName}.
 *
 * // TODO(theory): double-sharp/flat spellings (e.g. Cb major, G# major
 * // upper structures) are not modeled and fall back to the fixed 12-note
 * // table rather than being guessed at.
 */
export function spellByDegree(
	root: NoteSpelling,
	degreeSteps: number,
	targetPitchClass: PitchClass
): NoteSpelling | null {
	const rootLetterIndex = LETTER_ORDER.indexOf(root.letter);
	const targetLetter = LETTER_ORDER[(((rootLetterIndex + degreeSteps) % 7) + 7) % 7];
	const naturalSemitone = LETTER_SEMITONES[targetLetter];

	let accidental = (targetPitchClass - naturalSemitone) % 12;
	if (accidental > 6) accidental -= 12;
	if (accidental < -6) accidental += 12;

	if (Math.abs(accidental) > 2) {
		return null;
	}

	return { letter: targetLetter, accidental };
}
