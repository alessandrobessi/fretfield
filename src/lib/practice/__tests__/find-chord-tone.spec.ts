import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateAttempt } from '../evaluation';
import { createChordToneExercise } from '../exercise-generators';
import { baseContext, note, sequenceRandom } from './test-helpers';

describe('Find Chord Tone', () => {
	it('C7, target 3, played E -> exact', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const exercise = createChordToneExercise(context, { interval: '3' });
		expect(exercise).not.toBeNull();
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('E')));
		expect(evaluation.result).toBe('exact');
	});

	it('Dm7, target b7, played C -> exact', () => {
		const context = baseContext({ root: noteNameToPitchClass('D'), chordId: 'minor-7' });
		const exercise = createChordToneExercise(context, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('C')));
		expect(evaluation.result).toBe('exact');
	});

	it('asked for the 3rd of Cmaj7, played the 9th (D) -> musically valid, not exact', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major-7' });
		const exercise = createChordToneExercise(context, { interval: '3' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('D')));
		expect(evaluation.result).not.toBe('exact');
		expect(['strong-alternative', 'valid-alternative']).toContain(evaluation.result);
		expect(evaluation.explanation?.interval).toBe('2');
	});

	it('an unrelated dissonant note is incorrect for this exercise', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major-7' });
		const exercise = createChordToneExercise(context, { interval: '3' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Db')));
		expect(evaluation.result).toBe('incorrect');
	});

	it('never asks for the root by default (trivial compared to an actual chord tone)', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		for (let i = 0; i < 8; i++) {
			const exercise = createChordToneExercise(context, { random: sequenceRandom(i / 8) });
			expect(exercise?.prompt.kind === 'find-chord-tone' && exercise.prompt.interval).not.toBe('1');
		}
	});

	it('returns null without a selected root', () => {
		expect(createChordToneExercise(baseContext({ root: null }))).toBeNull();
	});
});
