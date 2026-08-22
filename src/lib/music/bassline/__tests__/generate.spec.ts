import { describe, expect, it } from 'vitest';

import {
	findFretPositionsForMidi,
	STANDARD_4_STRING_ABSOLUTE_TUNING
} from '$lib/music/absolute-pitch';
import { noteNameToPitchClass, normalizePitchClass } from '$lib/music/pitch';

import { buildBarContexts } from '../context';
import { generateBasslineSkeleton } from '../generate';
import { pitchClassDistance } from '../voice-leading';
import type { BassHarmonyMode, BasslineChordContext, BasslineGenerationContext } from '../types';

const C = noteNameToPitchClass('C');
const F = noteNameToPitchClass('F');
const G = noteNameToPitchClass('G');

function chord(root: ReturnType<typeof noteNameToPitchClass>, chordId: string, scaleId: string) {
	return { root, chordId, scaleId } satisfies BasslineChordContext;
}

function context(overrides: Partial<BasslineGenerationContext> = {}): BasslineGenerationContext {
	return {
		tonic: C,
		bars: buildBarContexts([
			{ phraseRole: 'main', chord: chord(C, 'major', 'ionian') },
			{ phraseRole: 'main', chord: chord(F, 'major', 'ionian') }
		]),
		meter: { stepsPerBar: 16, stepsPerBeatGroup: 4, isCompound: false },
		style: 'rooted',
		harmonyMode: 'chord',
		density: 70,
		chromaticism: 35,
		movement: 55,
		register: 'zone',
		playability: 75,
		zone: { minFret: 0, maxFret: 12 },
		tuning: STANDARD_4_STRING_ABSOLUTE_TUNING,
		fretCount: 20,
		seed: 42,
		...overrides
	};
}

describe('generateBasslineSkeleton: shape', () => {
	it('produces exactly one note per active rhythmic slot, and every note maps to a real bar/step', () => {
		const skeleton = generateBasslineSkeleton(context());
		expect(skeleton.notes.length).toBeGreaterThan(0);
		for (const note of skeleton.notes) {
			expect([0, 1]).toContain(note.barIndex);
			expect(note.stepIndex).toBeGreaterThanOrEqual(0);
			expect(note.stepIndex).toBeLessThan(16);
			expect(note.pitchClass).toBeGreaterThanOrEqual(0);
		}
		// step 0 of every bar is always active (rhythm.ts's own anchor rule).
		expect(skeleton.notes.some((n) => n.barIndex === 0 && n.stepIndex === 0)).toBe(true);
		expect(skeleton.notes.some((n) => n.barIndex === 1 && n.stepIndex === 0)).toBe(true);
	});

	it('is deterministic -- the same seed and context produce an identical skeleton', () => {
		const a = generateBasslineSkeleton(context({ seed: 123 }));
		const b = generateBasslineSkeleton(context({ seed: 123 }));
		expect(a.notes.map((n) => n.pitchClass)).toEqual(b.notes.map((n) => n.pitchClass));
	});

	it('runs cleanly under all three harmony modes', () => {
		for (const harmonyMode of ['chord', 'key', 'voice-leading'] as const) {
			expect(() => generateBasslineSkeleton(context({ harmonyMode }))).not.toThrow();
		}
	});
});

describe('generateBasslineSkeleton: Chord mode responds to chord roots', () => {
	it("the downbeat of each bar tracks that bar's own chord root, even across a C -> F change", () => {
		const skeleton = generateBasslineSkeleton(context({ style: 'rooted', harmonyMode: 'chord' }));
		const bar0Downbeat = skeleton.notes.find((n) => n.barIndex === 0 && n.stepIndex === 0);
		const bar1Downbeat = skeleton.notes.find((n) => n.barIndex === 1 && n.stepIndex === 0);
		expect(bar0Downbeat?.pitchClass).toBe(C);
		expect(bar1Downbeat?.pitchClass).toBe(F);
		expect(bar0Downbeat?.function).toBe('root');
		expect(bar1Downbeat?.function).toBe('root');
	});
});

function averageBarBoundaryDistance(harmonyMode: BassHarmonyMode, trials: number): number {
	let total = 0;
	for (let seed = 0; seed < trials; seed++) {
		const skeleton = generateBasslineSkeleton(
			context({
				bars: buildBarContexts([
					{ phraseRole: 'main', chord: chord(G, 'dominant-7', 'mixolydian') },
					{ phraseRole: 'main', chord: chord(C, 'major-7', 'ionian') }
				]),
				harmonyMode,
				seed
			})
		);
		const bar0Notes = skeleton.notes
			.filter((n) => n.barIndex === 0)
			.sort((a, b) => b.stepIndex - a.stepIndex);
		const bar1Notes = skeleton.notes
			.filter((n) => n.barIndex === 1)
			.sort((a, b) => a.stepIndex - b.stepIndex);
		const lastOfBar0 = bar0Notes[0];
		const firstOfBar1 = bar1Notes[0];
		total += pitchClassDistance(lastOfBar0.pitchClass, firstOfBar1.pitchClass);
	}
	return total / trials;
}

describe('generateBasslineSkeleton: Voice Leading mode produces smoother bar-boundary motion', () => {
	it('averages a smaller G7 -> Cmaj7 boundary distance than Chord mode, across many seeds', () => {
		const chordModeAverage = averageBarBoundaryDistance('chord', 60);
		const voiceLeadingAverage = averageBarBoundaryDistance('voice-leading', 60);
		expect(voiceLeadingAverage).toBeLessThan(chordModeAverage);
	});
});

describe('generateBasslineSkeleton: register and physical realization (M8)', () => {
	it('every note carries a real, physically playable MIDI + position matching its final pitch class', () => {
		const skeleton = generateBasslineSkeleton(context());
		for (const note of skeleton.notes) {
			expect(normalizePitchClass(note.midi)).toBe(note.pitchClass);
			const realPositions = findFretPositionsForMidi(
				STANDARD_4_STRING_ABSOLUTE_TUNING,
				20,
				note.midi
			);
			expect(realPositions).toContainEqual(note.preferredPosition);
			for (const alt of note.alternativePositions) {
				expect(realPositions).toContainEqual(alt);
			}
		}
	});

	it('zone register mode keeps preferred positions inside the zone whenever possible', () => {
		const skeleton = generateBasslineSkeleton(
			context({ register: 'zone', zone: { minFret: 0, maxFret: 5 } })
		);
		for (const note of skeleton.notes) {
			if (!note.registerFallback) {
				expect(note.preferredPosition.fret).toBeGreaterThanOrEqual(0);
				expect(note.preferredPosition.fret).toBeLessThanOrEqual(5);
			}
		}
	});
});
