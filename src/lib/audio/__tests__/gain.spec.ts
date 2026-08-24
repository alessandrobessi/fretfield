import { describe, expect, it } from 'vitest';

import { volumeToGain } from '../gain';

describe('volumeToGain', () => {
	it('is 0 at 0, capped below unity at 100 (headroom), and monotonic', () => {
		expect(volumeToGain(0)).toBe(0);
		expect(volumeToGain(100)).toBeLessThan(1);
		expect(volumeToGain(100)).toBeGreaterThan(0.5);
		expect(volumeToGain(75)).toBeGreaterThan(volumeToGain(25));
	});

	it('clamps out-of-range input to 0-100', () => {
		expect(volumeToGain(-50)).toBe(volumeToGain(0));
		expect(volumeToGain(500)).toBe(volumeToGain(100));
	});
});
