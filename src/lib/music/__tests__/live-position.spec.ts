import { describe, expect, it } from 'vitest';
import { inferLivePosition } from '../live-position';
import type { FretPosition } from '../fretboard';
import type { FretboardRegion } from '../local-fields';

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

	it('prefers the position implied by a selected Voice-Leading Path over everything else', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const region: FretboardRegion = { id: 'r', minFret: 0, maxFret: 5 };
		const result = inferLivePosition(candidates, {
			voiceLeadingPathPosition: pos(1, 7),
			localFieldRegion: region,
			previousLikelyPosition: pos(0, 12)
		});
		expect(result.reason).toBe('voice-leading-path');
		expect(result.likelyPosition).toEqual(pos(1, 7));
	});

	it('falls back to the Local Field when it contains exactly one candidate', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const region: FretboardRegion = { id: 'r', minFret: 5, maxFret: 9 };
		const result = inferLivePosition(candidates, { localFieldRegion: region });
		expect(result.reason).toBe('local-field');
		expect(result.likelyPosition).toEqual(pos(1, 7));
	});

	it('does not use the Local Field when it contains more than one candidate', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const region: FretboardRegion = { id: 'r', minFret: 0, maxFret: 20 };
		const result = inferLivePosition(candidates, { localFieldRegion: region });
		expect(result.reason).toBe('ambiguous');
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

	it('voice-leading path context that does not match any candidate falls through to the next rule', () => {
		const candidates = [pos(0, 12), pos(1, 7), pos(2, 2)];
		const region: FretboardRegion = { id: 'r', minFret: 5, maxFret: 9 };
		const result = inferLivePosition(candidates, {
			voiceLeadingPathPosition: pos(3, 19), // not among the candidates
			localFieldRegion: region
		});
		expect(result.reason).toBe('local-field');
		expect(result.likelyPosition).toEqual(pos(1, 7));
	});
});
