import { describe, expect, it } from 'vitest';

import {
	chorusDepthToSeconds,
	chorusMixToGain,
	chorusRateHzClamp,
	delayDivisionToSeconds,
	delayFeedbackToGain,
	delayMixToSendGain,
	reverbDampingToLowpassHz,
	reverbMixToGain,
	reverbSizeToFeedbackGain
} from '../resolve';

describe('reverb macros', () => {
	it('size 0 and 100 land at the documented feedback-gain floor/ceiling', () => {
		expect(reverbSizeToFeedbackGain(0)).toBeCloseTo(0.6);
		expect(reverbSizeToFeedbackGain(100)).toBeCloseTo(0.9);
	});

	it('feedback gain is monotonically increasing with size, and always below unity', () => {
		const values = [0, 25, 50, 75, 100].map(reverbSizeToFeedbackGain);
		for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
		for (const v of values) expect(v).toBeLessThan(1);
	});

	it('damping 0 is brightest (highest cutoff), damping 100 is darkest (lowest cutoff)', () => {
		expect(reverbDampingToLowpassHz(0)).toBeGreaterThan(reverbDampingToLowpassHz(100));
	});

	it('mix maps 0-100 to a 0-1 linear gain', () => {
		expect(reverbMixToGain(0)).toBe(0);
		expect(reverbMixToGain(100)).toBe(1);
		expect(reverbMixToGain(50)).toBeCloseTo(0.5);
	});

	it('every macro clamps out-of-range input', () => {
		expect(reverbSizeToFeedbackGain(-50)).toBe(reverbSizeToFeedbackGain(0));
		expect(reverbSizeToFeedbackGain(150)).toBe(reverbSizeToFeedbackGain(100));
		expect(reverbMixToGain(-10)).toBe(0);
		expect(reverbMixToGain(110)).toBe(1);
	});
});

describe('delay macros', () => {
	it('division-to-seconds is proportional to the beat fraction at a fixed tempo', () => {
		const quarterSeconds = delayDivisionToSeconds(120, '1/4');
		const eighthSeconds = delayDivisionToSeconds(120, '1/8');
		expect(eighthSeconds).toBeCloseTo(quarterSeconds / 2);
	});

	it('a dotted division is 1.5x its straight counterpart, a triplet is 2/3', () => {
		const straight = delayDivisionToSeconds(120, '1/8');
		expect(delayDivisionToSeconds(120, '1/8D')).toBeCloseTo(straight * 1.5);
		expect(delayDivisionToSeconds(120, '1/8T')).toBeCloseTo(straight * (2 / 3));
	});

	it('doubling the tempo halves every division length', () => {
		expect(delayDivisionToSeconds(160, '1/4')).toBeCloseTo(delayDivisionToSeconds(80, '1/4') / 2);
	});

	it('feedback gain never reaches unity, even at the maximum UI value', () => {
		expect(delayFeedbackToGain(100)).toBeLessThan(1);
		expect(delayFeedbackToGain(100)).toBeGreaterThan(0);
	});

	it('mix 0 sends nothing into the delay line (exactly dry)', () => {
		expect(delayMixToSendGain(0)).toBe(0);
		expect(delayMixToSendGain(100)).toBe(1);
	});
});

describe('chorus macros', () => {
	it('rate clamps to a slow, musically useful chorus range', () => {
		expect(chorusRateHzClamp(0)).toBeGreaterThan(0);
		expect(chorusRateHzClamp(1000)).toBeLessThan(10);
	});

	it('depth 0 means no delay-time swing at all', () => {
		expect(chorusDepthToSeconds(0)).toBe(0);
		expect(chorusDepthToSeconds(100)).toBeGreaterThan(0);
	});

	it('mix maps 0-100 to a 0-1 linear gain', () => {
		expect(chorusMixToGain(0)).toBe(0);
		expect(chorusMixToGain(100)).toBe(1);
	});
});
