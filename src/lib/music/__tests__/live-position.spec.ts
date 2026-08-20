import { describe, expect, it } from 'vitest';
import { inferLivePosition } from '../live-position';
import type { FretPosition } from '../fretboard';

function pos(stringIndex: number, fret: number): FretPosition {
	return { stringIndex, fret, pitchClass: 0 as FretPosition['pitchClass'] };
}

describe('inferLivePosition', () => {
	it('returns ambiguous with no candidates', () => {
		const result = inferLivePosition([]);
		expect(result).toEqual({
			candidates: [],
			likelyPosition: null,
			confidence: null,
			reason: 'ambiguous'
		});
	});

	it('a single candidate is certain', () => {
		const only = pos(0, 12);
		const result = inferLivePosition([only]);
		expect(result.reason).toBe('unique');
		expect(result.likelyPosition).toEqual(only);
		expect(result.confidence).toBe(1);
	});

	it('falls back to movement continuity when exactly one candidate is closest to the previous position', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const result = inferLivePosition(candidates, { previousLikelyPosition: pos(1, 8) });
		expect(result.reason).toBe('movement-continuity');
		expect(result.likelyPosition).toEqual(pos(1, 7));
	});

	it('stays ambiguous when two candidates tie for closest to the previous position', () => {
		const candidates = [pos(0, 10), pos(2, 10)];
		const result = inferLivePosition(candidates, { previousLikelyPosition: pos(1, 10) });
		expect(result.reason).toBe('ambiguous');
		expect(result.likelyPosition).toBeNull();
	});

	it('stays ambiguous with no context and multiple candidates, never guessing a string', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const result = inferLivePosition(candidates);
		expect(result.reason).toBe('ambiguous');
		expect(result.likelyPosition).toBeNull();
		expect(result.confidence).toBeNull();
		expect(result.candidates).toEqual(candidates);
	});
});
