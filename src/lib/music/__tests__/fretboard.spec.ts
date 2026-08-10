import { describe, expect, it } from 'vitest';
import { createFretboard, getPitchAtPosition } from '../fretboard';
import { defaultNoteName, noteNameToPitchClass } from '../pitch';
import { STANDARD_4_STRING_TUNING } from '../tuning';

describe('tuning correctness', () => {
	it('has open strings E A D G, low to high', () => {
		expect(STANDARD_4_STRING_TUNING.map((pc) => defaultNoteName(pc))).toEqual(['E', 'A', 'D', 'G']);
	});
});

describe('getPitchAtPosition', () => {
	it('E string fret 8 is C', () => {
		const pitch = getPitchAtPosition(STANDARD_4_STRING_TUNING, 0, 8);
		expect(defaultNoteName(pitch)).toBe('C');
	});

	it('A string fret 3 is C', () => {
		const pitch = getPitchAtPosition(STANDARD_4_STRING_TUNING, 1, 3);
		expect(defaultNoteName(pitch)).toBe('C');
	});

	it('throws for an out-of-range string index', () => {
		expect(() => getPitchAtPosition(STANDARD_4_STRING_TUNING, 4, 0)).toThrow();
	});
});

describe('createFretboard', () => {
	it('generates stringCount * (fretCount + 1) positions', () => {
		const positions = createFretboard(STANDARD_4_STRING_TUNING, 20);
		expect(positions).toHaveLength(4 * 21);
	});

	it('fretboard invariance: pitch classes 12 frets apart are equivalent', () => {
		const positions = createFretboard(STANDARD_4_STRING_TUNING, 24);
		for (const position of positions) {
			if (position.fret + 12 <= 24) {
				const twelveUp = positions.find(
					(p) => p.stringIndex === position.stringIndex && p.fret === position.fret + 12
				);
				expect(twelveUp?.pitchClass).toBe(position.pitchClass);
			}
		}
	});

	it('matches getPitchAtPosition for every position', () => {
		const positions = createFretboard(STANDARD_4_STRING_TUNING, 20);
		for (const position of positions) {
			expect(position.pitchClass).toBe(
				getPitchAtPosition(STANDARD_4_STRING_TUNING, position.stringIndex, position.fret)
			);
		}
	});
});

describe('noteNameToPitchClass sanity', () => {
	it('C is pitch class 0', () => {
		expect(noteNameToPitchClass('C')).toBe(0);
	});
});
