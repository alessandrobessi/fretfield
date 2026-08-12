import type { DetectedNote } from '$lib/audio/types';
import type { PitchClass } from '$lib/music/pitch';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING } from '$lib/music/tuning';
import type { PracticeContext } from '../types';

/** A stable `DetectedNote` for `pitchClass`, at whatever octave `midiBase` falls in. Not real audio — just enough for evaluation/generator tests. */
export function note(pitchClass: PitchClass, midiBase = 40): DetectedNote {
	const midi = midiBase - (midiBase % 12) + pitchClass;
	return {
		frequencyHz: 110,
		midi,
		pitchClass,
		octave: Math.floor(midi / 12) - 1,
		cents: 0,
		confidence: 0.9,
		rms: 0.2,
		timestampMs: 0
	};
}

export function baseContext(overrides: Partial<PracticeContext> = {}): PracticeContext {
	return {
		tuning: STANDARD_4_STRING_TUNING,
		fretCount: DEFAULT_FRET_COUNT,
		root: null,
		chordId: 'major',
		progression: [],
		activeChordIndex: 0,
		selectedPath: null,
		region: null,
		localFieldOnly: false,
		...overrides
	};
}

/** A never-actually-random source that cycles through a fixed sequence of [0,1) values, so generator tests are fully reproducible (product spec §17). */
export function sequenceRandom(...values: number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length];
		i += 1;
		return v;
	};
}
