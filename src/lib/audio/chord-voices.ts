/**
 * Scale Practice's chord-backing voice — a warm sustained synthesized pad,
 * theory-free like drum-voices.ts (it takes plain frequencies and a
 * duration, never a chord/root/interval concept; the store resolves those
 * before calling in). The only sustained/harmonic sound in the app so far —
 * everything else in this directory is either percussive (drum-voices.ts)
 * or a single fixed click.
 */

const ATTACK_SECONDS = 0.45;
const RELEASE_SECONDS = 0.55;

// A slow, shared vibrato -- subtle, continuous pitch movement is what keeps
// a sustained synthesized tone from reading as static/"artificial"; nothing
// acoustic ever holds a pitch perfectly still.
const VIBRATO_RATE_HZ = 4.2;
const VIBRATO_DEPTH_CENTS = 3.5;

/**
 * Each tone is two gently detuned, slightly panned triangles (round, warm,
 * carrying the actual pitch) plus a very quiet sawtooth underneath for just
 * enough harmonic edge to keep the chord from sounding hollow -- leaning
 * this hard away from the saw's buzzier upper harmonics is most of what
 * separates "warm" from "synthetic" here.
 */
const LAYERS: { type: OscillatorType; detuneCents: number; gain: number; pan: number }[] = [
	{ type: 'triangle', detuneCents: -8, gain: 1, pan: -0.18 },
	{ type: 'triangle', detuneCents: 8, gain: 1, pan: 0.18 },
	{ type: 'sawtooth', detuneCents: 0, gain: 0.16, pan: 0 }
];

/**
 * A gentle `x - x^3/3`-style soft-clip curve: near-linear (transparent) for
 * quiet signals, rounding off only the loudest peaks. This is the classic
 * "analog warmth" trick -- shaving the sharpest edges off a waveform adds
 * low-order harmonic saturation instead of the harsh, static-sounding
 * high-order harmonics a perfectly linear synth tone has.
 */
function warmthCurve(): Float32Array<ArrayBuffer> {
	const samples = 256;
	const curve = new Float32Array(samples);
	for (let i = 0; i < samples; i++) {
		const x = (i / (samples - 1)) * 2 - 1;
		curve[i] = x - x ** 3 / 3;
	}
	return curve;
}

const WARMTH_CURVE = warmthCurve();

function playPadTone(
	ctx: AudioContext,
	time: number,
	frequencyHz: number,
	durationSeconds: number,
	peakGain: number,
	isBass: boolean
): void {
	const attack = Math.min(ATTACK_SECONDS, durationSeconds / 2);
	const release = Math.min(RELEASE_SECONDS, durationSeconds / 2);

	// One shared LFO drives every oscillator's vibrato together, rather than
	// each drifting independently -- keeps the chord sounding like one
	// instrument breathing, not several unrelated tones wobbling apart.
	const lfo = ctx.createOscillator();
	lfo.type = 'sine';
	lfo.frequency.setValueAtTime(VIBRATO_RATE_HZ, time);
	const lfoDepth = ctx.createGain();
	lfoDepth.gain.setValueAtTime(VIBRATO_DEPTH_CENTS, time);
	lfo.connect(lfoDepth);
	lfo.start(time);
	lfo.stop(time + durationSeconds);

	// A dark, rounded lowpass that blooms briefly brighter on the attack --
	// the way a struck or bowed note's overtones flare then settle -- before
	// resting at a warmer cutoff for the sustain, and closing further on the
	// release. Darker overall than a first pass at this (peaks under 1kHz
	// rather than above it).
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.Q.setValueAtTime(0.5, time);
	filter.frequency.setValueAtTime(550, time);
	filter.frequency.linearRampToValueAtTime(950, time + attack);
	filter.frequency.setValueAtTime(950, time + durationSeconds - release);
	filter.frequency.linearRampToValueAtTime(480, time + durationSeconds);

	const shaper = ctx.createWaveShaper();
	shaper.curve = WARMTH_CURVE;
	shaper.oversample = '2x';

	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0.0001, time);
	envelope.gain.exponentialRampToValueAtTime(peakGain, time + attack);
	envelope.gain.setValueAtTime(peakGain, time + durationSeconds - release);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds);
	shaper.connect(envelope);
	envelope.connect(ctx.destination);
	filter.connect(shaper);

	for (const layer of LAYERS) {
		const osc = ctx.createOscillator();
		osc.type = layer.type;
		osc.frequency.setValueAtTime(frequencyHz, time);
		osc.detune.setValueAtTime(layer.detuneCents, time);
		lfoDepth.connect(osc.detune);

		const layerGain = ctx.createGain();
		layerGain.gain.setValueAtTime(layer.gain, time);
		const panner = ctx.createStereoPanner();
		panner.pan.setValueAtTime(layer.pan, time);

		osc.connect(layerGain);
		layerGain.connect(panner);
		panner.connect(filter);

		osc.start(time);
		osc.stop(time + durationSeconds);
	}

	// A quiet sine an octave down, only on the chord's lowest tone -- real
	// warmth comes from low-end body, but adding it under every tone would
	// just muddy a 4-note chord.
	if (isBass) {
		const sub = ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(frequencyHz / 2, time);
		const subGain = ctx.createGain();
		subGain.gain.setValueAtTime(0.5, time);
		sub.connect(subGain);
		subGain.connect(filter);
		sub.start(time);
		sub.stop(time + durationSeconds);
	}
}

/**
 * Plays every tone of a chord together as a sustained pad, held for
 * `durationSeconds`. `gain` scales the whole chord's overall level (each
 * individual tone gets a smaller share so a 4-note chord doesn't clip).
 */
export function triggerChordPad(
	ctx: AudioContext,
	time: number,
	frequenciesHz: readonly number[],
	durationSeconds: number,
	gain = 1
): void {
	if (frequenciesHz.length === 0) return;
	const perToneGain = (gain * 0.5) / frequenciesHz.length;
	const bassFrequencyHz = Math.min(...frequenciesHz);
	for (const frequencyHz of frequenciesHz) {
		playPadTone(
			ctx,
			time,
			frequencyHz,
			durationSeconds,
			perToneGain,
			frequencyHz === bassFrequencyHz
		);
	}
}
