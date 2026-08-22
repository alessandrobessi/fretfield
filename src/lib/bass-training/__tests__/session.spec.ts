import { describe, expect, it } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';

import { evaluateBassAttempt } from '../evaluate';
import {
	advanceAfterFeedback,
	beginWaitingForNote,
	createBassTrainingSession,
	finishListening,
	recordAttempt,
	startListening,
	summarizeBassTrainingSession
} from '../session';
import type { BassTrainingSession } from '../types';
import type {
	GeneratedBassBar,
	GeneratedBassNoteStep,
	GeneratedBassRestStep
} from '$lib/music/bassline/types';

const C = noteNameToPitchClass('C');

function noteStep(
	midi: number,
	overrides: Partial<GeneratedBassNoteStep> = {}
): GeneratedBassNoteStep {
	return {
		stepIndex: 0,
		active: true,
		midi,
		pitchClass: C,
		intervalFromChord: '1',
		intervalFromKey: '1',
		function: 'root',
		harmonicRole: 'root',
		accent: false,
		slide: false,
		gate: 78,
		probability: 100,
		ratchet: 1,
		preferredPosition: null,
		alternativePositions: [],
		explanation: {
			headline: 'Root of C',
			detail: 'Strong tonal anchor.',
			role: 'root',
			function: 'root',
			intervalFromChord: '1',
			intervalFromKey: '1'
		},
		...overrides
	};
}

function restStep(stepIndex: number): GeneratedBassRestStep {
	return { stepIndex, active: false };
}

function bar(steps: (GeneratedBassNoteStep | GeneratedBassRestStep)[]): GeneratedBassBar {
	return {
		barIndex: 2,
		phraseRole: 'main',
		chord: { root: C, chordId: 'major-7', scaleId: 'ionian' },
		steps
	};
}

describe('createBassTrainingSession', () => {
	it('keeps only active steps as targets, in phase idle, at targetIndex 0, with no attempts', () => {
		const session = createBassTrainingSession(
			bar([
				restStep(0),
				noteStep(40, { stepIndex: 1 }),
				restStep(2),
				noteStep(45, { stepIndex: 3 })
			])
		);
		expect(session.phase).toBe('idle');
		expect(session.targetIndex).toBe(0);
		expect(session.attempts).toEqual([]);
		expect(session.targets).toHaveLength(2);
		expect(session.targets.map((t) => t.midi)).toEqual([40, 45]);
	});

	it('carries the bar index through unchanged', () => {
		const session = createBassTrainingSession(bar([noteStep(40)]));
		expect(session.barIndex).toBe(2);
	});
});

describe('phase transitions: happy path', () => {
	function twoTargetSession(): BassTrainingSession {
		return createBassTrainingSession(bar([noteStep(40), noteStep(45)]));
	}

	it('idle -> listen -> ready -> waiting', () => {
		let session = twoTargetSession();
		session = startListening(session);
		expect(session.phase).toBe('listen');
		session = finishListening(session);
		expect(session.phase).toBe('ready');
		session = beginWaitingForNote(session);
		expect(session.phase).toBe('waiting');
	});
});

describe('phase transitions: guards against out-of-order calls', () => {
	it('startListening is a no-op unless phase is idle', () => {
		const ready = beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(40)]))))
		);
		expect(startListening(ready)).toEqual(ready);
	});

	it('finishListening is a no-op unless phase is listen', () => {
		const idle = createBassTrainingSession(bar([noteStep(40)]));
		expect(finishListening(idle)).toEqual(idle);
	});

	it('beginWaitingForNote is a no-op unless phase is ready', () => {
		const listen = startListening(createBassTrainingSession(bar([noteStep(40)])));
		expect(beginWaitingForNote(listen)).toEqual(listen);
	});

	it('recordAttempt is a no-op unless phase is waiting', () => {
		const idle = createBassTrainingSession(bar([noteStep(40)]));
		expect(recordAttempt(idle, 40)).toEqual(idle);
	});

	it('advanceAfterFeedback is a no-op unless phase is feedback', () => {
		const idle = createBassTrainingSession(bar([noteStep(40)]));
		expect(advanceAfterFeedback(idle)).toEqual(idle);
	});

	it('startListening never leaves idle when the bar has no active steps at all', () => {
		const empty = createBassTrainingSession(bar([restStep(0), restStep(1)]));
		expect(startListening(empty).phase).toBe('idle');
	});
});

