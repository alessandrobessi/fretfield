import { describe, expect, it } from 'vitest';
import type { FretboardRegion } from '$lib/music/local-fields';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateAttempt } from '../evaluation';
import { createIntervalExercise } from '../exercise-generators';
import { baseContext, note } from './test-helpers';

// Root C, target b7 = Bb. On standard EADG tuning within 20 frets, Bb occurs
// at E-fret6/18, A-fret1/13, D-fret8/20, G-fret3/15.
function contextWithRegion(region: FretboardRegion | null) {
	return baseContext({
		root: noteNameToPitchClass('C'),
		chordId: 'dominant-7',
		region,
		localFieldOnly: region !== null
	});
}

describe('Local Field position handling', () => {
	it('a correct pitch clearly inside the region is exact and unambiguous', () => {
		const region: FretboardRegion = { id: 'r', minFret: 7, maxFret: 9 }; // only D-fret8
		const context = contextWithRegion(region);
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		expect(exercise!.targets[0].positionRequirement).toBe('physical-position');

		// midi for Bb at the D-string-fret8 octave.
		const played = note(noteNameToPitchClass('Bb'), 46);
		const evaluation = evaluateAttempt(exercise!, played);
		expect(evaluation.result).toBe('exact');
		expect(evaluation.positionAmbiguous).toBe(false);
	});

	it('a correct pitch with a physically ambiguous position is still accepted, flagged ambiguous', () => {
		const region: FretboardRegion = { id: 'r', minFret: 0, maxFret: 10 }; // contains two of this note's candidates
		const context = contextWithRegion(region);
		const exercise = createIntervalExercise(context, { interval: 'b7' });

		const played = note(noteNameToPitchClass('Bb'), 46);
		const evaluation = evaluateAttempt(exercise!, played);
		expect(evaluation.result).toBe('exact');
		expect(evaluation.positionAmbiguous).toBe(true);
	});

	it('never falsely rejects a correct pitch merely because the exact position cannot be proven', () => {
		// Same ambiguous-region setup as above — the point is `satisfied` must
		// still end up true, not a silent rejection dressed up as ambiguity.
		const region: FretboardRegion = { id: 'r', minFret: 0, maxFret: 10 };
		const context = contextWithRegion(region);
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Bb'), 46));
		expect(evaluation.result).not.toBe('incorrect');
	});

	it('correctly rejects when the pitch is right but no physical candidate could be inside the region', () => {
		const region: FretboardRegion = { id: 'r', minFret: 13, maxFret: 15 }; // A-fret13 / G-fret15 only
		const context = contextWithRegion(region);
		const exercise = createIntervalExercise(context, { interval: 'b7' });

		// This specific octave's only candidates (E-fret6, A-fret1) can't reach the region at all.
		const played = note(noteNameToPitchClass('Bb'), 34);
		const evaluation = evaluateAttempt(exercise!, played);
		expect(evaluation.result).toBe('incorrect');
	});

	it('without localFieldOnly, position never matters — pitch alone is enough', () => {
		const context = contextWithRegion(null);
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		expect(exercise!.targets[0].positionRequirement).toBe('pitch-only');
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Bb'), 34));
		expect(evaluation.result).toBe('exact');
		expect(evaluation.positionAmbiguous).toBe(false);
	});
});
