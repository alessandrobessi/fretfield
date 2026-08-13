import { MicrophoneAudioSource } from '$lib/audio/audio-input';
import { detectPitch } from '$lib/audio/pitch-detector';
import { DEFAULT_PITCH_TRACKER_CONFIG, PitchTracker } from '$lib/audio/pitch-tracker';
import type { AudioInputDevice, DetectedNote, LiveAudioSource, PitchFrame } from '$lib/audio/types';
import { DEFAULT_PITCH_DETECTOR_CONFIG } from '$lib/audio/types';
import {
	STANDARD_4_STRING_ABSOLUTE_TUNING,
	findFretPositionsForMidi,
	type AbsoluteTuning
} from '$lib/music/absolute-pitch';
import type { FretPosition } from '$lib/music/fretboard';
import { inferLivePosition, type LivePositionContext } from '$lib/music/live-position';
import { DEFAULT_FRET_COUNT } from '$lib/music/tuning';

export type LiveInputStatus = 'idle' | 'listening' | 'tracking' | 'silence' | 'error';

/** Diagnostic-only signal level, per product spec §17 — not a recording meter. */
export type InputLevel = 'no-signal' | 'too-low' | 'healthy' | 'clipping';

const TOO_LOW_RMS = 0.02;
const CLIPPING_RMS = 0.9;

function classifyInputLevel(rms: number): InputLevel {
	if (rms < DEFAULT_PITCH_DETECTOR_CONFIG.minRms) return 'no-signal';
	if (rms < TOO_LOW_RMS) return 'too-low';
	if (rms > CLIPPING_RMS) return 'clipping';
	return 'healthy';
}

/** Supplies the harmonic/positional context this store cannot know about itself (per the audio/music boundary) without depending on the main FretField store. */
export type LiveInputContextProvider = () => LivePositionContext;

function computeRms(samples: Float32Array): number {
	let sumSquares = 0;
	for (let i = 0; i < samples.length; i++) {
		sumSquares += samples[i] * samples[i];
	}
	return Math.sqrt(sumSquares / samples.length);
}

/**
 * Owns the Web Audio lifecycle (capture, YIN detection, temporal tracking)
 * and the pure absolute-pitch → fretboard mapping. Deliberately separate
 * from `fretfield.svelte.ts`: AudioContext/MediaStream/AnalyserNode must
 * never leak into the music-theory store. The main store consumes only this
 * store's plain `DetectedNote`/`FretPosition` state and wires a context
 * provider back in so ambiguous positions can be sharpened by whatever
 * Voice-Leading Path/Local Field is currently active.
 */
export class LiveInputStore {
	enabled = $state(false);
	status = $state<LiveInputStatus>('idle');
	devices = $state<AudioInputDevice[]>([]);
	selectedDeviceId = $state<string | null>(null);
	detectedNote = $state<DetectedNote | null>(null);
	candidatePositions = $state<FretPosition[]>([]);
	likelyPosition = $state<FretPosition | null>(null);
	inputLevel = $state<InputLevel>('no-signal');
	error = $state<string | null>(null);
	/**
	 * Increments exactly once per genuinely new confirmed note — either the
	 * first note after silence, or a legato change to a different pitch while
	 * still sustaining. Stays constant across the many reinforcement frames a
	 * single held note produces. This is the smallest clean "note-on" signal
	 * a consumer (Guided Practice) needs to register one attempt per note
	 * instead of dozens per second — see `applyTrackerState` below, which is
	 * the one place that already knows when a note is genuinely new.
	 */
	noteOnsetId = $state(0);

	private source: LiveAudioSource;
	private readonly tracker: PitchTracker;
	private readonly tuning: AbsoluteTuning;
	private readonly fretCount: number;
	private contextProvider: LiveInputContextProvider = () => ({});
	private lastLikelyPosition: FretPosition | null = null;
	private lastTrackedMidi: number | null = null;

	constructor(
		source: LiveAudioSource = new MicrophoneAudioSource(),
		tuning: AbsoluteTuning = STANDARD_4_STRING_ABSOLUTE_TUNING,
		fretCount: number = DEFAULT_FRET_COUNT
	) {
		this.source = source;
		this.tracker = new PitchTracker(DEFAULT_PITCH_TRACKER_CONFIG);
		this.tuning = tuning;
		this.fretCount = fretCount;
	}

	setContextProvider(provider: LiveInputContextProvider): void {
		this.contextProvider = provider;
	}

