import { describe, expect, it } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';

import { buildNoteExplanation } from '../explanations';
import type { BassNoteExplanationInput } from '../explanations';
import type { BassNoteFunction, BasslineChordContext } from '../types';

const C = noteNameToPitchClass('C');
const E = noteNameToPitchClass('E');
const G = noteNameToPitchClass('G');
const B = noteNameToPitchClass('B');
const D_FLAT = noteNameToPitchClass('Db');

const C7: BasslineChordContext = { root: C, chordId: 'dominant-7', scaleId: 'mixolydian' };
const G7: BasslineChordContext = { root: G, chordId: 'dominant-7', scaleId: 'mixolydian' };

function input(overrides: Partial<BassNoteExplanationInput>): BassNoteExplanationInput {
	return {
		pitchClass: C,
		function: 'root',
		harmonicRole: 'root',
		intervalFromChord: '1',
		intervalFromKey: '1',
		chord: C7,
		...overrides
	};
}

describe('buildNoteExplanation: root', () => {
	it("matches the spec's own worked C7 example", () => {
		const explanation = buildNoteExplanation(input({ pitchClass: C, function: 'root' }));
		expect(explanation.headline).toBe('Root of C7');
		expect(explanation.detail).toBe('Strong tonal anchor.');
		expect(explanation.role).toBe('root');
	});
});

describe('buildNoteExplanation: structural chord tone', () => {
	it('matches the spec\'s own worked "3 of C7" example', () => {
		const explanation = buildNoteExplanation(
			input({
				pitchClass: E,
				function: 'chord-tone',
				harmonicRole: 'structural',
				intervalFromChord: '3'
			})
		);
		expect(explanation.headline).toBe('3 of C7');
		expect(explanation.detail).toContain('Structural chord tone');
	});
});

describe('buildNoteExplanation: chromatic approach', () => {
	it('matches the spec\'s own worked "Db -> C" example, resolving downward', () => {
		// Db sits a semitone above C, so approaching from Db into C resolves downward -- the spec's own literal example.
		const explanation = buildNoteExplanation(
			input({
				pitchClass: D_FLAT,
				function: 'chromatic-approach',
				harmonicRole: 'chromatic-approach',
				chord: C7,
				target: { pitchClass: C, midi: 36, intervalFromChord: '1' }
			})
		);
		expect(explanation.headline).toBe('Chromatic approach to C');
		expect(explanation.detail).toBe('Resolves downward by semitone into the next target.');
	});

	it('matches the spec\'s own worked "B -> C" example, resolving upward', () => {
		// B sits a semitone below C, so approaching from B into C resolves upward.
		const explanation = buildNoteExplanation(
			input({
				pitchClass: B,
				function: 'chromatic-approach',
				target: { pitchClass: C, midi: 36, intervalFromChord: '1' }
			})
		);
		expect(explanation.headline).toBe('Chromatic approach to C');
		expect(explanation.detail).toBe('Resolves upward by semitone into the next target.');
	});
});

describe('buildNoteExplanation: voice-leading target', () => {
	it("matches the spec's own worked G7 -> Cmaj7 guide-tone example", () => {
		const explanation = buildNoteExplanation(
			input({
				pitchClass: B,
				function: 'voice-leading-target',
				harmonicRole: 'structural',
				intervalFromChord: '3',
				chord: G7,
				target: { pitchClass: C, midi: 36, intervalFromChord: '1' }
			})
		);
		expect(explanation.headline).toBe('3 of G7');
		expect(explanation.detail).toContain('C');
		expect(explanation.detail).toContain('Guide tone');
	});
});

describe('buildNoteExplanation: enclosure and diatonic approach reference their target', () => {
	it('enclosure-upper/lower and diatonic-approach headlines name the target note', () => {
		const target = { pitchClass: C, midi: 36, intervalFromChord: '1' as const };
		for (const fn of ['enclosure-upper', 'enclosure-lower', 'diatonic-approach'] as const) {
			const explanation = buildNoteExplanation(input({ pitchClass: E, function: fn, target }));
			expect(explanation.headline).toContain('C');
			expect(explanation.targetMidi).toBe(36);
			expect(explanation.targetInterval).toBe('1');
		}
	});
});

describe('buildNoteExplanation: reserved functions still produce a valid explanation', () => {
	it('passing-tone, pedal, and anticipation all return well-formed explanations', () => {
		for (const fn of ['passing-tone', 'pedal', 'anticipation'] as const) {
			const explanation = buildNoteExplanation(input({ function: fn }));
			expect(explanation.headline.length).toBeGreaterThan(0);
			expect(explanation.detail.length).toBeGreaterThan(0);
		}
	});
});

describe('buildNoteExplanation: no verdict language', () => {
	it('never uses "wrong", "bad", or "forbidden" in any headline or detail, across every function/role', () => {
		const BANNED = ['wrong', 'bad', 'forbidden'];
		const functions: BassNoteFunction[] = [
			'root',
			'chord-tone',
			'scale-tone',
			'passing-tone',
			'chromatic-approach',
			'diatonic-approach',
			'enclosure-upper',
			'enclosure-lower',
			'voice-leading-target',
			'pedal',
			'anticipation'
		];
		const target = { pitchClass: C, midi: 36, intervalFromChord: '1' as const };
		for (const fn of functions) {
			for (const role of [
				'root',
				'structural',
				'stable',
				'extension',
				'color',
				'tension',
				'alteration',
				'chromatic-approach',
				'avoid'
			] as const) {
				const explanation = buildNoteExplanation(
					input({ function: fn, harmonicRole: role, target })
				);
				const text = `${explanation.headline} ${explanation.detail}`.toLowerCase();
				for (const word of BANNED) {
					expect(text).not.toContain(word);
				}
			}
		}
	});
});
