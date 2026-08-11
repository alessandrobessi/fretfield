import { describe, expect, it } from 'vitest';
import { analyzeConnection } from '../connection-score';
import { type PitchClass, noteNameToPitchClass } from '../pitch';
import type { ResolvedChord } from '../progressions';

const G7: ResolvedChord = { root: noteNameToPitchClass('G'), chordId: 'dominant-7' };
const Cmaj7: ResolvedChord = { root: noteNameToPitchClass('C'), chordId: 'major-7' };

function bestTarget(pitchClass: PitchClass, current: ResolvedChord, next: ResolvedChord) {
	const connection = analyzeConnection(pitchClass, current, next);
	return connection.targets[0];
}

describe('analyzeConnection — G7 -> Cmaj7 (derived, not hardcoded)', () => {
	it('F (b7 of G7) resolves down a half-step to E (3 of Cmaj7) as its strongest target', () => {
		const f = noteNameToPitchClass('F');
		const connection = analyzeConnection(f, G7, Cmaj7);
		expect(connection.currentInterval).toBe('b7');
		expect(connection.currentRole).toBe('structural');

		const best = bestTarget(f, G7, Cmaj7);
		expect(best.targetPitchClass).toBe(noteNameToPitchClass('E'));
		expect(best.targetInterval).toBe('3');
		expect(best.semitoneMovement).toBe(-1);
	});

	it('B (3 of G7) resolves up a half-step to C (root of Cmaj7) as its strongest target', () => {
		const b = noteNameToPitchClass('B');
		const connection = analyzeConnection(b, G7, Cmaj7);
		expect(connection.currentInterval).toBe('3');
		expect(connection.currentRole).toBe('structural');

		const best = bestTarget(b, G7, Cmaj7);
		expect(best.targetPitchClass).toBe(noteNameToPitchClass('C'));
		expect(best.targetInterval).toBe('1');
		expect(best.semitoneMovement).toBe(1);
	});

	it('G (root of G7) is a common tone with Cmaj7 (its 5th)', () => {
		const g = noteNameToPitchClass('G');
		const connection = analyzeConnection(g, G7, Cmaj7);
		expect(connection.commonTone).toBe(true);
		const zeroMovementTarget = connection.targets.find((t) => t.semitoneMovement === 0);
		expect(zeroMovementTarget?.targetPitchClass).toBe(g);
	});

	it('guide-tone half-step resolutions (F->E, B->C) outscore a passive common tone (G->G)', () => {
		const f = analyzeConnection(noteNameToPitchClass('F'), G7, Cmaj7);
		const b = analyzeConnection(noteNameToPitchClass('B'), G7, Cmaj7);
		const g = analyzeConnection(noteNameToPitchClass('G'), G7, Cmaj7);

		expect(f.connectionStrength).toBeGreaterThan(g.connectionStrength);
		expect(b.connectionStrength).toBeGreaterThan(g.connectionStrength);
	});

	it('chromatic approaches are not penalized by default — a convincing target can still score well', () => {
		// Db (#11/tension of G7, not a chord tone) resolves down a half-step into C (root of Cmaj7).
		const db = noteNameToPitchClass('Db');
		const connection = analyzeConnection(db, G7, Cmaj7);
		const best = connection.targets[0];
		expect(best.targetPitchClass).toBe(noteNameToPitchClass('C'));
		expect(best.semitoneMovement).toBe(-1);
		expect(connection.connectionStrength).toBeGreaterThan(0);
	});
});

describe('analyzeConnection — every chord tone of the next chord is a candidate target', () => {
	it('returns one target per required interval of the next chord', () => {
		const connection = analyzeConnection(noteNameToPitchClass('G'), G7, Cmaj7);
		expect(connection.targets).toHaveLength(4); // Cmaj7: 1 3 5 7
	});
});
