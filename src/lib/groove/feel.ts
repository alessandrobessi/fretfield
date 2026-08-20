import type { GrooveFeel } from './types';

/**
 * Maps the user-facing Feel + Amount controls onto the single numeric swing
 * percentage `pattern.ts`'s `stepOffsetMs` already knows how to apply --
 * "Straight" is always 0 regardless of `amount` (a straight groove ignores
 * a leftover Amount value rather than needing it reset), "Shuffle" and
 * "Swing" both pass `amount` straight through, since the timing math itself
 * doesn't distinguish them (see `GrooveFeel`'s doc comment).
 */
export function effectiveSwing(feel: GrooveFeel, amount: number): number {
	return feel === 'straight' ? 0 : amount;
}
