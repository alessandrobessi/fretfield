import { describe, expect, it } from 'vitest';
import { getScaleDefinition } from '$lib/music/scales';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING } from '$lib/music/tuning';
import { positionsForPitchClass, scalePositions } from '../positions';

describe('positionsForPitchClass', () => {
	it('finds every position for a pitch class within the zone, and none outside it', () => {
		const c = noteNameToPitchClass('C');
		const positions = positionsForPitchClass(
			c,
			{ minFret: 0, maxFret: 5 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(positions.length).toBeGreaterThan(0);
		for (const position of positions) {
			expect(position.pitchClass).toBe(c);
			expect(position.fret).toBeGreaterThanOrEqual(0);
			expect(position.fret).toBeLessThanOrEqual(5);
		}
	});

	it('returns nothing for a zone with no fret positions at all', () => {
		const c = noteNameToPitchClass('C');
		const positions = positionsForPitchClass(
			c,
			{ minFret: DEFAULT_FRET_COUNT + 5, maxFret: DEFAULT_FRET_COUNT + 5 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(positions).toEqual([]);
	});
});

describe('scalePositions', () => {
	it('covers every degree of the scale that has at least one position in a wide-open zone', () => {
		const scale = getScaleDefinition('major-pentatonic');
		const positions = scalePositions(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: 0, maxFret: DEFAULT_FRET_COUNT },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		const pitchClassesFound = new Set(positions.map((p) => p.pitchClass));
		expect(pitchClassesFound).toEqual(
			new Set(['C', 'D', 'E', 'G', 'A'].map((name) => noteNameToPitchClass(name)))
		);
	});

	it('a narrow zone omits degrees with no position in it, rather than falling back to the full neck', () => {
		// Frets 0-1 on E-A-D-G contain E,F,A,Bb,D,Eb,G,Ab — C major pentatonic's
		// root (C) has no position there.
		const scale = getScaleDefinition('major-pentatonic');
		const positions = scalePositions(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: 0, maxFret: 1 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		const pitchClassesFound = new Set(positions.map((p) => p.pitchClass));
		expect(pitchClassesFound).toEqual(
			new Set(['D', 'E', 'G', 'A'].map((name) => noteNameToPitchClass(name)))
		);
	});

	it('an impossible zone yields no positions at all', () => {
		const scale = getScaleDefinition('major-pentatonic');
		const positions = scalePositions(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: DEFAULT_FRET_COUNT + 5, maxFret: DEFAULT_FRET_COUNT + 5 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(positions).toEqual([]);
	});
});
