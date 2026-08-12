import { describe, expect, it } from 'vitest';
import {
	STANDARD_4_STRING_ABSOLUTE_TUNING,
	findFretPositionsForMidi,
	getMidiAtPosition
} from '../absolute-pitch';

describe('getMidiAtPosition', () => {
	it('open strings match the standard bass reference table', () => {
		expect(getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 0, 0)).toBe(28); // E1
		expect(getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 1, 0)).toBe(33); // A1
		expect(getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 2, 0)).toBe(38); // D2
		expect(getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 3, 0)).toBe(43); // G2
	});

	it('adds the fret number to the open-string MIDI note', () => {
		expect(getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 0, 12)).toBe(40); // E2, octave above open E
	});

	it('throws for an invalid string index', () => {
		expect(() => getMidiAtPosition(STANDARD_4_STRING_ABSOLUTE_TUNING, 4, 0)).toThrow();
	});
});

describe('findFretPositionsForMidi', () => {
	const fretCount = 20;

	it('E2 (MIDI 40) maps only to positions that actually produce E2', () => {
		const positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 40);
		// E string fret 12, A string fret 7, D string fret 2 all produce E2 within 20 frets.
		expect(positions).toEqual(
			expect.arrayContaining([
				{ stringIndex: 0, fret: 12, pitchClass: expect.anything() },
				{ stringIndex: 1, fret: 7, pitchClass: expect.anything() },
				{ stringIndex: 2, fret: 2, pitchClass: expect.anything() }
			])
		);
		expect(positions).toHaveLength(3);
	});

	it('same pitch class but a different octave produces a completely different candidate set', () => {
		const e1Positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 28); // E1
		const e2Positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 40); // E2

		expect(e1Positions).toEqual([{ stringIndex: 0, fret: 0, pitchClass: expect.anything() }]);
		expect(e2Positions.length).toBeGreaterThan(0);

		const overlap = e1Positions.filter((a) =>
			e2Positions.some((b) => a.stringIndex === b.stringIndex && a.fret === b.fret)
		);
		expect(overlap).toHaveLength(0);
	});

	it('the open lowest note E1 maps to exactly the open E string', () => {
		const positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 28);
		expect(positions).toEqual([{ stringIndex: 0, fret: 0, pitchClass: expect.anything() }]);
	});

	it('a note reachable only at the maximum configured fret is still found', () => {
		// G string open is MIDI 43; fret 20 on the G string is MIDI 63.
		const positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 63);
		expect(positions).toEqual([{ stringIndex: 3, fret: 20, pitchClass: expect.anything() }]);
	});

	it('a note beyond the configured fret range on every string returns no candidates', () => {
		const positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 64);
		expect(positions).toEqual([]);
	});

	it('a note below the lowest open string returns no candidates', () => {
		const positions = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, fretCount, 20);
		expect(positions).toEqual([]);
	});
});
