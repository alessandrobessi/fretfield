/**
 * The live-modulatable Pulse oscillator's DSP core (M11): a naive pulse
 * wave corrected with PolyBLEP (polynomial band-limited step) at both
 * discontinuities -- the standard, lightweight technique for taming the
 * aliasing a hard on/off pulse wave would otherwise produce, without a full
 * additive/wavetable oscillator.
 *
 * As with `acid24-ladder.ts`: this exists to make the algorithm
 * independently unit-testable (`AudioWorkletProcessor` can't run inside
 * Vitest's jsdom environment). The actual runtime oscillator is a
 * hand-authored plain-JS `AudioWorkletProcessor` at
 * `static/acid-pulse-oscillator-processor.js`, deliberately dependency-free
 * -- it re-implements this exact same algorithm rather than importing this
 * module. Keep the two in sync by hand if this file's math ever changes.
 */

/**
 * The PolyBLEP correction for a discontinuity at phase-distance `t` (0-1)
 * from the edge, given `dt` = one sample's worth of phase (frequency /
 * sampleRate). Zero everywhere except the one-sample-wide neighborhood
 * around each edge, where it smooths the otherwise-instantaneous jump.
 */
export function polyBlep(t: number, dt: number): number {
	if (dt <= 0) return 0;
	if (t < dt) {
		const x = t / dt;
		return x + x - x * x - 1;
	}
	if (t > 1 - dt) {
		const x = (t - 1) / dt;
		return x * x + x + x + 1;
	}
	return 0;
}

/**
 * One sample of a band-limited pulse wave at the given `phase` (0-1,
 * wrapping), `pulseWidth` (duty cycle, 0-1), and `phaseIncrement` (one
 * sample's worth of phase, i.e. `frequency / sampleRate`). Bounded to
 * roughly (-1.2, 1.2) -- the naive ±1 square step plus a small PolyBLEP
 * correction at each of its two edges.
 */
export function pulseOscillatorSample(
	phase: number,
	pulseWidth: number,
	phaseIncrement: number
): number {
	let value = phase < pulseWidth ? 1 : -1;
	value += polyBlep(phase, phaseIncrement);
	const fallEdgePhase = (phase + (1 - pulseWidth)) % 1;
	value -= polyBlep(fallEdgePhase, phaseIncrement);
	return value;
}

/** Advances `phase` by one sample at `frequencyHz`/`sampleRate`, wrapped back into [0, 1). */
export function advancePulsePhase(phase: number, frequencyHz: number, sampleRate: number): number {
	const next = phase + frequencyHz / sampleRate;
	return next - Math.floor(next);
}
