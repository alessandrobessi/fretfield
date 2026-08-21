import { describe, expect, it } from 'vitest';

import { createEmptyAcidStep } from '../pattern';
import {
	clearPatternLocks,
	densifyPattern,
	octaveShiftPattern,
	rotatePatternLeft,
	rotatePatternRight,
	simplifyPattern
} from '../transforms';
import type { AcidBassPattern } from '../types';

function step(overrides: Partial<ReturnType<typeof createEmptyAcidStep>> = {}) {
	return { ...createEmptyAcidStep(), ...overrides };
}

describe('rotatePatternLeft / rotatePatternRight', () => {
	it('rotateLeft shifts every step one position earlier, wrapping the first to the end', () => {
		const pattern: AcidBassPattern = [
			step({ interval: '1' }),
			step({ interval: 'b3' }),
			step({ interval: '5' })
		];
		const rotated = rotatePatternLeft(pattern);
		expect(rotated.map((s) => s.interval)).toEqual(['b3', '5', '1']);
	});

	it('rotateRight shifts every step one position later, wrapping the last to the start', () => {
		const pattern: AcidBassPattern = [
			step({ interval: '1' }),
			step({ interval: 'b3' }),
			step({ interval: '5' })
		];
		const rotated = rotatePatternRight(pattern);
		expect(rotated.map((s) => s.interval)).toEqual(['5', '1', 'b3']);
	});

	it('rotateLeft then rotateRight is a no-op', () => {
		const pattern: AcidBassPattern = [
			step({ interval: '1' }),
			step({ interval: 'b3' }),
			step({ interval: '5' })
		];
		expect(rotatePatternRight(rotatePatternLeft(pattern))).toEqual(pattern);
	});

	it('handles an empty pattern without throwing', () => {
		expect(rotatePatternLeft([])).toEqual([]);
		expect(rotatePatternRight([])).toEqual([]);
	});
});

describe('simplifyPattern', () => {
	it('deactivates every other active step, in pattern order, leaving inactive steps untouched', () => {
		const pattern: AcidBassPattern = [
			step({ active: true }),
			step({ active: false }),
			step({ active: true }),
			step({ active: true }),
			step({ active: true })
		];
		const simplified = simplifyPattern(pattern);
		expect(simplified.map((s) => s.active)).toEqual([true, false, false, true, false]);
	});

	it('a fully inactive pattern stays fully inactive', () => {
		const pattern: AcidBassPattern = Array.from({ length: 4 }, () => step({ active: false }));
		expect(simplifyPattern(pattern).every((s) => !s.active)).toBe(true);
	});
});

describe('densifyPattern', () => {
	it('echoes each active step into the immediately following inactive step, same interval/octave', () => {
		const pattern: AcidBassPattern = [
			step({ active: true, interval: 'b7', octave: 1 }),
			step({ active: false }),
			step({ active: false })
		];
		const densified = densifyPattern(pattern);
		expect(densified[1].active).toBe(true);
		expect(densified[1].interval).toBe('b7');
		expect(densified[1].octave).toBe(1);
		expect(densified[1].accent).toBe(false);
		// Not chained -- the newly-added echo doesn't itself echo forward again
		// within the same pass (this function only reads the *original* pattern).
		expect(densified[2].active).toBe(false);
	});

	it('never overwrites an already-active step', () => {
		const pattern: AcidBassPattern = [
			step({ active: true, interval: '1' }),
			step({ active: true, interval: '5' })
		];
		expect(densifyPattern(pattern)).toEqual(pattern);
	});
});

describe('octaveShiftPattern', () => {
	it('shifts every active step up or down by one, leaving inactive steps untouched', () => {
		const pattern: AcidBassPattern = [
			step({ active: true, octave: 0 }),
			step({ active: false, octave: 0 })
		];
		const up = octaveShiftPattern(pattern, 1);
		expect(up[0].octave).toBe(1);
		expect(up[1].octave).toBe(0);
	});

	it('clamps at the -1..1 range rather than wrapping', () => {
		const pattern: AcidBassPattern = [step({ active: true, octave: 1 })];
		expect(octaveShiftPattern(pattern, 1)[0].octave).toBe(1);
		expect(octaveShiftPattern(pattern, -1)[0].octave).toBe(0);
	});
});

describe('clearPatternLocks', () => {
	it('removes locks from every step at once, leaving unlocked steps untouched', () => {
		const pattern: AcidBassPattern = [
			step({ locks: { cutoff: 50 } }),
			step({ locks: undefined }),
			step({ locks: { drive: 80, resonance: 20 } })
		];
		const cleared = clearPatternLocks(pattern);
		expect(cleared.every((s) => s.locks === undefined)).toBe(true);
	});
});
