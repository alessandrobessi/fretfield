import { describe, expect, it } from 'vitest';
import { ALL_INTERVALS } from '$lib/music/intervals';
import { noteNameToPitchClass } from '$lib/music/pitch';
import { evaluateAttempt } from '../evaluation';
import { createIntervalExercise } from '../exercise-generators';
import { DEFAULT_INTERVAL_PRACTICE_POOL } from '../presets';
import { baseContext, note, sequenceRandom } from './test-helpers';

describe('Find Interval', () => {
	it('root C, target b7, played Bb -> exact', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		expect(exercise).not.toBeNull();
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Bb')));
		expect(evaluation.result).toBe('exact');
	});

	it('root C, target b7, played B -> incorrect', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('B')));
		expect(evaluation.result).toBe('incorrect');
	});

	it('returns null without a selected root', () => {
		const context = baseContext({ root: null });
		expect(createIntervalExercise(context, { interval: 'b7' })).toBeNull();
	});

	it('every one of the twelve intervals can be targeted', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major' });
		for (const interval of ALL_INTERVALS) {
			const exercise = createIntervalExercise(context, { interval });
			expect(exercise?.targets[0]?.interval).toBe(interval);
		}
	});

	it('picking via an injected random source is fully deterministic', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major' });
		const exercise = createIntervalExercise(context, { random: sequenceRandom(0) });
		expect(exercise?.prompt.kind === 'find-interval' && exercise.prompt.interval).toBe(
			DEFAULT_INTERVAL_PRACTICE_POOL[0]
		);
	});

	it('excludes a recently-used interval when another option exists', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major' });
		const recent = DEFAULT_INTERVAL_PRACTICE_POOL[0];
		const exercise = createIntervalExercise(context, {
			random: sequenceRandom(0),
			exclude: new Set([recent])
		});
		expect(exercise?.prompt.kind === 'find-interval' && exercise.prompt.interval).not.toBe(recent);
	});

	it('a musically valid but unrequested chord tone is a strong/valid alternative, not exact', () => {
		// Root C, dominant-7 chord, asked for b7 (Bb); playing the 3rd (E) is a
		// genuinely good tone of the same chord, just not what was asked.
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const exercise = createIntervalExercise(context, { interval: 'b7' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('E')));
		expect(evaluation.result).not.toBe('exact');
		expect(['strong-alternative', 'valid-alternative']).toContain(evaluation.result);
	});

	it('a dissonant, unrelated note is incorrect but still explained', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'major' });
		const exercise = createIntervalExercise(context, { interval: '5' });
		const evaluation = evaluateAttempt(exercise!, note(noteNameToPitchClass('Db')));
		expect(evaluation.result).toBe('incorrect');
		expect(evaluation.explanation).toBeDefined();
		expect(evaluation.explanation?.pitchClass).toBe(noteNameToPitchClass('Db'));
	});
});
