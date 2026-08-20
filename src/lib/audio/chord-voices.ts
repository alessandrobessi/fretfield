/**
 * Scale Practice's chord-backing voice — a sustained synthesized pad,
 * theory-free like drum-voices.ts (it takes plain frequencies and a
 * duration, never a chord/root/interval concept; the store resolves those
 * before calling in). The only sustained/harmonic sound in the app so far —
 * everything else in this directory is either percussive (drum-voices.ts)
 * or a single fixed click.
 */

const ATTACK_SECONDS = 0.15;
const RELEASE_SECONDS = 0.3;

function playPadTone(
	ctx: AudioContext,
	time: number,
	frequencyHz: number,
	durationSeconds: number,
	peakGain: number
): void {
	// A sawtooth layered with a triangle a few cents flat -- the slight
	// detuning is what keeps a synthesized pad from sounding like a single
	// flat oscillator; the lowpass rounds off the saw's harshness.
	const saw = ctx.createOscillator();
	const triangle = ctx.createOscillator();
	saw.type = 'sawtooth';
	triangle.type = 'triangle';
	saw.frequency.setValueAtTime(frequencyHz, time);
	triangle.frequency.setValueAtTime(frequencyHz * Math.pow(2, -6 / 1200), time); // ~6 cents flat

	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.setValueAtTime(1400, time);

	const envelope = ctx.createGain();
	const release = Math.min(RELEASE_SECONDS, durationSeconds / 2);
	const attack = Math.min(ATTACK_SECONDS, durationSeconds / 2);
	envelope.gain.setValueAtTime(0.0001, time);
	envelope.gain.exponentialRampToValueAtTime(peakGain, time + attack);
	envelope.gain.setValueAtTime(peakGain, time + durationSeconds - release);
	envelope.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds);

	saw.connect(filter);
	triangle.connect(filter);
	filter.connect(envelope);
	envelope.connect(ctx.destination);

	saw.start(time);
	triangle.start(time);
	saw.stop(time + durationSeconds);
	triangle.stop(time + durationSeconds);
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
