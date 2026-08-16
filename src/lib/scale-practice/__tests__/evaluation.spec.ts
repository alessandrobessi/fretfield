import { describe, expect, it } from 'vitest';
import type { DetectedNote } from '$lib/audio/types';
import type { FretPosition } from '$lib/music/fretboard';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateBeat } from '../evaluation';

const TARGET = noteNameToPitchClass('D');
const OTHER = noteNameToPitchClass('F');
const ZONE_POSITIONS: FretPosition[] = [{ stringIndex: 2, fret: 0, pitchClass: TARGET }];
const TOLERANCE_MS = 120;

function makeNote(pitchClass: number, timestampMs: number): DetectedNote {
	return {
		frequencyHz: 146.83,
		midi: 38,
		pitchClass: pitchClass as DetectedNote['pitchClass'],
		octave: 2,
		cents: 0,
		confidence: 0.9,
		rms: 0.2,
		timestampMs
	};
}

describe('evaluateBeat', () => {
	const beatAtMs = 10_000;

	it('correct pitch played exactly on the beat -> correct, on-time', () => {
		const result = evaluateBeat({
			target: TARGET,
			zonePositions: ZONE_POSITIONS,
			played: makeNote(TARGET, beatAtMs),
			beatAtMs,
			toleranceMs: TOLERANCE_MS
		});
		expect(result).toEqual({
			target: TARGET,
			pitch: 'correct',
			timing: 'on-time',
			positions: ZONE_POSITIONS
		});
	});

	it('correct pitch played too early -> correct, off-time', () => {
		const result = evaluateBeat({
			target: TARGET,
			zonePositions: ZONE_POSITIONS,
			played: makeNote(TARGET, beatAtMs - 200),
			beatAtMs,
			toleranceMs: TOLERANCE_MS
		});
		expect(result.pitch).toBe('correct');
		expect(result.timing).toBe('off-time');
	});

	it('correct pitch played too late (but still attributed to this beat) -> correct, off-time', () => {
		const result = evaluateBeat({
			target: TARGET,
			zonePositions: ZONE_POSITIONS,
			played: makeNote(TARGET, beatAtMs + 200),
			beatAtMs,
			toleranceMs: TOLERANCE_MS
		});
		expect(result.pitch).toBe('correct');
		expect(result.timing).toBe('off-time');
	});

	it('wrong pitch played on the beat -> incorrect, on-time', () => {
		const result = evaluateBeat({
			target: TARGET,
			zonePositions: ZONE_POSITIONS,
			played: makeNote(OTHER, beatAtMs),
			beatAtMs,
			toleranceMs: TOLERANCE_MS
		});
		expect(result.pitch).toBe('incorrect');
		expect(result.timing).toBe('on-time');
	});

	it('nothing played -> missed, feedback positions fall back to the target', () => {
		const result = evaluateBeat({
			target: TARGET,
			zonePositions: ZONE_POSITIONS,
			played: null,
			beatAtMs,
			toleranceMs: TOLERANCE_MS
		});
		expect(result).toEqual({
			target: TARGET,
			pitch: null,
			timing: 'missed',
			positions: ZONE_POSITIONS
		});
	});
});
