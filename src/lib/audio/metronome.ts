/**
 * The app's first audio *output* rather than analysis — a short synthesized
 * tick for Scale Practice's metronome. Deliberately its own `AudioContext`,
 * entirely separate from Live Input's microphone-capture context in
 * `audio-input.ts`, and theory-free like the rest of this directory: no
 * chord/key/progression concept belongs here, only a click.
 */
export interface MetronomeClick {
	playClick(): void;
	dispose(): void;
}

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
	if (typeof window === 'undefined') return null;
	const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
	return withWebkit.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

const CLICK_FREQUENCY_HZ = 1000;
const CLICK_DURATION_SECONDS = 0.03;
const CLICK_PEAK_GAIN = 0.3;

/**
 * Must be called from inside a user-gesture handler (e.g. a "Start" button's
 * click) so the browser's autoplay policy allows the `AudioContext` to run,
 * the same constraint Live Input's `getUserMedia` call already lives under.
 * Returns `null` if Web Audio isn't available at all.
 */
export function createMetronomeClick(): MetronomeClick | null {
	const AudioContextCtor = resolveAudioContextConstructor();
	if (AudioContextCtor === null) return null;

	const audioContext = new AudioContextCtor();

	return {
		playClick(): void {
			if (audioContext.state === 'suspended') {
				void audioContext.resume();
			}
			const now = audioContext.currentTime;
			const oscillator = audioContext.createOscillator();
			const gain = audioContext.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(CLICK_FREQUENCY_HZ, now);
			// A brief percussive envelope rather than a flat gain — a real click, not a beep.
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.exponentialRampToValueAtTime(CLICK_PEAK_GAIN, now + 0.001);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + CLICK_DURATION_SECONDS);
			oscillator.connect(gain);
			gain.connect(audioContext.destination);
			oscillator.start(now);
			oscillator.stop(now + CLICK_DURATION_SECONDS);
		},
		dispose(): void {
			void audioContext.close();
		}
	};
}
