/**
 * Scale Practice's drum machine voices — synthesized, not sampled (no
 * asset-loading pipeline), extending metronome.ts's single-click approach to
 * four distinct percussive sounds. Each trigger function builds a fresh
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
	gain.connect(ctx.destination);
	noise.start(time);
	noise.stop(time + durationSeconds);
}

/** A fast downward pitch sweep on a sine — the classic synthesized-kick envelope. */
export function triggerKick(ctx: AudioContext, time: number, gain = 1): void {
	const osc = ctx.createOscillator();
	const envelope = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(150, time);
	osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);
	envelope.gain.setValueAtTime(gain * 0.9, time);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
	osc.connect(envelope);
	envelope.connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.22);
}

/** Filtered noise for the body, plus a short tonal layer underneath so it doesn't read as pure hiss. */
export function triggerSnare(ctx: AudioContext, time: number, gain = 1): void {
	playNoiseBurst(ctx, time, { durationSeconds: 0.15, peakGain: gain * 0.5, highpassHz: 900 });

	const osc = ctx.createOscillator();
	const envelope = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(180, time);
	envelope.gain.setValueAtTime(gain * 0.3, time);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
	osc.connect(envelope);
	envelope.connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.1);
}

/** Closed vs. open hi-hat is purely a duration difference on the same highpassed-noise voice. */
export function triggerClosedHat(ctx: AudioContext, time: number, gain = 1): void {
	playNoiseBurst(ctx, time, { durationSeconds: 0.045, peakGain: gain * 0.25, highpassHz: 7000 });
}

export function triggerOpenHat(ctx: AudioContext, time: number, gain = 1): void {
	playNoiseBurst(ctx, time, { durationSeconds: 0.22, peakGain: gain * 0.22, highpassHz: 6000 });
}
