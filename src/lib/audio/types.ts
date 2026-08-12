import type { PitchClass } from '$lib/music/pitch';

/**
 * The audio domain's only output. Deliberately neutral — no chord, key, or
 * role concept. $lib/audio must never import from $lib/music beyond the
 * bare PitchClass primitive used here; harmonic meaning is layered on by
 * the store, not this domain.
 */
export interface DetectedNote {
	frequencyHz: number;
	midi: number;
	pitchClass: PitchClass;
	octave: number;
	/** Deviation of the detected frequency from the nearest MIDI note, in cents. */
	cents: number;
	confidence: number;
	rms: number;
	timestampMs: number;
}

/** A single frame's raw pitch estimate — the detector's only concern. */
export interface PitchEstimate {
	frequencyHz: number;
	confidence: number;
}

export interface PitchDetectorConfig {
	minFrequencyHz: number;
	maxFrequencyHz: number;
	/** YIN's absolute threshold on the cumulative mean normalized difference function. */
	yinThreshold: number;
	minRms: number;
	minConfidence: number;
	bufferSize: number;
}

/** Covers standard 4-string bass (E1 ≈ 41 Hz) up through the top of a 24-fret G string, with margin. */
export const DEFAULT_PITCH_DETECTOR_CONFIG: PitchDetectorConfig = {
	minFrequencyHz: 35,
	maxFrequencyHz: 450,
	yinThreshold: 0.15,
	minRms: 0.01,
	minConfidence: 0.5,
	bufferSize: 4096
};

export type LiveNoteState =
	| { status: 'idle' }
	| { status: 'listening' }
	| { status: 'tracking'; note: DetectedNote }
	| { status: 'silence' }
	| { status: 'error'; message: string };

/** A raw block of time-domain samples handed from audio capture to the pitch tracker. */
export interface PitchFrame {
	estimate: PitchEstimate | null;
	rms: number;
	timestampMs: number;
}

export interface AudioInputDevice {
	deviceId: string;
	label: string;
}

/**
 * The capture/transport abstraction. Real browser capture (audio-input.ts)
 * and the deterministic fake source (fake-audio-source.ts, used by tests)
 * both implement this — nothing above this layer knows which one it has.
 */
export interface LiveAudioSource {
	listDevices(): Promise<AudioInputDevice[]>;
	/**
	 * `onError` reports problems that surface *after* a successful start (e.g.
	 * the device is unplugged mid-session) — failures to start at all should
	 * reject the returned promise instead.
	 */
	start(
		deviceId: string | null,
		onFrame: (samples: Float32Array, sampleRate: number) => void,
		onError?: (error: Error) => void
	): Promise<void>;
	stop(): void;
}
