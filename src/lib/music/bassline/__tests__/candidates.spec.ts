import { describe, expect, it } from 'vitest';

import { normalizePitchClass } from '$lib/music/pitch';

import { generateHarmonicCandidates, harmonicCandidateScore } from '../candidates';
import type { BasslineChordContext } from '../types';

const C = normalizePitchClass(0);
const D = normalizePitchClass(2);

const STRONG: { strongBeat: boolean; beatGroupStart: boolean } = {
	strongBeat: true,
	beatGroupStart: true
};
const WEAK: { strongBeat: boolean; beatGroupStart: boolean } = {
	strongBeat: false,
	beatGroupStart: false
};

function chordContext(chordId: string, scaleId: string | null, root = C): BasslineChordContext {
	return { root, chordId, scaleId };
}

describe('generateHarmonicCandidates: chord-required tones are always present', () => {
	it('C major (triad) includes root, 3, and 5 as chord/root-sourced candidates', () => {
		const candidates = generateHarmonicCandidates(chordContext('major', 'ionian'), C, STRONG);
		const chordTones = candidates.filter((c) => c.source === 'root' || c.source === 'chord');
		expect(chordTones.map((c) => c.intervalFromChord).sort()).toEqual(['1', '3', '5'].sort());
		expect(candidates.find((c) => c.intervalFromChord === '1')).toMatchObject({
			source: 'root',
			harmonicRole: 'root'
		});
		expect(candidates.find((c) => c.intervalFromChord === '3')).toMatchObject({
			harmonicRole: 'structural'
		});
		expect(candidates.find((c) => c.intervalFromChord === '5')).toMatchObject({
			harmonicRole: 'stable'
		});
	});

	it('Cmaj7 includes root, 3, 5, and 7 as chord-required tones', () => {
		const candidates = generateHarmonicCandidates(chordContext('major-7', 'ionian'), C, STRONG);
		const required = candidates.filter((c) => c.source === 'root' || c.source === 'chord');
		expect(required.map((c) => c.intervalFromChord).sort()).toEqual(['1', '3', '5', '7'].sort());
		expect(candidates.find((c) => c.intervalFromChord === '7')).toMatchObject({
			harmonicRole: 'structural'
		});
	});

	it('C7 (dominant) includes root, 3, 5, and b7', () => {
		const candidates = generateHarmonicCandidates(
			chordContext('dominant-7', 'mixolydian'),
			C,
			STRONG
		);
		const required = candidates.filter((c) => c.source === 'root' || c.source === 'chord');
		expect(required.map((c) => c.intervalFromChord).sort()).toEqual(['1', '3', '5', 'b7'].sort());
	});

	it('Dm7 includes root, b3, 5, and b7, all classified relative to D', () => {
		const candidates = generateHarmonicCandidates(chordContext('minor-7', 'dorian', D), D, STRONG);
		const required = candidates.filter((c) => c.source === 'root' || c.source === 'chord');
		expect(required.map((c) => c.intervalFromChord).sort()).toEqual(['1', '5', 'b3', 'b7'].sort());
		const root = required.find((c) => c.intervalFromChord === '1');
		const flat7 = required.find((c) => c.intervalFromChord === 'b7');
		expect(root?.pitchClass).toBe(D);
		expect(flat7?.pitchClass).toBe(normalizePitchClass(0)); // D + 10 semitones wraps to C
	});

	it('diminished (triad) includes root, b3, and #4', () => {
		const candidates = generateHarmonicCandidates(chordContext('diminished', 'locrian'), C, STRONG);
		const required = candidates.filter((c) => c.source === 'root' || c.source === 'chord');
		expect(required.map((c) => c.intervalFromChord).sort()).toEqual(['1', '#4', 'b3'].sort());
	});
});

