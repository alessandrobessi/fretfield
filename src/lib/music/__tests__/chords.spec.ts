import { describe, expect, it } from 'vitest';
import { getChordDefinition, listChords } from '../chords';
import { intervalFromRoot, transposeByInterval } from '../intervals';
import { normalizePitchClass } from '../pitch';

describe('listChords / getChordDefinition', () => {
	it('exposes all 11 MVP chord formulas', () => {
		const ids = listChords().map((c) => c.id);
		expect(ids).toEqual([
			'major',
			'minor',
			'diminished',
			'augmented',
			'sus2',
			'sus4',
			'dominant-7',
			'major-7',
			'minor-7',
			'minor-7-b5',
			'diminished-7'
		]);
	});

	it('throws for an unknown chord id', () => {
		expect(() => getChordDefinition('not-a-chord')).toThrow();
	});

	it('every structural interval is a subset of required', () => {
		for (const chord of listChords()) {
			for (const interval of chord.structuralIntervals) {
				expect(chord.required).toContain(interval);
			}
		}
	});
});

describe('transposition invariance', () => {
	it('every chord formula preserves its interval structure under every root', () => {
		for (const chord of listChords()) {
			for (let root = 0; root < 12; root++) {
				const rootPitchClass = normalizePitchClass(root);
				const chordToneIntervals = chord.required.map((interval) =>
					intervalFromRoot(rootPitchClass, transposeByInterval(rootPitchClass, interval))
				);
				expect(chordToneIntervals).toEqual(chord.required);
			}
		}
	});
});

describe('known chord spellings (pitch-class level)', () => {
	it('C major = C E G', () => {
		const chord = getChordDefinition('major');
		const root = normalizePitchClass(0);
		const pitchClasses = chord.required.map((interval) => transposeByInterval(root, interval));
		expect(pitchClasses).toEqual([0, 4, 7]);
	});

	it('C minor = C Eb G', () => {
		const chord = getChordDefinition('minor');
		const root = normalizePitchClass(0);
		const pitchClasses = chord.required.map((interval) => transposeByInterval(root, interval));
		expect(pitchClasses).toEqual([0, 3, 7]);
	});

	it('C dominant 7 = C E G Bb', () => {
		const chord = getChordDefinition('dominant-7');
		const root = normalizePitchClass(0);
		const pitchClasses = chord.required.map((interval) => transposeByInterval(root, interval));
		expect(pitchClasses).toEqual([0, 4, 7, 10]);
	});
});
