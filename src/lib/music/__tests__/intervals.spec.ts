import { describe, expect, it } from 'vitest';
import {
	ALL_INTERVALS,
	intervalFromRoot,
	intervalFromSemitones,
	intervalSemitones,
	noteNameForPosition,
	transposeByInterval
} from '../intervals';
import { noteNameToPitchClass, normalizePitchClass } from '../pitch';

describe('intervalFromSemitones / intervalSemitones', () => {
	it('round-trips every canonical interval through its semitone distance', () => {
		for (const interval of ALL_INTERVALS) {
			expect(intervalFromSemitones(intervalSemitones(interval))).toBe(interval);
		}
	});

	it('normalizes semitone distances outside 0-11', () => {
		expect(intervalFromSemitones(-1)).toBe('7');
		expect(intervalFromSemitones(16)).toBe('3');
	});
});

describe('intervalFromRoot', () => {
	it('is always "1" for the root itself, regardless of root pitch class', () => {
		for (const name of ['C', 'F#', 'Bb', 'G']) {
			const root = noteNameToPitchClass(name);
			expect(intervalFromRoot(root, root)).toBe('1');
		}
	});

	it('is transposition-invariant: the same interval structure holds under every root', () => {
		const intervals: import('../intervals').IntervalId[] = ['1', '3', '5', 'b7'];
		for (let root = 0; root < 12; root++) {
			const rootPitchClass = normalizePitchClass(root);
			for (const interval of intervals) {
				const note = transposeByInterval(rootPitchClass, interval);
				expect(intervalFromRoot(rootPitchClass, note)).toBe(interval);
			}
		}
	});
});

describe('noteNameForPosition', () => {
	it('spells C dominant 7 chord tones as C E G Bb', () => {
		const root = noteNameToPitchClass('C');
		expect(noteNameForPosition(root, noteNameToPitchClass('E'))).toBe('E');
		expect(noteNameForPosition(root, noteNameToPitchClass('G'))).toBe('G');
		expect(noteNameForPosition(root, noteNameToPitchClass('Bb'))).toBe('Bb');
	});

	it('spells F# minor 7 chord tones as F# A C# E', () => {
		const root = noteNameToPitchClass('F#');
		expect(noteNameForPosition(root, noteNameToPitchClass('A'))).toBe('A');
		expect(noteNameForPosition(root, noteNameToPitchClass('C#'))).toBe('C#');
		expect(noteNameForPosition(root, noteNameToPitchClass('E'))).toBe('E');
	});
});
