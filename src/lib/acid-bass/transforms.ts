/**
 * Basic, pattern-wide Acid Bass transforms (~/Downloads/ACID-BASS-ENGINE-V2.md
 * design call: "basic pattern transforms are in scope; chord/scale-aware
 * transforms are explicitly deferred, outside the initial DSP milestone").
 * Each takes one role's whole pattern and returns a new one -- same
 * immutable-mutator shape as `pattern.ts`'s per-step setters, just operating
 * on every step at once. Deliberately simple, deterministic operations, not
 * musically "smart" ones: none of these look at harmony, the current chord,
 * or anything outside the pattern itself.
 */

import type { AcidBassPattern, AcidOctaveOffset } from './types';
import { createEmptyAcidStep } from './pattern';

/** Shifts every step one position earlier, wrapping the first step around to the end. */
export function rotatePatternLeft(pattern: AcidBassPattern): AcidBassPattern {
	if (pattern.length === 0) return pattern;
	return [...pattern.slice(1), pattern[0]];
}

/** Shifts every step one position later, wrapping the last step around to the start. */
export function rotatePatternRight(pattern: AcidBassPattern): AcidBassPattern {
	if (pattern.length === 0) return pattern;
	return [pattern[pattern.length - 1], ...pattern.slice(0, -1)];
}

/** Thins the pattern by deactivating every other currently-active step, in pattern order -- a deliberately simple, position-based thinning, not a "keep the strongest hits" musical judgment. */
export function simplifyPattern(pattern: AcidBassPattern): AcidBassPattern {
	let activeSeen = 0;
	return pattern.map((step) => {
		if (!step.active) return step;
		activeSeen += 1;
		return activeSeen % 2 === 0 ? createEmptyAcidStep() : step;
	});
}

/** Thickens the pattern by echoing each active step into the immediately following inactive one (same interval/octave, unaccented, no slide/locks) -- the mechanical inverse of `simplifyPattern`, not a "add a musically sensible passing tone" judgment. */
export function densifyPattern(pattern: AcidBassPattern): AcidBassPattern {
	return pattern.map((step, index) => {
		if (step.active) return step;
		const previous = pattern[index - 1];
		if (previous === undefined || !previous.active) return step;
		return {
			...createEmptyAcidStep(),
			active: true,
			interval: previous.interval,
			octave: previous.octave
		};
	});
}

/** Shifts every active step's octave by one, clamped to the -1..1 range every step already respects -- steps already at the clamp simply stay put rather than wrapping. */
export function octaveShiftPattern(pattern: AcidBassPattern, direction: 1 | -1): AcidBassPattern {
	return pattern.map((step) => {
		if (!step.active) return step;
		const nextOctave = Math.min(1, Math.max(-1, step.octave + direction)) as AcidOctaveOffset;
		return nextOctave === step.octave ? step : { ...step, octave: nextOctave };
	});
}

/** Removes every step's parameter locks at once -- the pattern-wide counterpart to `pattern.ts`'s per-step `clearAcidStepLocks`. */
export function clearPatternLocks(pattern: AcidBassPattern): AcidBassPattern {
	return pattern.map((step) => (step.locks === undefined ? step : { ...step, locks: undefined }));
}
