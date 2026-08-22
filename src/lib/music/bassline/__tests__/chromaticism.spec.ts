import { describe, expect, it } from 'vitest';

import { normalizePitchClass } from '$lib/music/pitch';
import type { PitchClass } from '$lib/music/pitch';

import type { BassPitchCandidate } from '../candidates';
import type { ChromaticismNoteInput } from '../chromaticism';
import { applyChromaticism } from '../chromaticism';
import { createBasslineRandom } from '../random';
import { getBasslineStyleProfile } from '../styles';
import type { BasslineChordContext } from '../types';
import { pitchClassDistance } from '../voice-leading';

const CHORD: BasslineChordContext = {
	root: normalizePitchClass(0),
	chordId: 'major-7',
	scaleId: 'ionian'
};

const CHROMATIC_STYLE = getBasslineStyleProfile('chromatic');

function candidate(
	pitchClass: PitchClass,
	role: BassPitchCandidate['harmonicRole'],
	overrides: Partial<BassPitchCandidate> = {}
): BassPitchCandidate {
	return {
		pitchClass,
		intervalFromChord: '1',
		intervalFromKey: '1',
		harmonicRole: role,
		source: role === 'root' ? 'root' : 'chord',
		localScore: 0,
		...overrides
	};
}

function note(overrides: Partial<ChromaticismNoteInput> = {}): ChromaticismNoteInput {
	return {
		barIndex: 0,
		stepIndex: 0,
		candidate: candidate(normalizePitchClass(4), 'color'),
		chord: CHORD,
		strongBeat: false,
		beatGroupStart: false,
		weakSubdivision: true,
		...overrides
	};
}

/** target(x): a root/structural/stable note eligible to be approached. */
function target(pitchClass: PitchClass, stepIndex: number): ChromaticismNoteInput {
	return note({
		stepIndex,
		strongBeat: true,
		beatGroupStart: true,
		weakSubdivision: false,
		candidate: candidate(pitchClass, 'root')
	});
}

/** weak(x): an eligible, non-target-role approach slot. */
function weak(pitchClass: PitchClass, stepIndex: number): ChromaticismNoteInput {
	return note({
		stepIndex,
		strongBeat: false,
		beatGroupStart: false,
		weakSubdivision: true,
		candidate: candidate(pitchClass, 'color')
	});
}

/** strong(x): a non-target-role note that is NOT eligible, because it sits on a strong position. */
function strong(pitchClass: PitchClass, stepIndex: number): ChromaticismNoteInput {
	return note({
		stepIndex,
		strongBeat: false,
		beatGroupStart: true,
		weakSubdivision: false,
		candidate: candidate(pitchClass, 'extension')
	});
}

const C = normalizePitchClass(0);
const E = normalizePitchClass(4);
const G = normalizePitchClass(7);

describe('applyChromaticism: chromaticism 0 produces no transform', () => {
	it('returns [] regardless of style or random stream', () => {
		const sequence = [weak(E, 0), target(C, 1), weak(E, 2), target(G, 3)];
		for (let seed = 0; seed < 10; seed++) {
			expect(applyChromaticism(sequence, CHROMATIC_STYLE, 0, createBasslineRandom(seed))).toEqual(
				[]
			);
		}
	});
});

describe('applyChromaticism: chromatic approach resolves by semitone', () => {
	it('every chromatic-approach transform lands exactly 1 semitone from its target', () => {
		const chromaticOnlyStyle = { ...CHROMATIC_STYLE, enclosureWeight: 0, passingToneWeight: 0 };
		const sequence = [weak(E, 0), target(C, 1), weak(E, 2), target(G, 3)];
		for (let seed = 0; seed < 50; seed++) {
			const transforms = applyChromaticism(
				sequence,
				chromaticOnlyStyle,
				100,
				createBasslineRandom(seed)
			);
			for (const t of transforms) {
				expect(t.function).toBe('chromatic-approach');
				const targetPitchClass = sequence[t.targetIndex].candidate.pitchClass;
				expect(pitchClassDistance(t.pitchClass, targetPitchClass)).toBe(1);
			}
		}
	});
});

describe('applyChromaticism: target remains unchanged', () => {
	it('no transform ever replaces a note that is itself a resolved target', () => {
		const sequence = [weak(E, 0), target(C, 1), weak(E, 2), target(G, 3), weak(E, 4), target(E, 5)];
		for (let seed = 0; seed < 50; seed++) {
			const transforms = applyChromaticism(
				sequence,
				CHROMATIC_STYLE,
				100,
				createBasslineRandom(seed)
			);
			const targetIndices = new Set(transforms.map((t) => t.targetIndex));
			for (const t of transforms) {
				expect(targetIndices.has(t.index)).toBe(false);
				expect(['root', 'structural', 'stable']).toContain(
					sequence[t.targetIndex].candidate.harmonicRole
				);
			}
		}
	});
});

