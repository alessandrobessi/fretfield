import { describe, expect, it } from 'vitest';
import { getChordDefinition, listChords } from '../chords';
import { analyzeFretboard, analyzeInterval } from '../harmony';
import { noteNameToPitchClass, normalizePitchClass } from '../pitch';
import { STANDARD_4_STRING_TUNING } from '../tuning';

describe('analyzeInterval', () => {
	it('classifies C7 chord tones as 1=root, 3=structural, 5=stable, b7=structural', () => {
		const chord = getChordDefinition('dominant-7');
		expect(analyzeInterval(chord, '1')).toBe('root');
		expect(analyzeInterval(chord, '3')).toBe('structural');
		expect(analyzeInterval(chord, '5')).toBe('stable');
		expect(analyzeInterval(chord, 'b7')).toBe('structural');
	});

	it('leaves non-chord-tones unclassified (Harmonic Field mode is out of scope here)', () => {
		const chord = getChordDefinition('major');
		expect(analyzeInterval(chord, 'b2')).toBeNull();
		expect(analyzeInterval(chord, '6')).toBeNull();
	});

	it('the same interval can have a different role under a different chord', () => {
		// 3 is structural over a major-family chord...
		expect(analyzeInterval(getChordDefinition('major'), '3')).toBe('structural');
		// ...but is not even a chord tone over a minor chord.
		expect(analyzeInterval(getChordDefinition('minor'), '3')).toBeNull();
	});
});

describe('analyzeFretboard', () => {
	const root = noteNameToPitchClass('C');
	const chord = getChordDefinition('dominant-7');
	const analysis = analyzeFretboard({
		tuning: STANDARD_4_STRING_TUNING,
		fretCount: 20,
		root,
		chord
	});

	it('root identity: every occurrence of the root pitch class has interval "1"', () => {
		for (const position of analysis) {
			if (position.pitchClass === root) {
				expect(position.interval).toBe('1');
				expect(position.role).toBe('root');
			}
		}
	});

	it('chord-tone identity: chord tones remain chord tones regardless of position', () => {
		for (const position of analysis) {
			const shouldBeChordTone = chord.required.includes(position.interval);
			expect(position.chordTone).toBe(shouldBeChordTone);
		}
	});

	it('fretboard invariance: positions 12 frets apart produce equivalent analysis', () => {
		for (const position of analysis) {
			if (position.fret + 12 <= 20) {
				const twelveUp = analysis.find(
					(p) => p.stringIndex === position.stringIndex && p.fret === position.fret + 12
				);
				expect(twelveUp?.interval).toBe(position.interval);
				expect(twelveUp?.role).toBe(position.role);
				expect(twelveUp?.chordTone).toBe(position.chordTone);
			}
		}
	});

	it('every chord family produces a valid analysis for every root', () => {
		for (const chordDefinition of listChords()) {
			for (let r = 0; r < 12; r++) {
				const result = analyzeFretboard({
					tuning: STANDARD_4_STRING_TUNING,
					fretCount: 12,
					root: normalizePitchClass(r),
					chord: chordDefinition
				});
				expect(result.length).toBeGreaterThan(0);
			}
		}
	});
});
