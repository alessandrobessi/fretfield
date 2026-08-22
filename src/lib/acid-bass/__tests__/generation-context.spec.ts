import { describe, expect, it } from 'vitest';

import { PATTERN_ROLES } from '$lib/groove/pattern-role';
import { STANDARD_4_STRING_ABSOLUTE_TUNING } from '$lib/music/absolute-pitch';
import { noteNameToPitchClass } from '$lib/music/pitch';
import type { ResolvedChord } from '$lib/music/progressions';

import {
	buildAcidBassGenerationContext,
	type AcidBassGenerationContextInput
} from '../generation-context';
import { createDefaultGenerationSettings } from '../pattern';

const DM7: ResolvedChord = { root: noteNameToPitchClass('D'), chordId: 'minor-7' };
const G7: ResolvedChord = { root: noteNameToPitchClass('G'), chordId: 'dominant-7' };
const CMAJ7: ResolvedChord = { root: noteNameToPitchClass('C'), chordId: 'major-7' };

function baseInput(
	overrides: Partial<AcidBassGenerationContextInput> = {}
): AcidBassGenerationContextInput {
	return {
		root: noteNameToPitchClass('C'),
		resolvedProgression: [DM7, G7, CMAJ7],
		progressionChordScales: ['dorian', 'mixolydian', 'major'],
		barsPerChord: 4,
		arrangement: ['A', 'A', 'B', 'F'],
		timeSignature: '4/4',
		zone: { minFret: 0, maxFret: 12 },
		tuning: STANDARD_4_STRING_ABSOLUTE_TUNING,
		fretCount: 20,
		generation: createDefaultGenerationSettings(),
		...overrides
	};
}

describe('buildAcidBassGenerationContext: unavailable generation', () => {
	it('returns null when no root is chosen', () => {
		expect(buildAcidBassGenerationContext(baseInput({ root: null }))).toBeNull();
	});

	it('returns null when no progression is selected', () => {
		expect(
			buildAcidBassGenerationContext(
				baseInput({ resolvedProgression: [], progressionChordScales: [] })
			)
		).toBeNull();
	});

	it('returns null for a structurally degenerate (empty) arrangement rather than throwing', () => {
		expect(buildAcidBassGenerationContext(baseInput({ arrangement: [] }))).toBeNull();
	});
});

describe('buildAcidBassGenerationContext: composite cycle length', () => {
	it('a 12-bar progression (3 chords * 4 bars) and a 4-bar arrangement produce a 12-bar cycle (their LCM)', () => {
		const context = buildAcidBassGenerationContext(baseInput());
		expect(context).not.toBeNull();
		expect(context?.bars).toHaveLength(12);
	});

	it('a progression/arrangement mismatch still produces their exact LCM', () => {
		// 2 chords * 4 bars = 8-bar progression; 6-bar arrangement -> lcm(8,6) = 24.
		const context = buildAcidBassGenerationContext(
			baseInput({
				resolvedProgression: [DM7, G7],
				progressionChordScales: ['dorian', 'mixolydian'],
				barsPerChord: 4,
				arrangement: ['A', 'A', 'B', 'F', 'A', 'T']
			})
		);
		expect(context?.bars).toHaveLength(24);
	});
});

describe('buildAcidBassGenerationContext: chord index expansion across barsPerChord', () => {
	it('each chord holds for exactly barsPerChord consecutive bars before advancing', () => {
		const context = buildAcidBassGenerationContext(baseInput());
		const chordIds = context?.bars.map((bar) => bar.chord.chordId);
		expect(chordIds).toEqual([
			'minor-7',
			'minor-7',
			'minor-7',
			'minor-7',
			'dominant-7',
			'dominant-7',
			'dominant-7',
			'dominant-7',
			'major-7',
			'major-7',
			'major-7',
			'major-7'
		]);
	});
});

