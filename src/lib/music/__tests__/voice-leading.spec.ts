import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '../pitch';
import type { ResolvedChord } from '../progressions';
import { analyzeTransition, connectionFor } from '../voice-leading';

const G7: ResolvedChord = { root: noteNameToPitchClass('G'), chordId: 'dominant-7' };
const Cmaj7: ResolvedChord = { root: noteNameToPitchClass('C'), chordId: 'major-7' };

describe('analyzeTransition', () => {
	it('covers all 12 pitch classes, not just chord tones', () => {
		const transition = analyzeTransition(G7, Cmaj7);
		expect(transition).toHaveLength(12);
		expect(transition.every((c) => c !== undefined)).toBe(true);
	});

	it('connectionFor looks up the same result analyzeConnection would produce', () => {
		const transition = analyzeTransition(G7, Cmaj7);
		const f = connectionFor(transition, noteNameToPitchClass('F'));
		expect(f.currentInterval).toBe('b7');
		expect(f.targets[0].targetInterval).toBe('3');
	});
});
