import { describe, expect, it } from 'vitest';

import { createBasslineRandom, toUint32Seed } from '../random';

describe('toUint32Seed', () => {
	it('passes through an already-valid uint32', () => {
		expect(toUint32Seed(12345)).toBe(12345);
	});

	it('coerces a negative number the standard JS >>> 0 way', () => {
		expect(toUint32Seed(-1)).toBe(4294967295);
	});
});

describe('createBasslineRandom: determinism', () => {
	it('produces the exact same sequence for the same seed (golden, seed 1)', () => {
		const random = createBasslineRandom(1);
		const sequence = [random.next(), random.next(), random.next(), random.next(), random.next()];
		expect(sequence).toEqual([
			0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
			0.9683778982143849
		]);
	});

	it('produces the exact same sequence for the same seed (golden, the default generation seed 0x303303)', () => {
		const random = createBasslineRandom(0x303303);
		const sequence = [random.next(), random.next(), random.next()];
		expect(sequence).toEqual([0.22883097711019218, 0.5189446283038706, 0.1878905484918505]);
	});

	it('two independent instances with the same seed produce identical sequences', () => {
		const a = createBasslineRandom(42);
		const b = createBasslineRandom(42);
		for (let i = 0; i < 20; i++) {
			expect(a.next()).toBe(b.next());
		}
	});

	it('different seeds produce different sequences', () => {
		const a = createBasslineRandom(1);
		const b = createBasslineRandom(2);
		expect(a.next()).not.toBe(b.next());
	});

	it('coerces a negative/non-uint32 seed to uint32 before seeding, same as toUint32Seed', () => {
		const a = createBasslineRandom(-1);
		const b = createBasslineRandom(toUint32Seed(-1));
		expect(a.next()).toBe(b.next());
	});
});

describe('createBasslineRandom: next', () => {
	it('always stays within [0, 1)', () => {
		const random = createBasslineRandom(7);
		for (let i = 0; i < 500; i++) {
			const value = random.next();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe('createBasslineRandom: nextInt', () => {
	it('always stays within [0, max)', () => {
		const random = createBasslineRandom(7);
		for (let i = 0; i < 500; i++) {
			const value = random.nextInt(6);
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(6);
		}
	});

	it('returns 0 for a non-positive max', () => {
		const random = createBasslineRandom(7);
		expect(random.nextInt(0)).toBe(0);
		expect(random.nextInt(-5)).toBe(0);
	});
});

describe('createBasslineRandom: chance', () => {
	it('0% never succeeds, 100% always succeeds', () => {
		const random = createBasslineRandom(99);
		for (let i = 0; i < 50; i++) {
			expect(random.chance(0)).toBe(false);
		}
		for (let i = 0; i < 50; i++) {
			expect(random.chance(100)).toBe(true);
		}
	});

	it('is deterministic for a given seed and call order', () => {
		const a = createBasslineRandom(5);
		const b = createBasslineRandom(5);
		const resultsA = Array.from({ length: 30 }, () => a.chance(50));
		const resultsB = Array.from({ length: 30 }, () => b.chance(50));
		expect(resultsA).toEqual(resultsB);
		// Not a coin-flip-perfect assertion, just confirms both true/false
		// actually occur across 30 draws at 50% -- catches a badly-broken
		// "always true"/"always false" implementation.
		expect(resultsA.some(Boolean)).toBe(true);
		expect(resultsA.some((v) => !v)).toBe(true);
	});
});

describe('createBasslineRandom: pick', () => {
	it('always returns one of the supplied items', () => {
		const random = createBasslineRandom(3);
		const items = ['a', 'b', 'c', 'd'] as const;
		for (let i = 0; i < 100; i++) {
			expect(items).toContain(random.pick(items));
		}
	});

	it('throws on an empty array rather than returning undefined', () => {
		const random = createBasslineRandom(3);
		expect(() => random.pick([])).toThrow();
	});

	it('is deterministic for a given seed and call order', () => {
		const items = ['a', 'b', 'c', 'd', 'e'] as const;
		const a = createBasslineRandom(11);
		const b = createBasslineRandom(11);
		const picksA = Array.from({ length: 10 }, () => a.pick(items));
		const picksB = Array.from({ length: 10 }, () => b.pick(items));
		expect(picksA).toEqual(picksB);
	});
});
