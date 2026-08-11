import { describe, expect, it } from 'vitest';
import { getProgressionTemplate, buildProgression } from '../progressions';
import { noteNameToPitchClass } from '../pitch';
import type { ResolvedChord } from '../progressions';
import { STANDARD_4_STRING_TUNING } from '../tuning';
import { findVoiceLeadingPaths } from '../voice-leading-paths';

const C_II_V_I = buildProgression(
	noteNameToPitchClass('C'),
	getProgressionTemplate('major-ii-v-i')
);

describe('findVoiceLeadingPaths — structural invariants', () => {
	it('returns exactly one node per chord in the progression', () => {
		const [path] = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20);
		expect(path.positions).toHaveLength(C_II_V_I.length);
	});

	it('every position is within the fretboard bounds', () => {
		const paths = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20);
		for (const path of paths) {
			for (const position of path.positions) {
				expect(position.fret).toBeGreaterThanOrEqual(0);
				expect(position.fret).toBeLessThanOrEqual(20);
				expect(position.stringIndex).toBeGreaterThanOrEqual(0);
				expect(position.stringIndex).toBeLessThan(STANDARD_4_STRING_TUNING.length);
			}
		}
	});

	it('is deterministic: the same input produces the same ranked output', () => {
		const a = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20);
		const b = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20);
		expect(a).toEqual(b);
	});

	it('ranks paths by descending total score', () => {
		const paths = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20);
		for (let i = 1; i < paths.length; i++) {
			expect(paths[i - 1].score.total).toBeGreaterThanOrEqual(paths[i].score.total);
		}
	});

	it('respects the k option', () => {
		const paths = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, { k: 1 });
		expect(paths).toHaveLength(1);
	});
});

describe('findVoiceLeadingPaths — edge cases', () => {
	it('handles a two-chord progression', () => {
		const twoChords: ResolvedChord[] = C_II_V_I.slice(0, 2);
		const paths = findVoiceLeadingPaths(twoChords, STANDARD_4_STRING_TUNING, 20);
		expect(paths[0].positions).toHaveLength(2);
	});

	it('handles repeated chords (same chord back to back)', () => {
		const repeated: ResolvedChord[] = [C_II_V_I[0], C_II_V_I[0], C_II_V_I[0]];
		const paths = findVoiceLeadingPaths(repeated, STANDARD_4_STRING_TUNING, 20);
		expect(paths[0].positions).toHaveLength(3);
	});

	it('handles open strings (fretCount includes fret 0)', () => {
		// Not asserting an open string is chosen (that depends on scoring), only that a
		// fretboard whose only fret is the open string (fret 0) still yields a valid path.
		const paths = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 0);
		expect(paths[0]?.positions).toHaveLength(C_II_V_I.length);
	});

	it('a region entirely outside the fretboard returns an empty array, not a throw', () => {
		// fretCount is 20, so no position can ever have fret 25 or 26 — every chord's
		// candidate layer is guaranteed empty.
		const impossibleRegion = { id: 'x', minFret: 25, maxFret: 26 };
		expect(
			findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, { region: impossibleRegion })
		).toEqual([]);
	});

	it('returns [] for an empty progression', () => {
		expect(findVoiceLeadingPaths([], STANDARD_4_STRING_TUNING, 20)).toEqual([]);
	});

	it('duplicate pitch classes across strings are all valid distinct candidates', () => {
		// C appears on multiple strings; the DP must be free to choose any of them independently per chord.
		const paths = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, { k: 3 });
		expect(paths.length).toBeGreaterThan(0);
	});
});

describe('findVoiceLeadingPaths — transposition equivalence', () => {
	it('a progression transposed to a different tonic yields a path with the same interval relationships', () => {
		const template = getProgressionTemplate('major-ii-v-i');
		const cProgression = buildProgression(noteNameToPitchClass('C'), template);
		const ebProgression = buildProgression(noteNameToPitchClass('Eb'), template);

		const cPath = findVoiceLeadingPaths(cProgression, STANDARD_4_STRING_TUNING, 20, { k: 1 })[0];
		const ebPath = findVoiceLeadingPaths(ebProgression, STANDARD_4_STRING_TUNING, 20, {
			k: 1
		})[0];

		// Every chosen pitch, expressed as an interval from its chord's own root, matches
		// across the two keys — the path is functionally equivalent even if the specific
		// frets/strings differ near the neck's boundaries.
		const cIntervals = cPath.positions.map(
			(p, i) => (p.pitchClass - cProgression[i].root + 12) % 12
		);
		const ebIntervals = ebPath.positions.map(
			(p, i) => (p.pitchClass - ebProgression[i].root + 12) % 12
		);
		expect(ebIntervals).toEqual(cIntervals);
	});
});

function totalFretDistance(positions: { fret: number }[]): number {
	let total = 0;
	for (let i = 1; i < positions.length; i++) {
		total += Math.abs(positions[i].fret - positions[i - 1].fret);
	}
	return total;
}

describe('findVoiceLeadingPaths — presets change behavior', () => {
	it('minimal-movement travels no more total fret distance than the guide-tones preset', () => {
		const minimal = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, {
			preset: 'minimal-movement',
			k: 1
		})[0];
		const guideTones = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, {
			preset: 'guide-tones',
			k: 1
		})[0];
		expect(totalFretDistance(minimal.positions)).toBeLessThanOrEqual(
			totalFretDistance(guideTones.positions)
		);
	});

	it('all three presets produce a complete path', () => {
		for (const preset of ['balanced', 'minimal-movement', 'guide-tones'] as const) {
			const [path] = findVoiceLeadingPaths(C_II_V_I, STANDARD_4_STRING_TUNING, 20, { preset });
			expect(path.positions).toHaveLength(C_II_V_I.length);
		}
	});
});