	/**
	 * Swaps the capture backend — the injectable seam §20 asks for so CI and
	 * Playwright never need real audio hardware. Call before `enable()`; any
	 * previous backend is stopped first. Real app code never needs this (it
	 * uses the `MicrophoneAudioSource` supplied at construction) — it exists
	 * for tests to substitute a `FakeAudioSource`.
	 */
	useSource(source: LiveAudioSource): void {
		this.source.stop();
		this.tracker.stop();
		this.source = source;
	}

	/**
	 * The explicit user action that requests microphone permission — never
	 * called automatically. Starts capture *before* enumerating devices:
	 * browsers blank out every device's label and id until permission has
	 * been granted at least once, so listing devices first (as this used to)
	 * hands the UI placeholder ids that don't match any real device — picking
	 * a specific one later (e.g. an interface by name) would then fail with a
	 * "device not found" style error. Enumerating only after `source.start()`
	 * succeeds guarantees `devices` always holds real, selectable ids.
	 */
	async enable(deviceId: string | null = null): Promise<void> {
		this.source.stop();
		this.tracker.stop();
		this.error = null;
		this.lastLikelyPosition = null;

		// Falls back to whichever device was last selected — e.g. a plain
		// Disable/Enable toggle (no explicit deviceId) should resume on the
		// same interface rather than silently reverting to the OS default.
		// `this.selectedDeviceId` is only ever a real id by this point (never
		// the pre-permission placeholder), so it's always safe to reuse.
		const requestedDeviceId = deviceId ?? this.selectedDeviceId;

		this.tracker.start();
		this.status = 'listening';

		try {
			await this.source.start(requestedDeviceId, this.handleFrame, this.handleSourceError);
			this.enabled = true;
			this.selectedDeviceId = requestedDeviceId;
		} catch (caught) {
			this.tracker.stop();
			this.enabled = false;
			this.status = 'error';
			this.error = caught instanceof Error ? caught.message : 'Failed to start audio input.';
			return;
		}

		try {
			this.devices = await this.source.listDevices();
			if (this.selectedDeviceId === null) {
				this.selectedDeviceId = this.devices[0]?.deviceId ?? null;
			}
		} catch {
			this.devices = [];
		}
	}

	disable(): void {
		this.source.stop();
		this.tracker.stop();
		this.enabled = false;
		this.status = 'idle';
		this.detectedNote = null;
		this.candidatePositions = [];
		this.likelyPosition = null;
		this.lastLikelyPosition = null;
		this.lastTrackedMidi = null;
		this.inputLevel = 'no-signal';
		this.error = null;
	}

	async selectDevice(deviceId: string): Promise<void> {
		await this.enable(deviceId);
	}

	private handleFrame = (samples: Float32Array, sampleRate: number): void => {
		const rms = computeRms(samples);
		this.inputLevel = classifyInputLevel(rms);

		const estimate = detectPitch(samples, sampleRate);
		const frame: PitchFrame = { estimate, rms, timestampMs: Date.now() };
		this.applyTrackerState(this.tracker.processFrame(frame));
	};

	private handleSourceError = (err: Error): void => {
		this.source.stop();
		this.tracker.stop();
		this.enabled = false;
		this.status = 'error';
		this.error = err.message;
		this.detectedNote = null;
		this.candidatePositions = [];
		this.likelyPosition = null;
	};

	private applyTrackerState(state: ReturnType<PitchTracker['getState']>): void {
		this.status = state.status;

		if (state.status !== 'tracking') {
			this.detectedNote = null;
			this.candidatePositions = [];
			this.likelyPosition = null;
			// A gap (however brief) means the *next* confirmed note — even if it's
			// the same pitch as before — is a new attempt, not a continuation.
			this.lastTrackedMidi = null;
			return;
		}

		const isNewOnset = this.lastTrackedMidi !== state.note.midi;
		this.detectedNote = state.note;
		const candidates = findFretPositionsForMidi(this.tuning, this.fretCount, state.note.midi);
		this.candidatePositions = candidates;

		const inference = inferLivePosition(candidates, {
			...this.contextProvider(),
			previousLikelyPosition: this.lastLikelyPosition
		});
		this.likelyPosition = inference.likelyPosition;
		this.lastLikelyPosition = inference.likelyPosition ?? this.lastLikelyPosition;

		if (isNewOnset) {
			this.lastTrackedMidi = state.note.midi;
			this.noteOnsetId += 1;
		}
	}
}

export const liveInput = new LiveInputStore();
