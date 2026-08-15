import { describe, expect, it } from 'vitest';
import { listChords } from '../chords';
import { noteNameToPitchClass } from '../pitch';
import {
	getScaleDefinition,
	listScales,
	scaleContainsPitchClass,
	scalePitchClasses,
	suggestedScalesFor
} from '../scales';

function pitchClasses(...names: string[]): number[] {
	return names.map((name) => noteNameToPitchClass(name));
}

describe('scalePitchClasses', () => {
	it('C major pentatonic -> C D E G A', () => {
		const scale = getScaleDefinition('major-pentatonic');
		const result = scalePitchClasses(noteNameToPitchClass('C'), scale);
		expect(result).toEqual(pitchClasses('C', 'D', 'E', 'G', 'A'));
	});

	it('A minor pentatonic -> A C D E G', () => {
		const scale = getScaleDefinition('minor-pentatonic');
		const result = scalePitchClasses(noteNameToPitchClass('A'), scale);
		expect(result).toEqual(pitchClasses('A', 'C', 'D', 'E', 'G'));
	});

	it('D dorian -> D E F G A B C', () => {
		const scale = getScaleDefinition('dorian');
		const result = scalePitchClasses(noteNameToPitchClass('D'), scale);
		expect(result).toEqual(pitchClasses('D', 'E', 'F', 'G', 'A', 'B', 'C'));
	});

	it.each(['C', 'Eb', 'A'])('transposition invariance for ionian, root %s', (rootName) => {
		const root = noteNameToPitchClass(rootName);
		const scale = getScaleDefinition('ionian');
		const result = scalePitchClasses(root, scale);
		// A major scale is always 1 2 3 4 5 6 7 semitone-shaped relative to its root.
		const semitoneShape = result.map((pc) => (pc - root + 12) % 12);
		expect(semitoneShape).toEqual([0, 2, 4, 5, 7, 9, 11]);
	});
});

describe('scaleContainsPitchClass', () => {
	const scale = getScaleDefinition('mixolydian');
	const root = noteNameToPitchClass('G');

	it('a chord tone of the scale is contained', () => {
		expect(scaleContainsPitchClass(root, scale, noteNameToPitchClass('B'))).toBe(true);
	});

	it('a pitch class outside the scale is not contained', () => {
		// G mixolydian has F natural (b7), not F#.
		expect(scaleContainsPitchClass(root, scale, noteNameToPitchClass('F#'))).toBe(false);
	});
});

describe('suggestedScalesFor', () => {
	it('returns a non-empty, valid list for every existing chord quality', () => {
		for (const chord of listChords()) {
			const suggestions = suggestedScalesFor(chord.id);
			expect(suggestions.length).toBeGreaterThan(0);
			for (const scale of suggestions) {
				expect(listScales()).toContain(scale);
			}
		}
	});

	it('is family-aware, not a single universal list', () => {
		const dominant = suggestedScalesFor('dominant-7').map((s) => s.id);
		const minor = suggestedScalesFor('minor-7').map((s) => s.id);
		expect(dominant).toContain('mixolydian');
		expect(minor).not.toContain('mixolydian');
	});
});

describe('getScaleDefinition', () => {
	it('throws for an unknown scale id', () => {
		expect(() => getScaleDefinition('not-a-real-scale')).toThrow();
	});
});
