/**
 * Pure context-construction helpers for the bassline generator (spec §9).
 * Deliberately Groove-agnostic -- `buildBarContexts` takes an already-
 * resolved per-bar `(phraseRole, chord)` sequence, not a `Groove` or a
 * progression; the actual Scale-Practice/Groove-aware adaptation (chord
 * index expansion across `barsPerChord`, `A/B/F/T` -> phrase-role mapping,
 * the LCM composite-cycle length) is `$lib/acid-bass/generation-context.ts`
 * (a later milestone), which *is* allowed to import Groove types because
 * it's the integration bridge -- this module must not (spec §45).
 */

import type {
	BassPhraseRole,
	BasslineBarContext,
	BasslineChordContext,
	BasslineGenerationContext
} from './types';

/** Standard integer LCM via GCD -- used by the later Groove-aware adapter to size the composite generation cycle (`lcm(progressionBars, arrangementBars)`, spec §9). Lives here rather than in that adapter file since it's generic math with zero Groove dependency, reusable wherever the bassline domain needs it. */
export function lcm(a: number, b: number): number {
	const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
	if (a === 0 || b === 0) return 0;
	return Math.abs(a * b) / gcd(Math.abs(a), Math.abs(b));
}

/**
 * Wraps a finite per-bar `(phraseRole, chord)` sequence into full
 * `BasslineBarContext[]`, filling in `previousChord`/`nextChord` with
 * wrap-around linkage: bar 0's `previousChord` is the *last* bar's chord,
 * and the last bar's `nextChord` is bar 0's chord (spec §18's "wrap-aware
 * turnaround resolution is allowed"). A single-bar sequence wraps to
 * itself for both -- musically correct for one repeating chord. An empty
 * sequence returns an empty array.
 */
export function buildBarContexts(
	entries: readonly { phraseRole: BassPhraseRole; chord: BasslineChordContext }[]
): BasslineBarContext[] {
	const count = entries.length;
	if (count === 0) return [];

	return entries.map((entry, barIndex) => {
		const previousChord = entries[(barIndex - 1 + count) % count].chord;
		const nextChord = entries[(barIndex + 1) % count].chord;
		return {
			barIndex,
			phraseRole: entry.phraseRole,
			chord: entry.chord,
			previousChord,
			nextChord
		};
	});
}

/**
 * Structural sanity check for an already-built `BasslineGenerationContext`
 * -- catches integration bugs (an empty bar list, a non-positive meter, an
 * inverted zone) early and loudly, before they cause confusing failures
 * deep inside the generation pipeline. This is an internal contract check,
 * not user-facing validation -- "no progression selected" is a product-level
 * state the UI/adapter layer handles by disabling generation with an
 * explanatory message (spec §9), not by throwing here.
 */
export function validateBasslineGenerationContext(context: BasslineGenerationContext): void {
	if (context.bars.length === 0) {
		throw new Error('BasslineGenerationContext: bars must not be empty');
	}
	if (!Number.isInteger(context.meter.stepsPerBar) || context.meter.stepsPerBar <= 0) {
		throw new Error('BasslineGenerationContext: meter.stepsPerBar must be a positive integer');
	}
	if (!Number.isInteger(context.meter.stepsPerBeatGroup) || context.meter.stepsPerBeatGroup <= 0) {
		throw new Error(
			'BasslineGenerationContext: meter.stepsPerBeatGroup must be a positive integer'
		);
	}
	if (context.tuning.length === 0) {
		throw new Error('BasslineGenerationContext: tuning must not be empty');
	}
	if (!Number.isInteger(context.fretCount) || context.fretCount < 0) {
		throw new Error('BasslineGenerationContext: fretCount must be a non-negative integer');
	}
	if (context.zone.minFret > context.zone.maxFret) {
		throw new Error('BasslineGenerationContext: zone.minFret must not exceed zone.maxFret');
	}
	for (const [key, value] of Object.entries({
		density: context.density,
		chromaticism: context.chromaticism,
		movement: context.movement,
		playability: context.playability
	})) {
		if (!Number.isFinite(value) || value < 0 || value > 100) {
			throw new Error(`BasslineGenerationContext: ${key} must be a finite number in 0-100`);
		}
	}
	if (!Number.isFinite(context.seed)) {
		throw new Error('BasslineGenerationContext: seed must be a finite number');
	}
}
