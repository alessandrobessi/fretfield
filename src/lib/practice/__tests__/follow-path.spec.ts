import { describe, expect, it } from 'vitest';
import type { FretPosition } from '$lib/music/fretboard';
import { noteNameToPitchClass } from '$lib/music/pitch';
import type { VoiceLeadingPath } from '$lib/music/voice-leading-paths';
import { createPathExercise } from '../exercise-generators';
import { advanceToNextExercise, recordAttempt, startSession } from '../practice-engine';
import { DEFAULT_PRACTICE_SETTINGS } from '../types';
import { baseContext, note } from './test-helpers';

function pos(stringIndex: number, fret: number, letter: string): FretPosition {
	return { stringIndex, fret, pitchClass: noteNameToPitchClass(letter) };
}

const progression = [
	{ root: noteNameToPitchClass('D'), chordId: 'minor-7' },
	{ root: noteNameToPitchClass('G'), chordId: 'dominant-7' },
	{ root: noteNameToPitchClass('C'), chordId: 'major-7' }
];

// C -> B -> C, the exact example from the product spec.
const path: VoiceLeadingPath = {
	positions: [pos(0, 8, 'C'), pos(0, 7, 'B'), pos(0, 8, 'C')],
	score: { harmonic: 0, movement: 0, position: 0, style: 0, total: 0 }
};

describe('Follow Path', () => {
	it('presents each step from the same fixed path, never recomputing a different one', () => {
		const context = baseContext({ progression, selectedPath: path });
		const step0 = createPathExercise(context, path, { stepIndex: 0 });
		const step1 = createPathExercise(context, path, { stepIndex: 1 });
		const step2 = createPathExercise(context, path, { stepIndex: 2 });

		expect(step0!.targets[0].pitchClass).toBe(noteNameToPitchClass('C'));
		expect(step1!.targets[0].pitchClass).toBe(noteNameToPitchClass('B'));
		expect(step2!.targets[0].pitchClass).toBe(noteNameToPitchClass('C'));
	});

	it('C completes step 1, sustained/repeated C does not skip step 2, B completes step 2, C completes the path', () => {
		const context = baseContext({ progression, selectedPath: path });
		let session = startSession('follow-path', context, DEFAULT_PRACTICE_SETTINGS, { path });
		expect(session.status).toBe('active');
		expect(
			session.currentExercise?.prompt.kind === 'follow-path' &&
				session.currentExercise.prompt.stepIndex
		).toBe(0);

		// Step 1: C completes it.
		session = recordAttempt(session, note(noteNameToPitchClass('C')));
		expect(session.lastEvaluation?.result).toBe('exact');
		session = advanceToNextExercise(session, context, { path });
		expect(
			session.currentExercise?.prompt.kind === 'follow-path' &&
				session.currentExercise.prompt.stepIndex
		).toBe(1);

		// Step 2 expects B. A repeated/sustained C (wrong note here) must not advance past it.
		session = recordAttempt(session, note(noteNameToPitchClass('C')));
		expect(session.lastEvaluation?.result).toBe('incorrect');
		session = advanceToNextExercise(session, context, { path });
		expect(
			session.currentExercise?.prompt.kind === 'follow-path' &&
				session.currentExercise.prompt.stepIndex
		).toBe(1);
		session = recordAttempt(session, note(noteNameToPitchClass('C')));
		expect(session.lastEvaluation?.result).toBe('incorrect');
		session = advanceToNextExercise(session, context, { path });
		expect(
			session.currentExercise?.prompt.kind === 'follow-path' &&
				session.currentExercise.prompt.stepIndex
		).toBe(1);

		// B completes step 2.
		session = recordAttempt(session, note(noteNameToPitchClass('B')));
		expect(session.lastEvaluation?.result).toBe('exact');
		session = advanceToNextExercise(session, context, { path });
		expect(
			session.currentExercise?.prompt.kind === 'follow-path' &&
				session.currentExercise.prompt.stepIndex
		).toBe(2);

		// C completes the path.
		session = recordAttempt(session, note(noteNameToPitchClass('C')));
		expect(session.lastEvaluation?.result).toBe('exact');
		session = advanceToNextExercise(session, context, { path });
		expect(session.status).toBe('completed');
		expect(session.currentExercise).toBeNull();
	});

	it('returns null for a step index outside the path', () => {
		const context = baseContext({ progression, selectedPath: path });
		expect(createPathExercise(context, path, { stepIndex: 3 })).toBeNull();
		expect(createPathExercise(context, path, { stepIndex: -1 })).toBeNull();
	});
});
