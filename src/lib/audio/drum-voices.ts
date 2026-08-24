/**
 * Scale Practice's Groove Engine voices — synthesized, not sampled (no
 * asset-loading pipeline), extending metronome.ts's single-click approach to
 * a six-voice kit (kick/snare/closed hat/open hat/ride/rim). Each trigger
 * function builds a fresh
 * oscillator/noise-buffer graph per hit (cheap, no reuse — the same pattern
 * the old click used), scheduled at a precise `AudioContext.currentTime` by
 * the lookahead scheduler in scale-practice.svelte.ts.
 */

export type AudioContextConstructor = new () => AudioContext;

export function resolveAudioContextConstructor(): AudioContextConstructor | null {
	if (typeof window === 'undefined') return null;
	const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
	return withWebkit.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

// A shared white-noise buffer, created once per AudioContext and reused
// across every snare/hat hit — buffer creation is the expensive part;
// playback via a fresh AudioBufferSourceNode per hit is cheap and standard.
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
	const cached = noiseBuffers.get(ctx);
	if (cached) return cached;

	const durationSeconds = 1;
	const buffer = ctx.createBuffer(1, ctx.sampleRate * durationSeconds, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	noiseBuffers.set(ctx, buffer);
	return buffer;
}

function playNoiseBurst(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	options: { durationSeconds: number; peakGain: number; highpassHz: number }
): void {
	const { durationSeconds, peakGain, highpassHz } = options;
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);

	const filter = ctx.createBiquadFilter();
	filter.type = 'highpass';
	filter.frequency.setValueAtTime(highpassHz, time);

	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, time);
	gain.gain.exponentialRampToValueAtTime(peakGain, time + 0.001);
	gain.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds);

	noise.connect(filter);
	filter.connect(gain);
	gain.connect(destinationNode);
	noise.start(time);
	noise.stop(time + durationSeconds);
}

/** A fast downward pitch sweep on a sine — the classic synthesized-kick envelope. */
export function triggerKick(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	const osc = ctx.createOscillator();
	const envelope = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(150, time);
	osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);
	envelope.gain.setValueAtTime(gain * 0.9, time);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
	osc.connect(envelope);
	envelope.connect(destinationNode);
	osc.start(time);
	osc.stop(time + 0.22);
}

/** Filtered noise for the body, plus a short tonal layer underneath so it doesn't read as pure hiss. */
export function triggerSnare(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	playNoiseBurst(ctx, destinationNode, time, {
		durationSeconds: 0.15,
		peakGain: gain * 0.5,
		highpassHz: 900
	});

	const osc = ctx.createOscillator();
	const envelope = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(180, time);
	envelope.gain.setValueAtTime(gain * 0.3, time);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
	osc.connect(envelope);
	envelope.connect(destinationNode);
	osc.start(time);
	osc.stop(time + 0.1);
}

/** Closed vs. open hi-hat is purely a duration difference on the same highpassed-noise voice. */
export function triggerClosedHat(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	playNoiseBurst(ctx, destinationNode, time, {
		durationSeconds: 0.045,
		peakGain: gain * 0.25,
		highpassHz: 7000
	});
}

export function triggerOpenHat(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	playNoiseBurst(ctx, destinationNode, time, {
		durationSeconds: 0.22,
		peakGain: gain * 0.22,
		highpassHz: 6000
	});
}

/**
 * A longer, brighter noise wash than the open hat, plus a couple of
 * inharmonic sine partials layered on top for the metallic "ping" a real
 * ride cymbal has -- the same trick real cymbal synthesis uses (non-integer
 * overtone ratios), without needing FM or physical modeling.
 */
export function triggerRide(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	playNoiseBurst(ctx, destinationNode, time, {
		durationSeconds: 0.5,
		peakGain: gain * 0.16,
		highpassHz: 5000
	});

	for (const frequencyHz of [523.3, 1108.7]) {
		const osc = ctx.createOscillator();
		const envelope = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(frequencyHz, time);
		envelope.gain.setValueAtTime(gain * 0.05, time);
		envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
		osc.connect(envelope);
		envelope.connect(destinationNode);
		osc.start(time);
		osc.stop(time + 0.4);
	}
}

/** A short, sharp click -- tighter and higher-pitched than the snare's own tonal layer, for a cross-stick/rim-click sound. */
export function triggerRim(
	ctx: AudioContext,
	destinationNode: AudioNode,
	time: number,
	gain = 1
): void {
	playNoiseBurst(ctx, destinationNode, time, {
		durationSeconds: 0.03,
		peakGain: gain * 0.2,
		highpassHz: 3000
	});

	const osc = ctx.createOscillator();
	const envelope = ctx.createGain();
	osc.type = 'square';
	osc.frequency.setValueAtTime(420, time);
	envelope.gain.setValueAtTime(gain * 0.25, time);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
	osc.connect(envelope);
	envelope.connect(destinationNode);
	osc.start(time);
	osc.stop(time + 0.04);
}
