/**
 * The Acid Bass voice's single tempo-syncable LFO
 * (~/Downloads/ACID-BASS-ENGINE-V2.md M7) -- always emits a bipolar -1..1
 * signal at its own rate; depth/destination/enabled are entirely the
 * caller's concern (`acid-bass-voice.ts`), which scales and routes this
 * module's `output` onto whatever it's modulating. Free-running: starts once
 * at creation and is never retriggered per note (an LFO doesn't reset phase
 * on every strike -- that's what distinguishes it from an envelope).
 *
 * Built from four always-running sources crossfaded by shape, the same
 * "leave every option running, gain the inactive ones to zero" idiom
 * `acid-bass-voice.ts`'s own oscillator section uses for wave selection.
 * Three shapes (sine/triangle/square) are native `OscillatorNode` types.
 * Sample & Hold is fundamentally different -- a stepped, re-randomized
 * constant, not a continuous waveform -- so it's a `ConstantSourceNode`
 * whose value a tiny lookahead scheduler re-rolls once per LFO period. That
 * scheduler is scoped to just this one job and uses the same
 * `AudioContext.currentTime`-driven pattern `GrooveTransport` already
 * establishes elsewhere in this codebase (the JS timer only wakes the loop
 * up often enough to keep the schedule topped up; actual timing always comes
 * from the audio clock, not the timer's own accuracy).
 */

import { lfoRateHzClamp } from '$lib/acid-bass/resolve';
import type { AcidLfoShape } from '$lib/acid-bass/types';

const CROSSFADE_TIME_CONSTANT = 0.01;
const STOP_TAIL_SECONDS = 0.05;

// Sample & Hold's own re-randomization scheduler -- deliberately similar in
// spirit to (but much smaller than) `GrooveTransport`'s constants.
const SH_SCHEDULER_INTERVAL_MS = 50;
const SH_LOOKAHEAD_SECONDS = 0.3;

export interface AcidBassLfo {
	/** Always emits -1..1 -- connect this (through your own depth/destination scaling) onto whatever AudioParam you're modulating. */
	readonly output: AudioNode;
	setShape(shape: AcidLfoShape): void;
	setRateHz(hz: number): void;
	dispose(): void;
}

export function createAcidBassLfo(ctx: AudioContext): AcidBassLfo {
	const sineOsc = ctx.createOscillator();
	sineOsc.type = 'sine';
	const triangleOsc = ctx.createOscillator();
	triangleOsc.type = 'triangle';
	const squareOsc = ctx.createOscillator();
	squareOsc.type = 'square';
	const sampleHoldSource = ctx.createConstantSource();

	const sineGain = ctx.createGain();
	const triangleGain = ctx.createGain();
	const squareGain = ctx.createGain();
	const sampleHoldGain = ctx.createGain();
	const output = ctx.createGain();

	sineOsc.connect(sineGain);
	triangleOsc.connect(triangleGain);
	squareOsc.connect(squareGain);
	sampleHoldSource.connect(sampleHoldGain);
	sineGain.connect(output);
	triangleGain.connect(output);
	squareGain.connect(output);
	sampleHoldGain.connect(output);

	const startTime = ctx.currentTime;
	let currentShape: AcidLfoShape = 'sine';
	let currentRateHz = lfoRateHzClamp(2);

	function applyShapeGains(shape: AcidLfoShape, atTime: number, immediate: boolean): void {
		const set = (gain: GainNode, active: boolean) => {
			gain.gain.cancelScheduledValues(atTime);
			const target = active ? 1 : 0;
			if (immediate) gain.gain.setValueAtTime(target, atTime);
			else gain.gain.setTargetAtTime(target, atTime, CROSSFADE_TIME_CONSTANT);
		};
		set(sineGain, shape === 'sine');
		set(triangleGain, shape === 'triangle');
		set(squareGain, shape === 'square');
		set(sampleHoldGain, shape === 'sampleHold');
	}

	applyShapeGains(currentShape, startTime, true);
	sampleHoldSource.offset.setValueAtTime(0, startTime);
	for (const osc of [sineOsc, triangleOsc, squareOsc]) {
		osc.frequency.setValueAtTime(currentRateHz, startTime);
	}

	sineOsc.start(startTime);
	triangleOsc.start(startTime);
	squareOsc.start(startTime);
	sampleHoldSource.start(startTime);

	let disposed = false;
	let nextShStepTime = startTime;

	const schedulerHandle = setInterval(() => {
		if (disposed) return;
		while (nextShStepTime < ctx.currentTime + SH_LOOKAHEAD_SECONDS) {
			sampleHoldSource.offset.setValueAtTime(Math.random() * 2 - 1, nextShStepTime);
			nextShStepTime += 1 / currentRateHz;
		}
	}, SH_SCHEDULER_INTERVAL_MS);

	return {
		output,

		setShape(shape) {
			if (shape === currentShape) return;
			currentShape = shape;
			applyShapeGains(shape, ctx.currentTime, false);
		},

		setRateHz(hz) {
			currentRateHz = lfoRateHzClamp(hz);
			const atTime = ctx.currentTime;
			for (const osc of [sineOsc, triangleOsc, squareOsc]) {
				osc.frequency.cancelScheduledValues(atTime);
				osc.frequency.setValueAtTime(currentRateHz, atTime);
			}
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			clearInterval(schedulerHandle);
			const stopTime = ctx.currentTime + STOP_TAIL_SECONDS;
			sineOsc.stop(stopTime);
			triangleOsc.stop(stopTime);
			squareOsc.stop(stopTime);
			sampleHoldSource.stop(stopTime);
		}
	};
}
