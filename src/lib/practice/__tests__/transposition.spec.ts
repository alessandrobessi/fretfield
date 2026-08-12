import { describe, expect, it } from 'vitest';
import { transposeByInterval } from '$lib/music/intervals';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateAttempt } from '../evaluation';
import {
	createChordToneExercise,
	createIntervalExercise,
	createResolutionExercise
} from '../exercise-generators';
import { baseContext, note } from './test-helpers';

const TONICS = ['C', 'Eb', 'A'] as const;

describe('Transposition invariance', () => {
	it.each(TONICS)('Find Interval: root %s, b7 targets the correct transposed pitch', (rootName) => {
		const root = noteNameToPitchClass(rootName);
		const context = baseContext({ root, chordId: 'dominant-7' });
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		const expected = transposeByInterval(root, 'b7');
		expect(exercise!.targets[0].pitchClass).toBe(expected);
		expect(evaluateAttempt(exercise!, note(expected)).result).toBe('exact');
	});

	it.each(TONICS)(
		'Find Chord Tone: %s7, the 3rd targets the correct transposed pitch',
		(rootName) => {
			const root = noteNameToPitchClass(rootName);
			const context = baseContext({ root, chordId: 'dominant-7' });
			const exercise = createChordToneExercise(context, { interval: '3' });
			const expected = transposeByInterval(root, '3');
			expect(exercise!.targets[0].pitchClass).toBe(expected);
			expect(evaluateAttempt(exercise!, note(expected)).result).toBe('exact');
		}
	);

	it.each(TONICS)('Resolve Note: ii-V-I in %s, b7 of V resolves to the 3rd of I', (tonicName) => {
		const tonic = noteNameToPitchClass(tonicName);
		const dominant = transposeByInterval(tonic, '5');
		const context = baseContext({
			progression: [
				{ root: dominant, chordId: 'dominant-7' },
				{ root: tonic, chordId: 'major-7' }
			]
		});
		const exercise = createResolutionExercise(context, { interval: 'b7' });
		const expected = transposeByInterval(tonic, '3');
		expect(evaluateAttempt(exercise!, note(expected)).result).toBe('exact');
	});
});
