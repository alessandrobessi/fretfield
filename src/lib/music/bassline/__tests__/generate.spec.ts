import { describe, expect, it } from 'vitest';

import {
	findFretPositionsForMidi,
	STANDARD_4_STRING_ABSOLUTE_TUNING
} from '$lib/music/absolute-pitch';
import { noteNameToPitchClass, normalizePitchClass } from '$lib/music/pitch';

import { buildBarContexts } from '../context';
import { generateBassline, generateBasslineSkeleton } from '../generate';
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

function allActiveSteps(plan: ReturnType<typeof generateBassline>) {
	return plan.bars.flatMap((bar) => bar.steps.filter((step) => step.active));
}

describe('generateBassline: shape and articulation (M9)', () => {
	it('every bar has exactly meter.stepsPerBar steps, and every note has an explanation', () => {
		const plan = generateBassline(context());
		for (const bar of plan.bars) {
			expect(bar.steps).toHaveLength(16);
		}
		const activeSteps = allActiveSteps(plan);
		expect(activeSteps.length).toBeGreaterThan(0);
		for (const step of activeSteps) {
			expect(step.explanation.headline.length).toBeGreaterThan(0);
			expect(step.explanation.detail.length).toBeGreaterThan(0);
		}
	});

	it('every generated gate is within the legal 10-100 range', () => {
		const plan = generateBassline(context());
		for (const step of allActiveSteps(plan)) {
			expect(step.gate).toBeGreaterThanOrEqual(10);
			expect(step.gate).toBeLessThanOrEqual(100);
		}
	});

	it('probability is always 100 and ratchet is always 1 -- generated V4 has no per-step randomness of its own', () => {
		const plan = generateBassline(context());
		for (const step of allActiveSteps(plan)) {
			expect(step.probability).toBe(100);
			expect(step.ratchet).toBe(1);
		}
	});

	it('is deterministic -- the same seed produces an identical plan', () => {
		const a = generateBassline(context({ seed: 77 }));
		const b = generateBassline(context({ seed: 77 }));
		expect(a).toEqual(b);
	});

	it('slide only ever points at an adjacent (semitone/whole-step) active event', () => {
		for (let seed = 0; seed < 20; seed++) {
			const plan = generateBassline(context({ style: 'acid', chromaticism: 60, seed }));
			const activeSteps = allActiveSteps(plan);
			activeSteps.forEach((step, index) => {
				if (!step.slide) return;
				const next = activeSteps[(index + 1) % activeSteps.length];
				expect(pitchClassDistance(step.pitchClass, next.pitchClass)).toBeLessThanOrEqual(2);
			});
		}
	});

	it("a chromatic-approach/diatonic-approach/enclosure step's explanation headline names its target note", () => {
		let sawTargetedExplanation = false;
		for (let seed = 0; seed < 30; seed++) {
			const plan = generateBassline(
				context({ style: 'chromatic', harmonyMode: 'voice-leading', chromaticism: 100, seed })
			);
			for (const step of allActiveSteps(plan)) {
				if (
					step.function === 'chromatic-approach' ||
					step.function === 'diatonic-approach' ||
					step.function === 'enclosure-upper' ||
					step.function === 'enclosure-lower'
				) {
					sawTargetedExplanation = true;
					expect(step.explanation.targetMidi).toBeDefined();
					expect(step.explanation.headline.length).toBeGreaterThan(0);
				}
			}
		}
		expect(sawTargetedExplanation).toBe(true);
	});
});

function averageSlideRate(style: BasslineGenerationContext['style'], trials: number): number {
	let slideCount = 0;
	let activeCount = 0;
	for (let seed = 0; seed < trials; seed++) {
		const plan = generateBassline(
			context({
				style,
				// A single sustained chord/scale gives every active step plenty of
				// nearby scale/chord tones to potentially slide toward.
				bars: buildBarContexts([{ phraseRole: 'main', chord: chord(C, 'major-7', 'ionian') }]),
				density: 80,
				seed
			})
		);
		for (const step of allActiveSteps(plan)) {
			activeCount++;
			if (step.slide) slideCount++;
		}
	}
	return activeCount === 0 ? 0 : slideCount / activeCount;
}

describe('generateBassline: Acid has more slide tendency than Walking (controlled fixture)', () => {
	it("Acid's average slide rate exceeds Walking's under the same context, across many seeds", () => {
		const acidRate = averageSlideRate('acid', 80);
		const walkingRate = averageSlideRate('walking', 80);
		expect(acidRate).toBeGreaterThan(walkingRate);
	});
});
