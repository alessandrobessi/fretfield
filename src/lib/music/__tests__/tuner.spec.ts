import { describe, expect, it } from 'vitest';

import { STANDARD_4_STRING_ABSOLUTE_TUNING } from '../absolute-pitch';
import {
	MAX_SEMITONES_FROM_OPEN_STRING,
	centsFromOpenString,
	classifyTunerStatus,
	findClosestOpenString
} from '../tuner';

describe('findClosestOpenString', () => {
	it('finds the exact match for each of the 4 open strings (E1=28, A1=33, D2=38, G2=43)', () => {
		for (const string of STANDARD_4_STRING_ABSOLUTE_TUNING) {
			const match = findClosestOpenString(STANDARD_4_STRING_ABSOLUTE_TUNING, string.midi);
			expect(match.string).toBe(string);
			expect(match.semitoneDistance).toBe(0);
		}
	});

	it('picks the nearer string when the pitch sits between two open strings', () => {
		// A1=33, D2=38 -- 34 is 1 semitone from A, 4 from D.
		const match = findClosestOpenString(STANDARD_4_STRING_ABSOLUTE_TUNING, 34);
		expect(match.string.midi).toBe(33);
		expect(match.semitoneDistance).toBe(1);
	});

	it('a note far from every open string still returns the nearest one, with a large distance', () => {
		// G2=43 is the highest string; 60 (C4) is 17 semitones above it.
		const match = findClosestOpenString(STANDARD_4_STRING_ABSOLUTE_TUNING, 60);
		expect(match.string.midi).toBe(43);
		expect(match.semitoneDistance).toBe(17);
	});
});

describe('centsFromOpenString', () => {
	it('collapses to exactly the detected cents when the detected MIDI matches the string (the ordinary tuning case)', () => {
		expect(centsFromOpenString(28, 7, 28)).toBe(7);
		expect(centsFromOpenString(28, -12, 28)).toBe(-12);
	});

	it('adds a full 100 cents per semitone of distance from the target string', () => {
		expect(centsFromOpenString(29, 0, 28)).toBe(100);
		expect(centsFromOpenString(27, 0, 28)).toBe(-100);
		expect(centsFromOpenString(29, 10, 28)).toBe(110);
		expect(centsFromOpenString(27, -10, 28)).toBe(-110);
	});
});

describe('classifyTunerStatus', () => {
	it('is in-tune within +/-5 cents, inclusive of the boundary', () => {
		expect(classifyTunerStatus(0)).toBe('in-tune');
		expect(classifyTunerStatus(5)).toBe('in-tune');
		expect(classifyTunerStatus(-5)).toBe('in-tune');
	});

	it('is "slightly" off from just past 5 cents up to 20 cents, inclusive', () => {
		expect(classifyTunerStatus(6)).toBe('slightly-sharp');
		expect(classifyTunerStatus(20)).toBe('slightly-sharp');
		expect(classifyTunerStatus(-6)).toBe('slightly-flat');
		expect(classifyTunerStatus(-20)).toBe('slightly-flat');
	});

	it('is plainly sharp/flat past 20 cents', () => {
		expect(classifyTunerStatus(21)).toBe('sharp');
		expect(classifyTunerStatus(-21)).toBe('flat');
		expect(classifyTunerStatus(150)).toBe('sharp');
		expect(classifyTunerStatus(-150)).toBe('flat');
	});
});

describe('MAX_SEMITONES_FROM_OPEN_STRING', () => {
	it('is a small, sane threshold (not 0, not absurdly large)', () => {
		expect(MAX_SEMITONES_FROM_OPEN_STRING).toBeGreaterThan(0);
		expect(MAX_SEMITONES_FROM_OPEN_STRING).toBeLessThan(6);
	});

	it('a note exactly at the threshold is still within range; one past it is not', () => {
		// G2=43 is the highest open string.
		const atThreshold = findClosestOpenString(
			STANDARD_4_STRING_ABSOLUTE_TUNING,
			43 + MAX_SEMITONES_FROM_OPEN_STRING
		);
		expect(atThreshold.semitoneDistance).toBe(MAX_SEMITONES_FROM_OPEN_STRING);

		const pastThreshold = findClosestOpenString(
			STANDARD_4_STRING_ABSOLUTE_TUNING,
			43 + MAX_SEMITONES_FROM_OPEN_STRING + 1
		);
		expect(pastThreshold.semitoneDistance).toBe(MAX_SEMITONES_FROM_OPEN_STRING + 1);
	});
});
