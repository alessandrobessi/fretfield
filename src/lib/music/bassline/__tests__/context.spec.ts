import { describe, expect, it } from 'vitest';

import { STANDARD_4_STRING_ABSOLUTE_TUNING } from '$lib/music/absolute-pitch';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { buildBarContexts, lcm, validateBasslineGenerationContext } from '../context';
import type { BasslineChordContext, BasslineGenerationContext } from '../types';

function chord(chordId: string): BasslineChordContext {
	return { root: noteNameToPitchClass('C'), chordId, scaleId: 'major' };
}

function validContext(
	overrides: Partial<BasslineGenerationContext> = {}
): BasslineGenerationContext {
	return {
		tonic: noteNameToPitchClass('C'),
		bars: buildBarContexts([{ phraseRole: 'main', chord: chord('Cmaj7') }]),
		meter: { stepsPerBar: 16, stepsPerBeatGroup: 4, isCompound: false },
		style: 'acid',
		harmonyMode: 'chord',
		density: 62,
		chromaticism: 35,
		movement: 55,
		register: 'zone',
		playability: 75,
		zone: { minFret: 0, maxFret: 12 },
		tuning: STANDARD_4_STRING_ABSOLUTE_TUNING,
		fretCount: 20,
		seed: 0x303303,
		...overrides
	};
}

describe('lcm', () => {
	it('matches the spec example: a 12-bar progression cycle and a 4-bar arrangement', () => {
		expect(lcm(12, 4)).toBe(12);
	});

	it('handles coprime lengths', () => {
		expect(lcm(4, 6)).toBe(12);
		expect(lcm(3, 5)).toBe(15);
	});

	it('is symmetric', () => {
		expect(lcm(8, 12)).toBe(lcm(12, 8));
	});

	it('returns 0 if either input is 0 (undefined/degenerate cycle length)', () => {
		expect(lcm(0, 4)).toBe(0);
		expect(lcm(4, 0)).toBe(0);
	});
});

describe('buildBarContexts', () => {
	it('returns an empty array for an empty sequence', () => {
		expect(buildBarContexts([])).toEqual([]);
	});

	it('a single bar wraps to itself for both previous and next', () => {
		const c = chord('Cmaj7');
		const [bar] = buildBarContexts([{ phraseRole: 'main', chord: c }]);
		expect(bar.barIndex).toBe(0);
		expect(bar.previousChord).toBe(c);
		expect(bar.nextChord).toBe(c);
	});

	it('links interior bars to their immediate neighbors', () => {
		const g7 = chord('G7');
		const cmaj7 = chord('Cmaj7');
		const dm7 = chord('Dm7');
		const bars = buildBarContexts([
			{ phraseRole: 'main', chord: dm7 },
			{ phraseRole: 'main', chord: g7 },
			{ phraseRole: 'variation', chord: cmaj7 }
		]);
		expect(bars[1].chord).toBe(g7);
		expect(bars[1].previousChord).toBe(dm7);
		expect(bars[1].nextChord).toBe(cmaj7);
	});

	it("wraps bar 0's previousChord to the last bar, and the last bar's nextChord to bar 0 (spec §18 turnaround resolution)", () => {
		const first = chord('Dm7');
		const middle = chord('G7');
		const last = chord('Cmaj7');
		const bars = buildBarContexts([
			{ phraseRole: 'main', chord: first },
			{ phraseRole: 'main', chord: middle },
			{ phraseRole: 'turnaround', chord: last }
		]);
		expect(bars[0].previousChord).toBe(last);
		expect(bars[bars.length - 1].nextChord).toBe(first);
	});

	it('preserves phraseRole and barIndex per entry', () => {
		const bars = buildBarContexts([
			{ phraseRole: 'main', chord: chord('A') },
			{ phraseRole: 'fill', chord: chord('B') }
		]);
		expect(bars[0]).toMatchObject({ barIndex: 0, phraseRole: 'main' });
		expect(bars[1]).toMatchObject({ barIndex: 1, phraseRole: 'fill' });
	});
});

describe('validateBasslineGenerationContext', () => {
	it('accepts a well-formed context', () => {
		expect(() => validateBasslineGenerationContext(validContext())).not.toThrow();
	});

	it('rejects an empty bars array', () => {
		expect(() => validateBasslineGenerationContext(validContext({ bars: [] }))).toThrow();
	});

	it('rejects a non-positive stepsPerBar', () => {
		const context = validContext();
		context.meter = { ...context.meter, stepsPerBar: 0 };
		expect(() => validateBasslineGenerationContext(context)).toThrow();
	});

	it('rejects a non-positive stepsPerBeatGroup', () => {
		const context = validContext();
		context.meter = { ...context.meter, stepsPerBeatGroup: -1 };
		expect(() => validateBasslineGenerationContext(context)).toThrow();
	});

	it('rejects an empty tuning', () => {
		expect(() => validateBasslineGenerationContext(validContext({ tuning: [] }))).toThrow();
	});

	it('rejects a negative fretCount', () => {
		expect(() => validateBasslineGenerationContext(validContext({ fretCount: -1 }))).toThrow();
	});

	it('rejects an inverted zone', () => {
		expect(() =>
			validateBasslineGenerationContext(validContext({ zone: { minFret: 12, maxFret: 0 } }))
		).toThrow();
	});

	it('rejects out-of-range density/chromaticism/movement/playability', () => {
		expect(() => validateBasslineGenerationContext(validContext({ density: 150 }))).toThrow();
		expect(() => validateBasslineGenerationContext(validContext({ chromaticism: -10 }))).toThrow();
		expect(() => validateBasslineGenerationContext(validContext({ movement: NaN }))).toThrow();
		expect(() =>
			validateBasslineGenerationContext(validContext({ playability: Infinity }))
		).toThrow();
	});

	it('rejects a non-finite seed', () => {
		expect(() => validateBasslineGenerationContext(validContext({ seed: NaN }))).toThrow();
	});
});
