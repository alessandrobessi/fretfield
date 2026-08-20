import { describe, expect, it } from 'vitest';
import { effectiveSwing } from '../feel';

describe('effectiveSwing', () => {
	it('is always 0 for straight, regardless of amount', () => {
		expect(effectiveSwing('straight', 0)).toBe(0);
		expect(effectiveSwing('straight', 80)).toBe(0);
	});

	it('passes amount through unchanged for shuffle', () => {
		expect(effectiveSwing('shuffle', 65)).toBe(65);
	});

	it('passes amount through unchanged for swing', () => {
		expect(effectiveSwing('swing', 70)).toBe(70);
	});
});
