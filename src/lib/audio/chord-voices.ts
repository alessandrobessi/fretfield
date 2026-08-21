/**
 * Scale Practice's chord-backing voice — a warm sustained synthesized pad,
 * theory-free like drum-voices.ts (it takes plain frequencies and a
 * duration, never a chord/root/interval concept; the store resolves those
 * before calling in). The only sustained/harmonic sound in the app so far —
 * everything else in this directory is either percussive (drum-voices.ts)
 * or a single fixed click.
 */

const ATTACK_SECONDS = 0.35;
const RELEASE_SECONDS = 0.45;

// A slow, shared vibrato -- subtle, continuous pitch movement is what keeps
// a sustained synthesized tone from reading as static/"artificial"; nothing
// acoustic ever holds a pitch perfectly still.
const VIBRATO_RATE_HZ = 4.5;
const VIBRATO_DEPTH_CENTS = 3.5;

/**
 * Each tone is three gently detuned oscillators mixed together, not an
 * equal-gain saw+triangle pair — two round triangles (a few cents apart,
 * for width without beating too fast to sound pleasant) carry the actual
 * warmth, and a quiet sawtooth underneath adds just enough harmonic edge to
 * keep the chord from sounding hollow. Leaning the mix toward the triangles
 * (and away from the saw's buzzier upper harmonics) is what makes this read
 * as warm rather than synthetic.
 */
const LAYERS: { type: OscillatorType; detuneCents: number; gain: number }[] = [
	{ type: 'triangle', detuneCents: -8, gain: 0.9 },
	{ type: 'triangle', detuneCents: 8, gain: 0.9 },
	{ type: 'sawtooth', detuneCents: 0, gain: 0.3 }
];

function playPadTone(
	ctx: AudioContext,
	time: number,
	frequencyHz: number,
	durationSeconds: number,
	peakGain: number
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
	// release.
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.Q.setValueAtTime(0.6, time);
	filter.frequency.setValueAtTime(700, time);
	filter.frequency.linearRampToValueAtTime(1100, time + attack);
	filter.frequency.setValueAtTime(1100, time + durationSeconds - release);
	filter.frequency.linearRampToValueAtTime(650, time + durationSeconds);

	const envelope = ctx.createGain();
	envelope.gain.setValueAtTime(0.0001, time);
	envelope.gain.exponentialRampToValueAtTime(peakGain, time + attack);
	envelope.gain.setValueAtTime(peakGain, time + durationSeconds - release);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds);
	filter.connect(envelope);
	envelope.connect(ctx.destination);

	for (const layer of LAYERS) {
		const osc = ctx.createOscillator();
		osc.type = layer.type;
		osc.frequency.setValueAtTime(frequencyHz, time);
		osc.detune.setValueAtTime(layer.detuneCents, time);
		lfoDepth.connect(osc.detune);

		const layerGain = ctx.createGain();
		layerGain.gain.setValueAtTime(layer.gain, time);
		osc.connect(layerGain);
		layerGain.connect(filter);

		osc.start(time);
		osc.stop(time + durationSeconds);
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
	for (const frequencyHz of frequenciesHz) {
		playPadTone(ctx, time, frequencyHz, durationSeconds, perToneGain);
	}
}