describe('applyChromaticism: weak-slot preference', () => {
	it('never transforms a strong-beat or beat-group-start note', () => {
		const sequence = [strong(E, 0), target(C, 1), strong(G, 2), target(E, 3)];
		for (let seed = 0; seed < 50; seed++) {
			const transforms = applyChromaticism(
				sequence,
				CHROMATIC_STYLE,
				100,
				createBasslineRandom(seed)
			);
			expect(transforms).toEqual([]); // the only candidate approach slots are strong, so nothing is eligible
		}
	});

	it('only ever transforms notes flagged weakSubdivision', () => {
		const sequence = [weak(E, 0), target(C, 1), weak(G, 2), target(E, 3)];
		for (let seed = 0; seed < 50; seed++) {
			const transforms = applyChromaticism(
				sequence,
				CHROMATIC_STYLE,
				100,
				createBasslineRandom(seed)
			);
			for (const t of transforms) {
				expect(sequence[t.index].weakSubdivision).toBe(true);
				expect(sequence[t.index].strongBeat).toBe(false);
			}
		}
	});
});

describe('applyChromaticism: no dangling end-of-cycle approach', () => {
	it("wraps a trailing approach slot around to bar 0's target rather than leaving it unresolved", () => {
		// The cycle's very last note is an eligible weak slot; the cycle's
		// first note is a target -- a legitimate wrap-around resolution
		// (spec: "wrap-aware turnaround resolution is allowed").
		const sequence = [target(C, 0), target(G, 1), weak(E, 2)];
		const chromaticOnlyStyle = { ...CHROMATIC_STYLE, enclosureWeight: 0, passingToneWeight: 0 };
		// chromaticism=100 makes random.chance(100) unconditionally true, so
		// the wrap-around transform is guaranteed to fire, not just possible.
		const transforms = applyChromaticism(
			sequence,
			chromaticOnlyStyle,
			100,
			createBasslineRandom(3)
		);
		const wrapping = transforms.find((t) => t.index === 2);
		expect(wrapping).toBeDefined();
		expect(wrapping?.targetIndex).toBe(0);
	});

	it('every transform this function ever returns references a real, in-range target index', () => {
		const sequence = [weak(E, 0), target(C, 1), weak(G, 2), target(E, 3)];
		for (let seed = 0; seed < 50; seed++) {
			const transforms = applyChromaticism(
				sequence,
				CHROMATIC_STYLE,
				100,
				createBasslineRandom(seed)
			);
			for (const t of transforms) {
				expect(t.targetIndex).toBeGreaterThanOrEqual(0);
				expect(t.targetIndex).toBeLessThan(sequence.length);
			}
		}
	});
});

describe('applyChromaticism: enclosure needs two slots', () => {
	it('never fires when only one eligible approach slot precedes the target, even at maximum enclosure weight', () => {
		const enclosureOnlyStyle = {
			...CHROMATIC_STYLE,
			chromaticApproachWeight: 0,
			passingToneWeight: 0,
			enclosureWeight: 100
		};
		// prevPrev (index 0) is a strong slot -- not eligible -- so only index 1 can ever be transformed.
		const sequence = [strong(G, 0), weak(E, 1), target(C, 2)];
		for (let seed = 0; seed < 30; seed++) {
			const transforms = applyChromaticism(
				sequence,
				enclosureOnlyStyle,
				100,
				createBasslineRandom(seed)
			);
			expect(
				transforms.every(
					(t) => t.function !== 'enclosure-upper' && t.function !== 'enclosure-lower'
				)
			).toBe(true);
			expect(transforms.length).toBeLessThanOrEqual(1);
		}
	});

	it('fires as a genuine two-note transform when both preceding slots are eligible', () => {
		const enclosureOnlyStyle = {
			...CHROMATIC_STYLE,
			chromaticApproachWeight: 0,
			passingToneWeight: 0,
			enclosureWeight: 100
		};
		const sequence = [weak(G, 0), weak(E, 1), target(C, 2)];
		let sawEnclosure = false;
		for (let seed = 0; seed < 30; seed++) {
			const transforms = applyChromaticism(
				sequence,
				enclosureOnlyStyle,
				100,
				createBasslineRandom(seed)
			);
			if (transforms.length === 2) {
				sawEnclosure = true;
				const functions = transforms.map((t) => t.function).sort();
				expect(functions).toEqual(['enclosure-lower', 'enclosure-upper']);
				expect(transforms.map((t) => t.index).sort()).toEqual([0, 1]);
			}
		}
		expect(sawEnclosure).toBe(true);
	});
});
