import { describe, expect, it } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';

import { recommendBasslineStyles } from '../recommendations';
import type { BasslineChordContext } from '../types';

const C = noteNameToPitchClass('C');
const D = noteNameToPitchClass('D');
const F = noteNameToPitchClass('F');
const G = noteNameToPitchClass('G');

function chord(
	root: ReturnType<typeof noteNameToPitchClass>,
	chordId: string
): BasslineChordContext {
	return { root, chordId, scaleId: null };
}

describe('recommendBasslineStyles: no progression', () => {
	it('returns [] for an empty chord sequence', () => {
		expect(recommendBasslineStyles([])).toEqual([]);
	});
});

describe('recommendBasslineStyles: dominant-heavy fixture', () => {
	it('a 12-bar-blues-shaped progression (all dominant-7) favors funk/walking/chromatic/acid', () => {
		const chords = [
			chord(C, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(F, 'dominant-7'),
			chord(F, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(G, 'dominant-7'),
			chord(F, 'dominant-7'),
			chord(C, 'dominant-7'),
			chord(C, 'dominant-7')
		];
		const recommendations = recommendBasslineStyles(chords);
		const styles = recommendations.map((r) => r.style);
		expect(styles).toEqual(['funk', 'rooted', 'acid', 'walking', 'chromatic']);
		expect(recommendations[0].reason).toContain('Dominant-heavy');
	});
});

describe('recommendBasslineStyles: minor -> dominant -> major fixture', () => {
	it('a ii-V-I progression favors walking/melodic/chromatic', () => {
		const chords = [chord(D, 'minor-7'), chord(G, 'dominant-7'), chord(C, 'major-7')];
		const recommendations = recommendBasslineStyles(chords);
		const styles = recommendations.map((r) => r.style);
		expect(styles).toEqual(['walking', 'melodic', 'chromatic']);
		expect(recommendations[0].reason).toContain('ii-V-I-like');
	});

	it('does not fire on a progression that never actually sequences minor -> dominant -> major', () => {
		const chords = [chord(C, 'major-7'), chord(D, 'minor-7'), chord(G, 'dominant-7')];
		const recommendations = recommendBasslineStyles(chords);
		expect(recommendations.every((r) => !r.reason.includes('ii-V-I-like'))).toBe(true);
	});
});

describe('recommendBasslineStyles: static/single-family harmony fixture', () => {
	it('a progression that never leaves the major family favors rooted/funk/acid', () => {
		const chords = [chord(C, 'major'), chord(F, 'major-7'), chord(G, 'major')];
		const recommendations = recommendBasslineStyles(chords);
		const styles = recommendations.map((r) => r.style);
		expect(styles).toEqual(['rooted', 'funk', 'acid']);
		expect(recommendations[0].reason).toContain('Static harmony');
	});
});

describe('recommendBasslineStyles: deterministic ranking', () => {
	it('the same chord sequence always produces the same ranked list', () => {
		const chords = [chord(D, 'minor-7'), chord(G, 'dominant-7'), chord(C, 'major-7')];
		expect(recommendBasslineStyles(chords)).toEqual(recommendBasslineStyles(chords));
	});

	it('scores accumulate additively when more than one heuristic matches the same style', () => {
		// All-dominant-7 is both "dominant-heavy" AND "static/single-family" --
		// funk and acid appear in both heuristics' style lists.
		const chords = [chord(C, 'dominant-7'), chord(C, 'dominant-7'), chord(C, 'dominant-7')];
		const recommendations = recommendBasslineStyles(chords);
		const byStyle = Object.fromEntries(recommendations.map((r) => [r.style, r.score]));

		// funk: dominant-heavy rank 0 (40) + static rank 1 (30) = 70
		expect(byStyle.funk).toBe(70);
		// acid: dominant-heavy rank 3 (10) + static rank 2 (20) = 30
		expect(byStyle.acid).toBe(30);
		// rooted only matches the static heuristic, at rank 0 (40).
		expect(byStyle.rooted).toBe(40);
		expect(byStyle.funk).toBeGreaterThan(byStyle.rooted);
	});
});
