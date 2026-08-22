/**
 * The bassline generator's one deterministic random source (spec §10). The
 * pure generator must never call `Math.random()` -- every call site that
 * needs variation takes a `BasslineRandom` instance instead, so the same
 * context + seed always produces the same plan (spec §40's determinism
 * invariant). A UI action like "New Variation" may draw a fresh seed from
 * real browser entropy, but that happens *outside* this module, before a
 * seed is assigned -- never `Date.now()`/`Math.random()` inside generation
 * itself.
 *
 * Mulberry32: a small, stable, widely-used 32-bit PRNG -- simple enough to
 * hand-verify, fast enough to run synchronously in-browser (spec §46), and
 * good enough statistically for musically-varied (not cryptographic)
 * randomness.
 */

export interface BasslineRandom {
	/** [0, 1). */
	next(): number;
	/** [0, max) as an integer. `max <= 0` always returns 0. */
	nextInt(max: number): number;
	/** `percent` in 0-100. */
	chance(percent: number): boolean;
	/** Uniformly picks one element. Throws on an empty array -- an empty candidate list is always a caller bug, never a legitimate "no choice" case in this generator. */
	pick<T>(items: readonly T[]): T;
}

/** Unsigned 32-bit, per spec §10/§37 -- `>>> 0` is the standard JS coercion-to-uint32 trick. Deliberately duplicated (not imported) from `acid-bass/migrate.ts`'s own `coerceSeed` -- this module must never depend on `$lib/acid-bass/*` (spec §45's layering: acid-bass depends on music/bassline, never the reverse), and three lines isn't worth a shared-module detour across that boundary. */
export function toUint32Seed(value: number): number {
	return value >>> 0;
}

/** The Mulberry32 step function, closed over its own mutable 32-bit state -- the *only* mutable state in this module, fully contained inside the returned closure. */
function mulberry32(seed: number): () => number {
	let state = toUint32Seed(seed);
	return function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function createBasslineRandom(seed: number): BasslineRandom {
	const next = mulberry32(seed);
	return {
		next,
		nextInt(max) {
			if (max <= 0) return 0;
			return Math.min(max - 1, Math.floor(next() * max));
		},
		chance(percent) {
			return next() * 100 < percent;
		},
		pick(items) {
			if (items.length === 0) {
				throw new Error('BasslineRandom.pick: cannot pick from an empty array');
			}
			const index = Math.min(items.length - 1, Math.floor(next() * items.length));
			return items[index];
		}
	};
}
