import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '../note-mapping';
import { DEFAULT_PITCH_TRACKER_CONFIG, PitchTracker } from '../pitch-tracker';
import type { LiveNoteState, PitchFrame } from '../types';

const E2_MIDI = 40;
const B2_MIDI = 47;
const F_SHARP2_MIDI = 42;

let clockMs = 0;
function nextTimestamp(): number {
	clockMs += 10;
	return clockMs;
}

function frameFor(midi: number, confidence = 0.9, rms = 0.2): PitchFrame {
	return {
		estimate: { frequencyHz: midiToFrequency(midi), confidence },
		rms,
		timestampMs: nextTimestamp()
	};
}

function silentFrame(): PitchFrame {
	return { estimate: null, rms: 0, timestampMs: nextTimestamp() };
}

function feed(tracker: PitchTracker, frames: PitchFrame[]): LiveNoteState {
	let state: LiveNoteState = tracker.getState();
	for (const frame of frames) {
		state = tracker.processFrame(frame);
	}
	return state;
}

describe('PitchTracker — lifecycle', () => {
	it('starts idle and ignores frames until started', () => {
		const tracker = new PitchTracker();
		expect(tracker.getState()).toEqual({ status: 'idle' });
		tracker.processFrame(frameFor(E2_MIDI));
		expect(tracker.getState()).toEqual({ status: 'idle' });
	});

	it('start() transitions to listening', () => {
		const tracker = new PitchTracker();
		expect(tracker.start()).toEqual({ status: 'listening' });
	});

	it('stop() discards accumulated state and returns to idle', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(tracker.getState().status).toBe('tracking');

		expect(tracker.stop()).toEqual({ status: 'idle' });
		expect(tracker.processFrame(frameFor(E2_MIDI))).toEqual({ status: 'idle' });
	});
});

describe('PitchTracker — onset requires consecutive agreement', () => {
	it('four consecutive E2 frames settle into a stable tracking event', () => {
		const tracker = new PitchTracker();
		tracker.start();
		const state = feed(tracker, [
			frameFor(E2_MIDI),
			frameFor(E2_MIDI),
			frameFor(E2_MIDI),
			frameFor(E2_MIDI)
		]);

		expect(state.status).toBe('tracking');
		if (state.status === 'tracking') {
			expect(state.note.midi).toBe(E2_MIDI);
		}
	});

	it('a single frame is not enough to confirm a note', () => {
		const tracker = new PitchTracker();
		tracker.start();
		const state = tracker.processFrame(frameFor(E2_MIDI));
		expect(state.status).toBe('listening');
	});
});

describe('PitchTracker — resists false transients', () => {
	it('E2, E2, E2, one-frame B2 transient, E2, E2 stays on E2 throughout tracking', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(tracker.getState().status).toBe('tracking');

		const duringTransient = tracker.processFrame(frameFor(B2_MIDI));
		expect(duringTransient.status).toBe('tracking');
		if (duringTransient.status === 'tracking') {
			expect(duringTransient.note.midi).toBe(E2_MIDI);
		}

		const after = feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(after.status).toBe('tracking');
		if (after.status === 'tracking') {
			expect(after.note.midi).toBe(E2_MIDI);
		}
	});

	it('small sub-semitone wobble around E2 never flickers to an adjacent note', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);

		const wobbleFrequency = midiToFrequency(E2_MIDI + 0.2);
		for (let i = 0; i < 5; i++) {
			const state = tracker.processFrame({
				estimate: { frequencyHz: wobbleFrequency, confidence: 0.9 },
				rms: 0.2,
				timestampMs: nextTimestamp()
			});
			expect(state.status).toBe('tracking');
			if (state.status === 'tracking') {
				expect(state.note.midi).toBe(E2_MIDI);
			}
		}
	});

	it('a sustained genuine change (not a transient) does switch the tracked note', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(tracker.getState().status).toBe('tracking');

		const state = feed(tracker, [
			frameFor(F_SHARP2_MIDI),
			frameFor(F_SHARP2_MIDI),
			frameFor(F_SHARP2_MIDI)
		]);
		expect(state.status).toBe('tracking');
		if (state.status === 'tracking') {
			expect(state.note.midi).toBe(F_SHARP2_MIDI);
		}
	});
});

describe('PitchTracker — silence and release', () => {
	it('a brief one-frame dropout does not drop a tracked note', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);

		const state = tracker.processFrame(silentFrame());
		expect(state.status).toBe('tracking');
	});

	it('sustained silence after tracking transitions to the silence (release) state', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(tracker.getState().status).toBe('tracking');

		const silentFrames = Array.from(
			{ length: DEFAULT_PITCH_TRACKER_CONFIG.silenceFramesToRelease },
			() => silentFrame()
		);
		const state = feed(tracker, silentFrames);
		expect(state.status).toBe('silence');
	});

	it('a note can be re-confirmed after a release', () => {
		const tracker = new PitchTracker();
		tracker.start();
		feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		feed(
			tracker,
			Array.from({ length: DEFAULT_PITCH_TRACKER_CONFIG.silenceFramesToRelease }, () =>
				silentFrame()
			)
		);
		expect(tracker.getState().status).toBe('silence');

		const state = feed(tracker, [frameFor(E2_MIDI), frameFor(E2_MIDI), frameFor(E2_MIDI)]);
		expect(state.status).toBe('tracking');
	});
});
