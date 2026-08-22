import { describe, expect, it } from 'vitest';

import { normalizePitchClass } from '$lib/music/pitch';
import type { PitchClass } from '$lib/music/pitch';

import type { BassPitchCandidate } from '../candidates';
import { createBasslineRandom } from '../random';
import type { BasslineRandom } from '../random';
import { getBasslineStyleProfile } from '../styles';
import { pitchClassDistance, selectVoiceLeadingSequence, transitionReward } from '../voice-leading';
import type { VoiceLeadingSlotInput } from '../voice-leading';

const C = normalizePitchClass(0);
const D = normalizePitchClass(2);
const E = normalizePitchClass(4);
const F = normalizePitchClass(5);
const G = normalizePitchClass(7);
const A_SHARP = normalizePitchClass(10);
const B = normalizePitchClass(11);
const F_SHARP = normalizePitchClass(6);

const ROOTED_STYLE = getBasslineStyleProfile('rooted');

/** Deterministic stand-in for `BasslineRandom` -- `next()` always returns the
 * midpoint, so `selectVoiceLeadingSequence`'s score jitter is exactly zero
 * and every assertion below tests the score model itself, not the PRNG. */
function zeroJitterRandom(): BasslineRandom {
	return {
		next: () => 0.5,
		nextInt: () => 0,
		chance: () => false,
		pick: (items) => items[0]
	};
}

function candidate(
	pitchClass: PitchClass,
	localScore: number,
	overrides: Partial<BassPitchCandidate> = {}
): BassPitchCandidate {
	return {
		pitchClass,
		intervalFromChord: '1',
		intervalFromKey: '1',
		harmonicRole: 'stable',
		source: 'chord',
		localScore,
		...overrides
	};
}

describe('pitchClassDistance', () => {
	it('is 0 for a common tone', () => {
		expect(pitchClassDistance(G, G)).toBe(0);
	});

	it('is symmetric and takes the shorter way around the octave', () => {
		expect(pitchClassDistance(C, B)).toBe(1); // C down to B is the same as B up to C
		expect(pitchClassDistance(B, C)).toBe(1);
		expect(pitchClassDistance(C, F_SHARP)).toBe(6); // the maximum possible circular distance
	});

	it("matches the spec's own worked examples", () => {
		expect(pitchClassDistance(B, C)).toBe(1); // G7's 3rd resolving to Cmaj7's root
		expect(pitchClassDistance(F, E)).toBe(1); // G7's b7 resolving to Cmaj7's 3rd
		expect(pitchClassDistance(D, E)).toBe(2); // whole-step motion
	});
});

describe('transitionReward', () => {
	it('strictly decreases as distance grows from 0 to 6', () => {
		const rewards = [0, 1, 2, 3, 4, 5, 6].map(transitionReward);
		for (let i = 1; i < rewards.length; i++) {
			expect(rewards[i]).toBeLessThanOrEqual(rewards[i - 1]);
		}
		expect(rewards[0]).toBeGreaterThan(rewards[6]);
	});

	it("rewards the spec's canonical G7 -> Cmaj7 resolutions strongly", () => {
		const commonTone = transitionReward(pitchClassDistance(G, G));
		const semitoneUp = transitionReward(pitchClassDistance(B, C)); // 3rd -> root
		const semitoneDown = transitionReward(pitchClassDistance(F, E)); // b7 -> 3rd
		const wholeStep = transitionReward(pitchClassDistance(D, E));
		const maxLeap = transitionReward(pitchClassDistance(C, F_SHARP));

		expect(commonTone).toBeGreaterThan(semitoneUp);
		expect(semitoneUp).toBe(semitoneDown); // both are 1-semitone resolutions
		expect(semitoneUp).toBeGreaterThan(wholeStep);
		expect(wholeStep).toBeGreaterThan(maxLeap);
	});
});

describe('selectVoiceLeadingSequence: shape', () => {
	it('returns one selection per slot, and [] for an empty sequence', () => {
		expect(
			selectVoiceLeadingSequence(
				[],
				{ harmonyMode: 'chord', style: ROOTED_STYLE },
				zeroJitterRandom()
			)
		).toEqual([]);

		const slot: VoiceLeadingSlotInput = {
			candidates: [candidate(C, 100)],
			isChordBoundary: false
		};
		const result = selectVoiceLeadingSequence(
			[slot, slot, slot],
			{ harmonyMode: 'chord', style: ROOTED_STYLE },
			zeroJitterRandom()
		);
		expect(result).toHaveLength(3);
	});

	it('is deterministic -- the same seed produces the same sequence', () => {
		const slots: VoiceLeadingSlotInput[] = [
			{
				candidates: [candidate(C, 100, { source: 'root' }), candidate(E, 60, { source: 'chord' })],
				isChordBoundary: true
			},
			{
				candidates: [candidate(G, 82, { source: 'chord' }), candidate(D, 58, { source: 'scale' })],
				isChordBoundary: false
			}
		];
		const a = selectVoiceLeadingSequence(
			slots,
			{ harmonyMode: 'voice-leading', style: ROOTED_STYLE },
			createBasslineRandom(7)
		);
		const b = selectVoiceLeadingSequence(
			slots,
			{ harmonyMode: 'voice-leading', style: ROOTED_STYLE },
			createBasslineRandom(7)
		);
		expect(a.map((c) => c.pitchClass)).toEqual(b.map((c) => c.pitchClass));
	});
});

