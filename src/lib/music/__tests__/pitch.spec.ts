import { describe, expect, it } from 'vitest';
import {
	defaultNoteName,
	noteNameToPitchClass,
	normalizePitchClass,
	parseNoteName,
	spellByDegree,
	spellingToName,
	spellingToPitchClass,
	transpose
} from '../pitch';

describe('normalizePitchClass', () => {
	it('wraps negative and over-range semitone values into 0-11', () => {
		expect(normalizePitchClass(-1)).toBe(11);
		expect(normalizePitchClass(12)).toBe(0);
		expect(normalizePitchClass(25)).toBe(1);
	});
});

describe('transpose', () => {
	it('adds semitones and normalizes', () => {
		const c = noteNameToPitchClass('C');
		expect(transpose(c, 12)).toBe(c);
		expect(transpose(c, 13)).toBe(noteNameToPitchClass('C#'));
	});
});

describe('parseNoteName / noteNameToPitchClass', () => {
	it('parses naturals, sharps, and flats', () => {
		expect(parseNoteName('C')).toEqual({ letter: 'C', accidental: 0 });
		expect(parseNoteName('F#')).toEqual({ letter: 'F', accidental: 1 });
		expect(parseNoteName('Eb')).toEqual({ letter: 'E', accidental: -1 });
	});

	it('round-trips through pitch class for every default-table name', () => {
		for (let pc = 0; pc < 12; pc++) {
			const name = defaultNoteName(pc as never);
			expect(noteNameToPitchClass(name)).toBe(pc);
		}
	});

	it('throws on an invalid note name', () => {
		expect(() => parseNoteName('H')).toThrow();
	});
});

describe('spellingToPitchClass / spellingToName', () => {
	it('computes pitch class from letter + accidental', () => {
		expect(spellingToPitchClass({ letter: 'C', accidental: 1 })).toBe(1);
		expect(spellingToPitchClass({ letter: 'D', accidental: -1 })).toBe(1);
	});

	it('renders accidental symbols', () => {
		expect(spellingToName({ letter: 'C', accidental: 0 })).toBe('C');
		expect(spellingToName({ letter: 'C', accidental: 1 })).toBe('C#');
		expect(spellingToName({ letter: 'C', accidental: -2 })).toBe('Cbb');
	});
});

describe('spellByDegree', () => {
	it('spells the minor third above F# as A natural, not G##', () => {
		const root = parseNoteName('F#');
		const targetPitchClass = noteNameToPitchClass('A');
		const spelling = spellByDegree(root, 2, targetPitchClass);
		expect(spelling).toEqual({ letter: 'A', accidental: 0 });
	});

	it('spells the minor seventh above Db as Cb, wrapping across the octave boundary', () => {
		const root = parseNoteName('Db');
		const targetPitchClass = noteNameToPitchClass('B');
		const spelling = spellByDegree(root, 6, targetPitchClass);
		expect(spelling).toEqual({ letter: 'C', accidental: -1 });
	});

	it('returns null when the required accidental exceeds a double sharp/flat', () => {
		const root = parseNoteName('C');
		// Force an unreasonable degree/pitch combination (letter G, but target far from it).
		const targetPitchClass = noteNameToPitchClass('C#');
		const spelling = spellByDegree(root, 4, targetPitchClass);
		expect(spelling).toBeNull();
	});
});
