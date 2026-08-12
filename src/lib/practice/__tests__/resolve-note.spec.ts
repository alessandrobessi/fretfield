import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateAttempt } from '../evaluation';
import { createResolutionExercise } from '../exercise-generators';
import { baseContext, note } from './test-helpers';

describe('Resolve Note', () => {
	const g7ToCmaj7 = baseContext({
		progression: [
			{ root: noteNameToPitchClass('G'), chordId: 'dominant-7' },
			{ root: noteNameToPitchClass('C'), chordId: 'major-7' }
		],
		activeChordIndex: 0
	});

	it('F -> E emerges from the transition engine as the primary strong resolution', () => {
		const exercise = createResolutionExercise(g7ToCmaj7, { interval: 'b7' }); // F is the b7 of G7
		expect(exercise).not.toBeNull();
		expect(exercise!.prompt.kind === 'resolve-note' && exercise!.prompt.currentPitchClass).toBe(
			noteNameToPitchClass('F')
		);
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('E')));
		expect(evaluation.result).toBe('exact');
		expect(evaluation.matchedTarget?.pitchClass).toBe(noteNameToPitchClass('E'));
	});

	it('B -> C emerges from the transition engine as the primary strong resolution', () => {
		const exercise = createResolutionExercise(g7ToCmaj7, { interval: '3' }); // B is the 3rd of G7
		expect(exercise!.prompt.kind === 'resolve-note' && exercise!.prompt.currentPitchClass).toBe(
			noteNameToPitchClass('B')
		);
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('C')));
		expect(evaluation.result).toBe('exact');
	});

	it('a decent-but-not-best resolution is accepted as a strong or valid alternative', () => {
		// F -> B is the 7th of Cmaj7, a real guide tone landing, just not the primary target.
		const exercise = createResolutionExercise(g7ToCmaj7, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('B')));
		expect(['strong-alternative', 'valid-alternative']).toContain(evaluation.result);
	});

	it('an unrelated note is incorrect', () => {
		const exercise = createResolutionExercise(g7ToCmaj7, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Db')));
		expect(evaluation.result).toBe('incorrect');
	});

	it('returns null with fewer than two chords in the progression', () => {
		const context = baseContext({
			progression: [{ root: noteNameToPitchClass('C'), chordId: 'major' }]
		});
		expect(createResolutionExercise(context)).toBeNull();
	});

	it('wraps from the last chord back to the first, for a repeatable practice loop', () => {
		const context = baseContext({
			progression: [
				{ root: noteNameToPitchClass('D'), chordId: 'minor-7' },
				{ root: noteNameToPitchClass('G'), chordId: 'dominant-7' }
			],
			activeChordIndex: 1 // G7 active — should resolve back into Dm7
		});
		const exercise = createResolutionExercise(context, { interval: 'b7' });
		expect(exercise!.prompt.kind === 'resolve-note' && exercise!.prompt.toChordId).toBe('minor-7');
	});
});