describe('selectVoiceLeadingSequence: harmony modes', () => {
	it('Chord mode still favors the higher raw harmonic candidate even when it is the rougher transition', () => {
		const fixedPrevious: VoiceLeadingSlotInput = {
			candidates: [candidate(F, 90, { source: 'root', harmonicRole: 'root' })],
			isChordBoundary: false
		};
		const choice: VoiceLeadingSlotInput = {
			candidates: [
				candidate(C, 100, { source: 'root', harmonicRole: 'root' }), // 5 semitones from F -- a rougher move
				candidate(E, 90, { source: 'chord', harmonicRole: 'structural' }) // 1 semitone from F -- classic b7->3rd resolution
			],
			isChordBoundary: false
		};
		const [, chosen] = selectVoiceLeadingSequence(
			[fixedPrevious, choice],
			{ harmonyMode: 'chord', style: ROOTED_STYLE },
			zeroJitterRandom()
		);
		expect(chosen.pitchClass).toBe(C);
	});

	it('Voice Leading mode instead favors the smoother resolution over the higher raw harmonic candidate', () => {
		const fixedPrevious: VoiceLeadingSlotInput = {
			candidates: [candidate(F, 90, { source: 'root', harmonicRole: 'root' })],
			isChordBoundary: false
		};
		const choice: VoiceLeadingSlotInput = {
			candidates: [
				candidate(C, 100, { source: 'root', harmonicRole: 'root' }),
				candidate(E, 90, { source: 'chord', harmonicRole: 'structural' })
			],
			isChordBoundary: false
		};
		const [, chosen] = selectVoiceLeadingSequence(
			[fixedPrevious, choice],
			{ harmonyMode: 'voice-leading', style: ROOTED_STYLE },
			zeroJitterRandom()
		);
		expect(chosen.pitchClass).toBe(E);
	});

	it("Key mode rewards repeating the previous slot's key-relative motif over a higher raw local score", () => {
		const fixedPrevious: VoiceLeadingSlotInput = {
			candidates: [candidate(C, 90, { intervalFromKey: '3' })],
			isChordBoundary: false
		};
		const choice: VoiceLeadingSlotInput = {
			candidates: [
				candidate(D, 50, { intervalFromKey: '3' }), // repeats the motif, lower raw score
				candidate(A_SHARP, 55, { intervalFromKey: '5' }) // breaks the motif, higher raw score
			],
			isChordBoundary: false
		};

		const chordModeChoice = selectVoiceLeadingSequence(
			[fixedPrevious, choice],
			{ harmonyMode: 'chord', style: ROOTED_STYLE },
			zeroJitterRandom()
		)[1];
		expect(chordModeChoice.intervalFromKey).toBe('5'); // no motif bonus -- raw score wins

		const keyModeChoice = selectVoiceLeadingSequence(
			[fixedPrevious, choice],
			{ harmonyMode: 'key', style: ROOTED_STYLE },
			zeroJitterRandom()
		)[1];
		expect(keyModeChoice.intervalFromKey).toBe('3'); // motif bonus flips the choice
	});

	it('chord-boundary slots favor root/structural/stable candidates over a similarly-scored color/extension candidate', () => {
		const fixedPrevious: VoiceLeadingSlotInput = {
			candidates: [candidate(G, 90, { source: 'root', harmonicRole: 'root' })],
			isChordBoundary: false
		};
		const boundary: VoiceLeadingSlotInput = {
			candidates: [
				candidate(C, 80, { source: 'root', harmonicRole: 'root' }),
				candidate(D, 82, { source: 'scale', harmonicRole: 'extension' })
			],
			isChordBoundary: true
		};
		const [, chosen] = selectVoiceLeadingSequence(
			[fixedPrevious, boundary],
			{ harmonyMode: 'chord', style: ROOTED_STYLE },
			zeroJitterRandom()
		);
		expect(chosen.pitchClass).toBe(C);
	});
});