describe('buildAcidBassGenerationContext: A/B/F/T -> phrase role mapping', () => {
	it('maps every pattern role to its phrase role, cycling the arrangement across the whole cycle', () => {
		const context = buildAcidBassGenerationContext(baseInput());
		const phraseRoles = context?.bars.map((bar) => bar.phraseRole);
		// arrangement A/A/B/F repeated three times across 12 bars.
		expect(phraseRoles).toEqual([
			'main',
			'main',
			'variation',
			'fill',
			'main',
			'main',
			'variation',
			'fill',
			'main',
			'main',
			'variation',
			'fill'
		]);
	});

	it('covers every PatternRole', () => {
		// 3 chords * 4 bars = 12-bar progression; a 4-role arrangement -> lcm(12,4) = 12, the
		// arrangement repeating exactly three times.
		const context = buildAcidBassGenerationContext(baseInput({ arrangement: [...PATTERN_ROLES] }));
		const phraseRoles = context?.bars.map((bar) => bar.phraseRole);
		expect(phraseRoles).toEqual([
			'main',
			'variation',
			'fill',
			'turnaround',
			'main',
			'variation',
			'fill',
			'turnaround',
			'main',
			'variation',
			'fill',
			'turnaround'
		]);
	});
});

describe('buildAcidBassGenerationContext: scale assignment', () => {
	it("assigns each bar its chord's own scale", () => {
		const context = buildAcidBassGenerationContext(baseInput());
		expect(context?.bars[0].chord.scaleId).toBe('dorian');
		expect(context?.bars[4].chord.scaleId).toBe('mixolydian');
		expect(context?.bars[8].chord.scaleId).toBe('major');
	});

	it('preserves an explicitly cleared (null) scale rather than substituting another one', () => {
		const context = buildAcidBassGenerationContext(
			baseInput({ progressionChordScales: ['dorian', null, 'major'] })
		);
		expect(context?.bars[4].chord.scaleId).toBeNull();
		// The other two chords are unaffected by the one cleared scale.
		expect(context?.bars[0].chord.scaleId).toBe('dorian');
		expect(context?.bars[8].chord.scaleId).toBe('major');
	});
});

describe('buildAcidBassGenerationContext: wrap-aware bar linkage', () => {
	it("the first bar's previousChord is the last bar's chord, and vice versa (turnaround resolution)", () => {
		const context = buildAcidBassGenerationContext(baseInput());
		const bars = context!.bars;
		expect(bars[0].previousChord.chordId).toBe(bars[bars.length - 1].chord.chordId);
		expect(bars[bars.length - 1].nextChord.chordId).toBe(bars[0].chord.chordId);
	});
});

describe('buildAcidBassGenerationContext: meter', () => {
	it('passes simple-meter (4/4) information through unchanged', () => {
		const context = buildAcidBassGenerationContext(baseInput({ timeSignature: '4/4' }));
		expect(context?.meter).toEqual({ stepsPerBar: 16, stepsPerBeatGroup: 4, isCompound: false });
	});

	it('passes compound-meter (6/8) information through unchanged', () => {
		const context = buildAcidBassGenerationContext(baseInput({ timeSignature: '6/8' }));
		expect(context?.meter).toEqual({ stepsPerBar: 12, stepsPerBeatGroup: 6, isCompound: true });
	});
});

describe('buildAcidBassGenerationContext: remaining fields pass through unchanged', () => {
	it('tonic, zone, tuning, fretCount, and every generation setting', () => {
		const generation = {
			...createDefaultGenerationSettings(),
			style: 'walking' as const,
			seed: 777
		};
		const context = buildAcidBassGenerationContext(baseInput({ generation }));
		expect(context?.tonic).toBe(noteNameToPitchClass('C'));
		expect(context?.zone).toEqual({ minFret: 0, maxFret: 12 });
		expect(context?.tuning).toBe(STANDARD_4_STRING_ABSOLUTE_TUNING);
		expect(context?.fretCount).toBe(20);
		expect(context?.style).toBe('walking');
		expect(context?.harmonyMode).toBe(generation.harmonyMode);
		expect(context?.density).toBe(generation.density);
		expect(context?.chromaticism).toBe(generation.chromaticism);
		expect(context?.movement).toBe(generation.movement);
		expect(context?.register).toBe(generation.register);
		expect(context?.playability).toBe(generation.playability);
		expect(context?.seed).toBe(777);
	});
});
