import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '$lib/music/pitch';
import {
	advanceToNextExercise,
	isContextCompatible,
	recordAttempt,
	startSession,
	stopSession,
	updateSettings
} from '../practice-engine';
import { computePracticeStats, DEFAULT_PRACTICE_SETTINGS } from '../types';
import { baseContext, note } from './test-helpers';

describe('PracticeEngine — session lifecycle', () => {
	it('starts idle without enough context, active with it', () => {
		const noRoot = startSession(
			'find-interval',
			baseContext({ root: null }),
			DEFAULT_PRACTICE_SETTINGS
		);
		expect(noRoot.status).toBe('idle');
		expect(noRoot.currentExercise).toBeNull();

		const withRoot = startSession(
			'find-interval',
			baseContext({ root: noteNameToPitchClass('C') }),
			DEFAULT_PRACTICE_SETTINGS
		);
		expect(withRoot.status).toBe('active');
		expect(withRoot.exerciseStatus).toBe('waiting-for-note');
		expect(withRoot.currentExercise).not.toBeNull();
	});

	it('a note arriving while not waiting-for-note is ignored, not recorded as an attempt', () => {
		const context = baseContext({ root: noteNameToPitchClass('C') });
		let session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		const exercise = session.currentExercise!;

		// Correctly answer once — session moves to 'feedback'.
		session = recordAttempt(session, note(exercise.targets[0].pitchClass));
		expect(session.exerciseStatus).toBe('feedback');
		expect(session.attempts).toHaveLength(1);

		// A stray note while still showing feedback must not register as a second attempt.
		session = recordAttempt(session, note(exercise.targets[0].pitchClass));
		expect(session.lastEvaluation?.result).toBe('ignored');
		expect(session.attempts).toHaveLength(1);
	});

	it('advancing after feedback generates a fresh exercise and resets exerciseStatus', () => {
		const context = baseContext({ root: noteNameToPitchClass('C') });
		let session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		session = recordAttempt(session, note(session.currentExercise!.targets[0].pitchClass));
		session = advanceToNextExercise(session, context);

		expect(session.exerciseStatus).toBe('waiting-for-note');
		expect(session.lastEvaluation).toBeNull();
		expect(session.currentExercise).not.toBeNull();
		expect(session.recentTargetKeys.length).toBeGreaterThan(0);
	});

	it('stopSession returns a clean idle session', () => {
		const context = baseContext({ root: noteNameToPitchClass('C') });
		let session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		session = recordAttempt(session, note(session.currentExercise!.targets[0].pitchClass));
		session = stopSession(session.settings);

		expect(session.status).toBe('idle');
		expect(session.currentExercise).toBeNull();
		expect(session.attempts).toHaveLength(0);
	});

	it('updateSettings only touches the requested fields', () => {
		const session = startSession(
			'find-interval',
			baseContext({ root: noteNameToPitchClass('C') }),
			DEFAULT_PRACTICE_SETTINGS
		);
		const updated = updateSettings(session, { hintLevel: 'hidden' });
		expect(updated.settings.hintLevel).toBe('hidden');
		expect(updated.settings.localFieldOnly).toBe(DEFAULT_PRACTICE_SETTINGS.localFieldOnly);
	});
});

describe('PracticeEngine — stale-context detection', () => {
	it('a same-root, same-chord context stays compatible', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		expect(isContextCompatible(session.currentExercise!, context)).toBe(true);
	});

	it('changing the root makes the current exercise stale', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		const session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		const changedRoot = { ...context, root: noteNameToPitchClass('D') };
		expect(isContextCompatible(session.currentExercise!, changedRoot)).toBe(false);
	});

	it('changing the progression makes a Resolve Note exercise stale', () => {
		const context = baseContext({
			progression: [
				{ root: noteNameToPitchClass('G'), chordId: 'dominant-7' },
				{ root: noteNameToPitchClass('C'), chordId: 'major-7' }
			]
		});
		const session = startSession('resolve-note', context, DEFAULT_PRACTICE_SETTINGS);
		const changedProgression = {
			...context,
			progression: [
				{ root: noteNameToPitchClass('A'), chordId: 'dominant-7' },
				{ root: noteNameToPitchClass('D'), chordId: 'major-7' }
			]
		};
		expect(isContextCompatible(session.currentExercise!, changedProgression)).toBe(false);
	});
});

describe('computePracticeStats', () => {
	it('counts attempts, correct, strong alternatives, and distinct completed exercises', () => {
		const context = baseContext({ root: noteNameToPitchClass('C'), chordId: 'dominant-7' });
		let session = startSession('find-interval', context, DEFAULT_PRACTICE_SETTINGS);
		const exercise = session.currentExercise!;

		session = recordAttempt(session, note(exercise.targets[0].pitchClass));
		const stats = computePracticeStats(session.attempts);

		expect(stats.attempts).toBe(1);
		expect(stats.correct).toBe(1);
		expect(stats.exercisesCompleted).toBe(1);
	});
});
