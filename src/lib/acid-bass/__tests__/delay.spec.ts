import { describe, expect, it } from 'vitest';

import { delayDivisionToSeconds, delayFeedbackToGain, delayMixToSendGain } from '../delay';
import type { AcidDelayDivision } from '../types';

const ALL_DIVISIONS: AcidDelayDivision[] = ['1/4', '1/8', '1/8D', '1/8T', '1/16', '1/16D', '1/16T'];

describe('delayDivisionToSeconds: division math', () => {
	it('a quarter-note division is exactly one beat (60/bpm)', () => {
		expect(delayDivisionToSeconds(120, '1/4')).toBeCloseTo(60 / 120, 5);
		expect(delayDivisionToSeconds(60, '1/4')).toBeCloseTo(1, 5);
	});

	it('halving the division halves the delay time', () => {
		expect(delayDivisionToSeconds(120, '1/8')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/4') / 2,
			5
		);
		expect(delayDivisionToSeconds(120, '1/16')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/8') / 2,
			5
		);
	});

	it('a dotted division is 1.5x its straight counterpart', () => {
		expect(delayDivisionToSeconds(120, '1/8D')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/8') * 1.5,
			5
		);
		expect(delayDivisionToSeconds(120, '1/16D')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/16') * 1.5,
			5
		);
	});

	it('a triplet division is 2/3 its straight counterpart, and faster (shorter) than it', () => {
		expect(delayDivisionToSeconds(120, '1/8T')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/8') * (2 / 3),
			5
		);
		expect(delayDivisionToSeconds(120, '1/8T')).toBeLessThan(delayDivisionToSeconds(120, '1/8'));
	});

	it('scales inversely with BPM at a fixed division -- doubling BPM halves the delay time', () => {
		expect(delayDivisionToSeconds(240, '1/4')).toBeCloseTo(
			delayDivisionToSeconds(120, '1/4') / 2,
			5
		);
	});

	it('every division stays finite and positive across a wide BPM range', () => {
		for (const division of ALL_DIVISIONS) {
			for (const bpm of [30, 60, 90, 120, 180, 300]) {
				const seconds = delayDivisionToSeconds(bpm, division);
				expect(Number.isFinite(seconds)).toBe(true);
				expect(seconds).toBeGreaterThan(0);
			}
		}
	});

	it('tempo update: re-deriving at a new BPM changes the result (this is the whole point of "no new clock" -- see setTempo() in acid-bass-voice.ts)', () => {
		const at90 = delayDivisionToSeconds(90, '1/8');
		const at140 = delayDivisionToSeconds(140, '1/8');
		expect(at90).not.toBeCloseTo(at140, 5);
	});
});

describe('delayFeedbackToGain: feedback safety', () => {
	it('0 resolves to 0 gain (no repeats)', () => {
		expect(delayFeedbackToGain(0)).toBe(0);
	});

	it('never reaches or exceeds unity gain, even at the maximum UI value', () => {
		expect(delayFeedbackToGain(100)).toBeLessThan(1);
	});

	it('is monotonically increasing with the UI value', () => {
		expect(delayFeedbackToGain(75)).toBeGreaterThan(delayFeedbackToGain(50));
		expect(delayFeedbackToGain(50)).toBeGreaterThan(delayFeedbackToGain(25));
	});

	it('clamps out-of-range input to the same 0-100 domain', () => {
		expect(delayFeedbackToGain(-50)).toBe(delayFeedbackToGain(0));
		expect(delayFeedbackToGain(500)).toBe(delayFeedbackToGain(100));
	});
});

describe('delayMixToSendGain: disabled/dry', () => {
	it('a mix of 0 sends nothing into the delay line -- reproduces dry output exactly', () => {
		expect(delayMixToSendGain(0)).toBe(0);
	});

	it('is linear across its 0-100 domain', () => {
		expect(delayMixToSendGain(50)).toBeCloseTo(0.5, 5);
		expect(delayMixToSendGain(100)).toBe(1);
	});

	it('clamps out-of-range input to the same 0-100 domain', () => {
		expect(delayMixToSendGain(-10)).toBe(0);
		expect(delayMixToSendGain(150)).toBe(1);
	});
});
