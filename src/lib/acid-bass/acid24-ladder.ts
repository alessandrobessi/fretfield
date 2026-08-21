/**
 * The Acid 24 filter's DSP core (~/Downloads/ACID-BASS-ENGINE-V2.md M10): a
 * cascaded 4-stage one-pole ladder with tanh-saturated global feedback --
 * the well-established "virtual analog ladder" approach (stable by
 * construction, no iterative solver to diverge), matching this file's own
 * "musically convincing, not circuit-accurate" ambition rather than a full
 * zero-delay-feedback Newton-iteration solve.
 *
 * This module exists to make that DSP math independently unit-testable
 * (`AudioWorkletProcessor` can't run inside Vitest's jsdom environment, which
 * has no Web Audio API at all). The actual runtime filter is a hand-authored
 * plain-JS `AudioWorkletProcessor` at `static/acid-filter-processor.js` --
 * deliberately dependency-free (no imports, not run through Vite's
 * bundler), so it re-implements this exact same algorithm rather than
 * importing this module. Keep the two in sync by hand if this file's math
 * ever changes.
 */

export interface Acid24LadderState {
	stage0: number;
	stage1: number;
	stage2: number;
	stage3: number;
}

export function createAcid24LadderState(): Acid24LadderState {
	return { stage0: 0, stage1: 0, stage2: 0, stage3: 0 };
}

/** A one-pole lowpass's per-sample coefficient for `cutoffHz` at `sampleRate` -- the standard `1 - e^(-2*pi*f/fs)` approximation, clamped to [0,1] (the range that keeps a single one-pole stage unconditionally stable). */
export function cutoffHzToOnePoleCoefficient(cutoffHz: number, sampleRate: number): number {
	const g = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
	return Math.min(1, Math.max(0, g));
}

/**
 * Processes one sample through the ladder, mutating `state` in place (the
 * hot path -- called once per sample, no allocation). `g` is the per-stage
 * one-pole coefficient (`cutoffHzToOnePoleCoefficient`), `resonance` the
 * feedback amount (spec: roughly 0-4, see `resolve.ts`'s
 * `resonanceToModelParameter`), `drive` a pregain applied before the input's
 * own saturation stage. Both the feedback path and the driven input are
 * passed through `Math.tanh`, which is what keeps every stage's output
 * bounded to roughly (-1, 1) regardless of how extreme `resonance` or
 * `drive` get -- the whole reason this topology can never produce NaN or an
 * unbounded runaway, even at self-oscillation.
 */
export function processAcid24LadderSample(
	state: Acid24LadderState,
	input: number,
	g: number,
	resonance: number,
	drive: number
): number {
	const feedback = resonance * Math.tanh(state.stage3);
	const driven = Math.tanh(input * drive - feedback);
	state.stage0 += g * (driven - state.stage0);
	state.stage1 += g * (state.stage0 - state.stage1);
	state.stage2 += g * (state.stage1 - state.stage2);
	state.stage3 += g * (state.stage2 - state.stage3);
	return state.stage3;
}
