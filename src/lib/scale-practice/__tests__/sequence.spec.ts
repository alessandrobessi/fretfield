import { describe, expect, it } from 'vitest';
import { getScaleDefinition } from '$lib/music/scales';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING } from '$lib/music/tuning';
import { buildScaleSequence } from '../sequence';

function pitchClasses(...names: string[]): number[] {
	return names.map((name) => noteNameToPitchClass(name));
}

describe('buildScaleSequence', () => {
	it('C major pentatonic across a wide-open zone climbs then descends without repeating the turnaround notes', () => {
		const scale = getScaleDefinition('major-pentatonic');
		const sequence = buildScaleSequence(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: 0, maxFret: DEFAULT_FRET_COUNT },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(sequence).toEqual(pitchClasses('C', 'D', 'E', 'G', 'A', 'G', 'E', 'D'));
	});

	it('a narrow zone skips degrees with no fret position in it, rather than falling back to the full neck', () => {
		// Frets 0-1 on E-A-D-G contain E,F,A,Bb,D,Eb,G,Ab — C major pentatonic's
		// root (C) has no position there, so the sequence skips it entirely.
		const scale = getScaleDefinition('major-pentatonic');
		const sequence = buildScaleSequence(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: 0, maxFret: 1 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(sequence).toEqual(pitchClasses('D', 'E', 'G', 'A', 'G', 'E'));
	});

	it('a zone with no fret positions at all yields an empty sequence', () => {
		const scale = getScaleDefinition('major-pentatonic');
		const sequence = buildScaleSequence(
			noteNameToPitchClass('C'),
			scale,
			{ minFret: DEFAULT_FRET_COUNT + 5, maxFret: DEFAULT_FRET_COUNT + 5 },
			STANDARD_4_STRING_TUNING,
			DEFAULT_FRET_COUNT
		);
		expect(sequence).toEqual([]);
	});
});
