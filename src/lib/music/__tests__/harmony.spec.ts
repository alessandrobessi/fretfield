import { describe, expect, it } from 'vitest';
import { getChordDefinition, listChords } from '../chords';
import {
	ALL_ROLE_INTERVALS,
	analyzeFretboard,
	analyzeInterval,
	type HarmonicRole,
	roleStability,
	roleTension,
	typicalResolutions
} from '../harmony';
import { type IntervalId, transposeByInterval } from '../intervals';
import { noteNameToPitchClass, normalizePitchClass } from '../pitch';
import { STANDARD_4_STRING_TUNING } from '../tuning';

describe('analyzeInterval — chord tones', () => {
	it('classifies C7 chord tones as 1=root, 3=structural, 5=stable, b7=structural', () => {
		const chord = getChordDefinition('dominant-7');
		expect(analyzeInterval(chord, '1')).toBe('root');
		expect(analyzeInterval(chord, '3')).toBe('structural');
		expect(analyzeInterval(chord, '5')).toBe('stable');
		expect(analyzeInterval(chord, 'b7')).toBe('structural');
	});

	it('the same interval can have a different role under a different chord', () => {
		// 3 is structural over a major-family chord...
		expect(analyzeInterval(getChordDefinition('major'), '3')).toBe('structural');
		// ...but merely dissonant against the required b3 over a minor chord.
		expect(analyzeInterval(getChordDefinition('minor'), '3')).toBe('avoid');
	});
});

describe('analyzeInterval — full Harmonic Field over C7 (BLUEPRINT.md §4 worked example)', () => {
	// C  1    root       E  3    structural   G  5    stable      Bb b7   structural
	// D  9    extension  A  13   color        Eb #9   tension     F  11   tension
	// F# #11  tension    Ab b13  tension       Db b9   tension     B  7   chromatic-approach
	const chord = getChordDefinition('dominant-7');
	const expected: Record<IntervalId, HarmonicRole> = {
		'1': 'root',
		b2: 'tension',
		'2': 'extension',
		b3: 'tension',
		'3': 'structural',
		'4': 'tension',
		'#4': 'tension',
		'5': 'stable',
		b6: 'tension',
		'6': 'color',
		b7: 'structural',
		'7': 'chromatic-approach'
	};

	for (const [interval, role] of Object.entries(expected) as [IntervalId, HarmonicRole][]) {
		it(`${interval} → ${role}`, () => {
			expect(analyzeInterval(chord, interval)).toBe(role);
		});
	}
});

describe('analyzeInterval — every interval is classified for every chord', () => {
	it('never returns undefined/null for any of the 11 non-root intervals, across every chord', () => {
		for (const chord of listChords()) {
			for (const interval of ALL_ROLE_INTERVALS) {
				expect(analyzeInterval(chord, interval)).toBeTruthy();
			}
		}
	});

	it('sus2 and sus4 disagree on which third clashes with their own structural tone', () => {
		expect(analyzeInterval(getChordDefinition('sus2'), 'b3')).toBe('avoid');
		expect(analyzeInterval(getChordDefinition('sus2'), '3')).toBe('color');
		expect(analyzeInterval(getChordDefinition('sus4'), '3')).toBe('avoid');
		expect(analyzeInterval(getChordDefinition('sus4'), 'b3')).toBe('color');
	});
});

describe('roleStability / roleTension', () => {
	it('root is maximally stable and tension-free', () => {
		expect(roleStability('root')).toBe(1);
		expect(roleTension('root', '1')).toBe(0);
	});

	it('avoid is the least stable, most tense role', () => {
		expect(roleStability('avoid')).toBeLessThan(roleStability('color'));
		expect(roleTension('avoid', 'b2')).toBeGreaterThan(roleTension('color', 'b2'));
	});

	it('b9 over a dominant chord reads as marginally stronger tension than its siblings', () => {
		expect(roleTension('tension', 'b2')).toBeGreaterThan(roleTension('tension', '2'));
	});
});

describe('typicalResolutions', () => {
	it('finds the nearest chord tone(s) by semitone distance', () => {
		const chord = getChordDefinition('dominant-7'); // C E G Bb
		// Db (b9) sits a half-step from both C (root) and... nothing else that close; nearest is '1'.
		expect(typicalResolutions(chord, 'b2')).toContain('1');
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
				expect(twelveUp?.stability).toBe(position.stability);
			}
		}
	});

	it('transposition invariance: role classification is preserved for every root, every chord', () => {
		for (const chordDefinition of listChords()) {
			for (let r = 0; r < 12; r++) {
				const transposedRoot = normalizePitchClass(r);
				for (const interval of ALL_ROLE_INTERVALS) {
					const note = transposeByInterval(transposedRoot, interval);
					const result = analyzeFretboard({
						tuning: STANDARD_4_STRING_TUNING,
						fretCount: 11, // a single string's frets 0-11 already cover all 12 chromatic pitch classes
						root: transposedRoot,
						chord: chordDefinition
					});
					const position = result.find((p) => p.pitchClass === note);
					if (position) {
						expect(position.role).toBe(analyzeInterval(chordDefinition, interval));
					}
				}
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
