import {
	centsDeviation,
	frequencyToMidi,
	midiToOctave,
	midiToPitchClass,
	nearestMidi
} from './note-mapping';
import type { DetectedNote, LiveNoteState, PitchFrame } from './types';

/**
 * Tuning for the temporal-stabilization stage. `detectPitch` already applies
 * the RMS/confidence gate per frame — this config governs the *sequence* of
 * frames on top of that: how much agreement is required before a note is
 * trusted, how much pitch wobble still counts as "the same note", and how
 * long a dropout has to last before a sustained note is considered released.
 */
export interface PitchTrackerConfig {
	requiredConsecutiveFrames: number;
	maxSemitoneJitter: number;
	silenceFramesToRelease: number;
	smoothingFactor: number;
}

export const DEFAULT_PITCH_TRACKER_CONFIG: PitchTrackerConfig = {
	requiredConsecutiveFrames: 3,
	maxSemitoneJitter: 0.6,
	silenceFramesToRelease: 4,
	smoothingFactor: 0.4
};

interface PendingCandidate {
	floatingMidiSum: number;
	frequencySum: number;
	confidenceSum: number;
	rms: number;
	frameCount: number;
}

function averageFloatingMidi(candidate: PendingCandidate): number {
	return candidate.floatingMidiSum / candidate.frameCount;
}

function withinJitter(a: number, b: number, tolerance: number): boolean {
	return Math.abs(a - b) <= tolerance;
}

function startCandidate(
	floatingMidi: number,
	frequencyHz: number,
	confidence: number,
	rms: number
): PendingCandidate {
	return {
		floatingMidiSum: floatingMidi,
		frequencySum: frequencyHz,
		confidenceSum: confidence,
		rms,
		frameCount: 1
	};
}

function accumulate(
	candidate: PendingCandidate,
	floatingMidi: number,
	frequencyHz: number,
	confidence: number,
	rms: number
): void {
	candidate.floatingMidiSum += floatingMidi;
	candidate.frequencySum += frequencyHz;
	candidate.confidenceSum += confidence;
	candidate.rms = rms;
	candidate.frameCount += 1;
}

function noteFromFloatingMidi(
	floatingMidi: number,
	frequencyHz: number,
	confidence: number,
	rms: number,
	timestampMs: number
): DetectedNote {
	const midi = nearestMidi(floatingMidi);
	return {
		frequencyHz,
		midi,
		pitchClass: midiToPitchClass(midi),
		octave: midiToOctave(midi),
		cents: centsDeviation(floatingMidi, midi),
		confidence,
		rms,
		timestampMs
	};
}

function noteFromCandidate(candidate: PendingCandidate, timestampMs: number): DetectedNote {
	return noteFromFloatingMidi(
		averageFloatingMidi(candidate),
		candidate.frequencySum / candidate.frameCount,
		candidate.confidenceSum / candidate.frameCount,
		candidate.rms,
		timestampMs
	);
}

/** Floating MIDI implied by an already-confirmed note (reverses `cents`/`midi` back into one value). */
function trackedFloatingMidi(note: DetectedNote): number {
	return note.midi + note.cents / 100;
}

/**
 * Consumes a stream of per-frame pitch estimates and produces a stable
 * `LiveNoteState`. Raw frame-by-frame YIN output must not drive the
 * fretboard directly — attack transients and octave-adjacent noise cause
 * flicker, so a note is only reported once several consecutive frames agree,
 * and a tracked note tolerates brief disagreement/dropouts before it's
 * treated as released.
 */
export class PitchTracker {
	private readonly config: PitchTrackerConfig;
	private state: LiveNoteState = { status: 'idle' };
	private pending: PendingCandidate | null = null;
	private silenceStreak = 0;

	constructor(config: PitchTrackerConfig = DEFAULT_PITCH_TRACKER_CONFIG) {
		this.config = config;
	}

	getState(): LiveNoteState {
		return this.state;
	}

	/** Begin evaluating frames. Idempotent — safe to call again to clear accumulated state. */
	start(): LiveNoteState {
		this.state = { status: 'listening' };
		this.pending = null;
		this.silenceStreak = 0;
		return this.state;
	}

	/** Stop evaluating frames and discard all accumulated state. */
	stop(): LiveNoteState {
		this.state = { status: 'idle' };
		this.pending = null;
		this.silenceStreak = 0;
		return this.state;
	}

	processFrame(frame: PitchFrame): LiveNoteState {
		if (this.state.status === 'idle') {
			return this.state;
		}

		if (frame.estimate === null) {
			return this.handleMissingFrame();
		}

		return this.handleEstimate(frame, frame.estimate.frequencyHz, frame.estimate.confidence);
	}

	private handleMissingFrame(): LiveNoteState {
		this.pending = null;
		this.silenceStreak += 1;

		if (this.silenceStreak >= this.config.silenceFramesToRelease) {
			this.state = { status: 'silence' };
		} else if (this.state.status !== 'tracking') {
			this.state = { status: 'listening' };
		}

		return this.state;
	}

	private handleEstimate(
		frame: PitchFrame,
		frequencyHz: number,
		confidence: number
	): LiveNoteState {
		this.silenceStreak = 0;
		const floatingMidi = frequencyToMidi(frequencyHz);

		if (
			this.state.status === 'tracking' &&
			withinJitter(
				floatingMidi,
				trackedFloatingMidi(this.state.note),
				this.config.maxSemitoneJitter
			)
		) {
			this.pending = null;
			const previous = this.state.note;
			const blendedMidi =
				trackedFloatingMidi(previous) +
				(floatingMidi - trackedFloatingMidi(previous)) * this.config.smoothingFactor;
			const blendedFrequency =
				previous.frequencyHz + (frequencyHz - previous.frequencyHz) * this.config.smoothingFactor;
			this.state = {
				status: 'tracking',
				note: noteFromFloatingMidi(
					blendedMidi,
					blendedFrequency,
					confidence,
					frame.rms,
					frame.timestampMs
				)
			};
			return this.state;
		}

		if (
			this.pending &&
			withinJitter(floatingMidi, averageFloatingMidi(this.pending), this.config.maxSemitoneJitter)
		) {
			accumulate(this.pending, floatingMidi, frequencyHz, confidence, frame.rms);
		} else {
			this.pending = startCandidate(floatingMidi, frequencyHz, confidence, frame.rms);
		}

		if (this.pending.frameCount >= this.config.requiredConsecutiveFrames) {
			this.state = { status: 'tracking', note: noteFromCandidate(this.pending, frame.timestampMs) };
			this.pending = null;
		} else if (this.state.status !== 'tracking') {
			this.state = { status: 'listening' };
		}

		return this.state;
	}
}
