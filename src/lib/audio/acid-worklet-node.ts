/**
 * Loads and constructs Acid Bass's two `AudioWorkletNode`s -- the Acid 24
 * filter (M10) and the live-PWM Pulse oscillator (M11) --
 * (~/Downloads/ACID-BASS-ENGINE-V2.md) -- base-aware, since this repo uses
 * `@sveltejs/adapter-static` with a configurable `BASE_PATH`, so the module
 * URL can't be a hardcoded root path (see `AppHeader.svelte`'s own
 * `${base}/...` convention for static assets).
 *
 * Neither ever throws outward: a browser without `AudioWorklet` support,
 * the static asset failing to fetch, or the processor failing to register
 * all resolve to `null` rather than a rejected promise or a user-facing
 * error -- `acid-bass-voice.ts` falls back to its existing non-worklet
 * approximation (the svf12-flavored Biquad filter; the regenerated
 * `PeriodicWave` pulse) whenever either returns `null`, logging only to the
 * console (spec: worklet unavailability is a dev-console diagnostic, never
 * something the player sees).
 */

import { base } from '$app/paths';

/** One input, one output, explicitly mono -- every node upstream in this voice is already effectively mono (see acid-bass-voice.ts), and AudioWorkletNode needs its channel count stated explicitly rather than inferred. */
function createFilterNode(ctx: AudioContext): AudioWorkletNode {
	return new AudioWorkletNode(ctx, 'acid-filter-processor', {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1]
	});
}

export async function createAcid24WorkletNode(ctx: AudioContext): Promise<AudioWorkletNode | null> {
	if (typeof ctx.audioWorklet === 'undefined') return null;
	try {
		await ctx.audioWorklet.addModule(`${base}/acid-filter-processor.js`);
		return createFilterNode(ctx);
	} catch (error) {
		console.error(
			'[acid-bass] acid24 worklet failed to load -- falling back to the svf12 approximation',
			error
		);
		return null;
	}
}

/** A source node -- no input, one mono output. */
function createPulseOscillatorNode(ctx: AudioContext): AudioWorkletNode {
	return new AudioWorkletNode(ctx, 'acid-pulse-oscillator-processor', {
		numberOfInputs: 0,
		numberOfOutputs: 1,
		outputChannelCount: [1]
	});
}

export async function createPulseOscillatorWorkletNode(
	ctx: AudioContext
): Promise<AudioWorkletNode | null> {
	if (typeof ctx.audioWorklet === 'undefined') return null;
	try {
		await ctx.audioWorklet.addModule(`${base}/acid-pulse-oscillator-processor.js`);
		return createPulseOscillatorNode(ctx);
	} catch (error) {
		console.error(
			'[acid-bass] pulse oscillator worklet failed to load -- falling back to the static PeriodicWave pulse',
			error
		);
		return null;
	}
}