describe('generateHarmonicCandidates: scale tones', () => {
	it('adds scale-only tones beyond the chord, sourced as "scale"', () => {
		const candidates = generateHarmonicCandidates(chordContext('major', 'ionian'), C, STRONG);
		const scaleOnly = candidates.filter((c) => c.source === 'scale');
		// Ionian over a plain major triad contributes 2, 4, 6, 7 (1/3/5 are
		// already chord tones and must not be duplicated as scale candidates).
		expect(scaleOnly.map((c) => c.intervalFromChord).sort()).toEqual(['2', '4', '6', '7'].sort());
	});

	it('an explicit null scale adds no scale-sourced candidates at all', () => {
		const candidates = generateHarmonicCandidates(chordContext('major', null), C, STRONG);
		expect(candidates.every((c) => c.source !== 'scale')).toBe(true);
		// Chord tones are still fully present -- clearing the scale never
		// removes chord-tone legality.
		expect(candidates.map((c) => c.intervalFromChord).sort()).toEqual(['1', '3', '5'].sort());
	});

	it('never emits an avoid-role candidate, from either the chord or the scale', () => {
		// Phrygian over a plain major triad includes b2, which is classified
		// 'avoid' for the major family -- it must not appear as a candidate.
		const candidates = generateHarmonicCandidates(chordContext('major', 'phrygian'), C, STRONG);
		expect(candidates.every((c) => c.harmonicRole !== 'avoid')).toBe(true);
		expect(candidates.some((c) => c.intervalFromChord === 'b2')).toBe(false);
	});
});

describe('generateHarmonicCandidates: intervalFromKey', () => {
	it('is computed relative to the tonic, independent of the chord root', () => {
		// D minor-7 chord over a C tonic: the chord root (D) is scale degree 2
		// relative to the C tonic, so intervalFromChord and intervalFromKey
		// must differ for the same pitch class.
		const candidates = generateHarmonicCandidates(chordContext('minor-7', 'dorian', D), C, STRONG);
		const rootCandidate = candidates.find((c) => c.source === 'root');
		expect(rootCandidate?.intervalFromChord).toBe('1');
		expect(rootCandidate?.intervalFromKey).toBe('2');
	});
});

describe('harmonicCandidateScore', () => {
	it('matches the spec table on weak slots (root highest, avoid strongly negative)', () => {
		expect(harmonicCandidateScore('root', '1', WEAK)).toBe(100);
		expect(harmonicCandidateScore('structural', '3', WEAK)).toBe(90);
		expect(harmonicCandidateScore('stable', '5', WEAK)).toBe(82);
		expect(harmonicCandidateScore('extension', '6', WEAK)).toBe(58);
		expect(harmonicCandidateScore('color', 'b3', WEAK)).toBe(42);
		expect(harmonicCandidateScore('tension', '4', WEAK)).toBe(22);
		expect(harmonicCandidateScore('alteration', '7', WEAK)).toBe(18);
		expect(harmonicCandidateScore('avoid', 'b2', WEAK)).toBeLessThan(-50);
	});

	it('avoid-role candidates never dominate strong-beat scoring -- every other role scores higher', () => {
		const avoidScore = harmonicCandidateScore('avoid', 'b2', STRONG);
		for (const role of [
			'root',
			'structural',
			'stable',
			'extension',
			'color',
			'tension',
			'alteration',
			'chromatic-approach'
		] as const) {
			expect(harmonicCandidateScore(role, '3', STRONG)).toBeGreaterThan(avoidScore);
		}
	});

	it('suppresses tension/alteration on strong slots relative to their weak-slot value', () => {
		expect(harmonicCandidateScore('tension', '4', STRONG)).toBeLessThan(
			harmonicCandidateScore('tension', '4', WEAK)
		);
		expect(harmonicCandidateScore('alteration', '7', STRONG)).toBeLessThan(
			harmonicCandidateScore('alteration', '7', WEAK)
		);
	});

	it('boosts root/structural/stable on strong slots relative to their weak-slot value', () => {
		expect(harmonicCandidateScore('root', '1', STRONG)).toBeGreaterThan(
			harmonicCandidateScore('root', '1', WEAK)
		);
		expect(harmonicCandidateScore('structural', '3', STRONG)).toBeGreaterThan(
			harmonicCandidateScore('structural', '3', WEAK)
		);
		expect(harmonicCandidateScore('stable', '5', STRONG)).toBeGreaterThan(
			harmonicCandidateScore('stable', '5', WEAK)
		);
	});

	it('root always outscores every other role on both strong and weak slots', () => {
		for (const slot of [STRONG, WEAK]) {
			const rootScore = harmonicCandidateScore('root', '1', slot);
			for (const role of [
				'structural',
				'stable',
				'extension',
				'color',
				'tension',
				'alteration',
				'chromatic-approach',
				'avoid'
			] as const) {
				expect(rootScore).toBeGreaterThan(harmonicCandidateScore(role, '3', slot));
			}
		}
	});
});
