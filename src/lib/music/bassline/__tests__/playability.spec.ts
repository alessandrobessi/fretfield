import { describe, expect, it } from 'vitest';

import { type AbsoluteTuning, findFretPositionsForMidi } from '$lib/music/absolute-pitch';
import { STANDARD_4_STRING_ABSOLUTE_TUNING } from '$lib/music/absolute-pitch';
import { noteNameToPitchClass, normalizePitchClass } from '$lib/music/pitch';

import { realizeSequence } from '../playability';
import type { PlayabilityOptions, PlayabilityRequest } from '../playability';

const WIDE_ZONE = { minFret: 0, maxFret: 20 };

function baseOptions(overrides: Partial<PlayabilityOptions> = {}): PlayabilityOptions {
	return {
		register: 'mid',
		zone: WIDE_ZONE,
		tuning: STANDARD_4_STRING_ABSOLUTE_TUNING,
		fretCount: 20,
		playability: 60,
		...overrides
	};
}

function requestsFor(pitchClasses: number[]): PlayabilityRequest[] {
	return pitchClasses.map((pc) => ({ pitchClass: normalizePitchClass(pc) }));
}

describe('realizeSequence: every MIDI is physically playable', () => {
	it('preferredPosition and every alternativePosition genuinely produce the returned midi', () => {
		const results = realizeSequence(requestsFor([0, 4, 7, 11, 2, 9]), baseOptions());
		for (const result of results) {
			const realPositions = findFretPositionsForMidi(
				STANDARD_4_STRING_ABSOLUTE_TUNING,
				20,
				result.midi
			);
			expect(realPositions).toContainEqual(result.preferredPosition);
			for (const alt of result.alternativePositions) {
				expect(realPositions).toContainEqual(alt);
			}
		}
	});
});

describe('realizeSequence: preferred position is the exact pitch', () => {
	it("preferredPosition's string+fret produces exactly the requested pitch class", () => {
		const pitchClasses = [0, 4, 7, 11, 2, 9, 6, 1];
		const results = realizeSequence(requestsFor(pitchClasses), baseOptions());
		results.forEach((result, i) => {
			const openMidi = STANDARD_4_STRING_ABSOLUTE_TUNING[result.preferredPosition.stringIndex].midi;
			const actualMidi = openMidi + result.preferredPosition.fret;
			expect(actualMidi).toBe(result.midi);
			expect(normalizePitchClass(actualMidi)).toBe(normalizePitchClass(pitchClasses[i]));
		});
	});
});

describe('realizeSequence: zone preference', () => {
	it('prefers a realization inside the zone when at least one exists there', () => {
		const options = baseOptions({ register: 'zone', zone: { minFret: 0, maxFret: 5 } });
		const results = realizeSequence(requestsFor([0, 4, 7]), options);
		for (const result of results) {
			expect(result.fallback).toBe(false);
			expect(result.preferredPosition.fret).toBeGreaterThanOrEqual(0);
			expect(result.preferredPosition.fret).toBeLessThanOrEqual(5);
		}
	});

	it('falls back to the nearest physically available realization, marked as fallback, when nothing exists in the zone', () => {
		// C# (pitch class 1) is not an open string on standard tuning, so a
		// zone clamped to fret 0 only has no legal C# realization at all.
		const options = baseOptions({ register: 'zone', zone: { minFret: 0, maxFret: 0 } });
		const [result] = realizeSequence(requestsFor([1]), options);
		expect(result.fallback).toBe(true);
		expect(normalizePitchClass(result.midi)).toBe(normalizePitchClass(1));
		// The fallback realization must still be a real, legal position.
		const realPositions = findFretPositionsForMidi(
			STANDARD_4_STRING_ABSOLUTE_TUNING,
			20,
			result.midi
		);
		expect(realPositions).toContainEqual(result.preferredPosition);
	});
});

function totalMovement(results: ReturnType<typeof realizeSequence>): number {
	let total = 0;
	for (let i = 1; i < results.length; i++) {
		const prev = results[i - 1].preferredPosition;
		const curr = results[i].preferredPosition;
		total += Math.abs(curr.fret - prev.fret) + Math.abs(curr.stringIndex - prev.stringIndex);
	}
	return total;
}

describe('realizeSequence: strict playability reduces avoidable shifts', () => {
	it('a high-playability run has strictly less total fret/string movement than a zero-playability run over the same sequence', () => {
		// C and F# alternating -- both pitch classes have widely-scattered
		// candidate positions across the neck, giving the DP real room to find
		// a smoother combined path than "always the first-enumerated position."
		const sequence = requestsFor([0, 6, 0, 6, 0, 6]);
		const zeroPlayability = realizeSequence(sequence, baseOptions({ playability: 0 }));
		const fullPlayability = realizeSequence(sequence, baseOptions({ playability: 100 }));

		expect(totalMovement(fullPlayability)).toBeLessThan(totalMovement(zeroPlayability));
	});

	it('zero playability still returns 100% legal realizations, just without physical preference', () => {
		const sequence = requestsFor([0, 6, 0, 6]);
		const results = realizeSequence(sequence, baseOptions({ playability: 0 }));
		for (const result of results) {
			const realPositions = findFretPositionsForMidi(
				STANDARD_4_STRING_ABSOLUTE_TUNING,
				20,
				result.midi
			);
			expect(realPositions).toContainEqual(result.preferredPosition);
		}
	});
});

describe('realizeSequence: nonstandard tuning', () => {
	it('works correctly against a tuning other than the standard 4-string bass', () => {
		// Drop-D-style low string, plus a 5th high string -- deliberately not
		// STANDARD_4_STRING_ABSOLUTE_TUNING, to prove nothing is hardcoded to it.
		const customTuning: AbsoluteTuning = Object.freeze([
			{ pitchClass: noteNameToPitchClass('D'), midi: 26 },
			{ pitchClass: noteNameToPitchClass('A'), midi: 33 },
			{ pitchClass: noteNameToPitchClass('D'), midi: 38 },
			{ pitchClass: noteNameToPitchClass('G'), midi: 43 },
			{ pitchClass: noteNameToPitchClass('C'), midi: 48 }
		]);
		const options = baseOptions({ tuning: customTuning, fretCount: 17 });
		const results = realizeSequence(requestsFor([0, 4, 7, 9]), options);
		expect(results).toHaveLength(4);
		for (const result of results) {
			const realPositions = findFretPositionsForMidi(customTuning, 17, result.midi);
			expect(realPositions).toContainEqual(result.preferredPosition);
			expect(result.preferredPosition.fret).toBeGreaterThanOrEqual(0);
			expect(result.preferredPosition.fret).toBeLessThanOrEqual(17);
		}
	});
});

describe('realizeSequence: shape', () => {
	it('returns [] for an empty request list', () => {
		expect(realizeSequence([], baseOptions())).toEqual([]);
	});
});