describe('recordAttempt: evaluation and attempt recording', () => {
	function waitingSession(midi: number): BassTrainingSession {
		return beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(midi)]))))
		);
	}

	it('records a correct attempt and moves to feedback', () => {
		const session = recordAttempt(waitingSession(40), 40);
		expect(session.phase).toBe('feedback');
		expect(session.attempts).toEqual([{ expectedMidi: 40, playedMidi: 40, result: 'correct' }]);
	});

	it('records a right-class-wrong-octave attempt', () => {
		const session = recordAttempt(waitingSession(40), 52); // same pitch class, +1 octave
		expect(session.attempts[0].result).toBe('right-class-wrong-octave');
	});

	it('records an incorrect attempt', () => {
		const session = recordAttempt(waitingSession(40), 41);
		expect(session.attempts[0].result).toBe('incorrect');
	});

	it('does not mutate targetIndex when recording -- only advanceAfterFeedback does', () => {
		const before = waitingSession(40);
		const after = recordAttempt(before, 40);
		expect(after.targetIndex).toBe(before.targetIndex);
	});
});

describe('advanceAfterFeedback: target advance and completion', () => {
	it('a correct attempt with more targets remaining advances to waiting on the next target', () => {
		let session = beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(40), noteStep(45)]))))
		);
		session = recordAttempt(session, 40);
		session = advanceAfterFeedback(session);
		expect(session.phase).toBe('waiting');
		expect(session.targetIndex).toBe(1);
	});

	it('a correct attempt on the last target completes the session', () => {
		let session = beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(40)]))))
		);
		session = recordAttempt(session, 40);
		session = advanceAfterFeedback(session);
		expect(session.phase).toBe('complete');
	});

	it('an incorrect attempt remains on the same target (targetIndex unchanged), back to waiting', () => {
		let session = beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(40), noteStep(45)]))))
		);
		session = recordAttempt(session, 41);
		session = advanceAfterFeedback(session);
		expect(session.phase).toBe('waiting');
		expect(session.targetIndex).toBe(0);
	});

	it('a right-class-wrong-octave attempt also remains on the same target', () => {
		let session = beginWaitingForNote(
			finishListening(startListening(createBassTrainingSession(bar([noteStep(40), noteStep(45)]))))
		);
		session = recordAttempt(session, 52);
		session = advanceAfterFeedback(session);
		expect(session.phase).toBe('waiting');
		expect(session.targetIndex).toBe(0);
	});
});

describe('a full session run end to end', () => {
	it('walks a 2-target session through a failed retry and two eventual successes, completing with the right summary', () => {
		let session = createBassTrainingSession(bar([noteStep(40), noteStep(45)]));
		session = startListening(session);
		session = finishListening(session);
		session = beginWaitingForNote(session);

		// First target: miss, then hit.
		session = advanceAfterFeedback(recordAttempt(session, 41));
		expect(session.phase).toBe('waiting');
		expect(session.targetIndex).toBe(0);
		session = advanceAfterFeedback(recordAttempt(session, 40));
		expect(session.phase).toBe('waiting');
		expect(session.targetIndex).toBe(1);

		// Second (last) target: hit immediately.
		session = advanceAfterFeedback(recordAttempt(session, 45));
		expect(session.phase).toBe('complete');

		expect(session.attempts).toHaveLength(3);
		expect(summarizeBassTrainingSession(session)).toEqual({ correct: 2, total: 3 });
	});
});

describe('evaluateBassAttempt', () => {
	it('the same MIDI is correct', () => {
		expect(evaluateBassAttempt(40, 40)).toBe('correct');
	});

	it('the same pitch class in a different octave is right-class-wrong-octave', () => {
		expect(evaluateBassAttempt(40, 28)).toBe('right-class-wrong-octave'); // -1 octave
		expect(evaluateBassAttempt(40, 52)).toBe('right-class-wrong-octave'); // +1 octave
		expect(evaluateBassAttempt(40, 64)).toBe('right-class-wrong-octave'); // +2 octaves
	});

	it('a different pitch class is incorrect, regardless of octave', () => {
		expect(evaluateBassAttempt(40, 41)).toBe('incorrect');
		expect(evaluateBassAttempt(40, 53)).toBe('incorrect'); // one semitone + an octave
	});
});
