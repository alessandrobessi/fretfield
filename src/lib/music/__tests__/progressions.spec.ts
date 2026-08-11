import { describe, expect, it } from 'vitest';
import { intervalSemitones } from '../intervals';
import {
	buildProgression,
	getProgressionTemplate,
	listProgressionTemplates,
	resolvedChordSymbol
} from '../progressions';
import { noteNameToPitchClass, normalizePitchClass } from '../pitch';

function symbols(tonicName: string, templateId: string): string[] {
	const tonic = noteNameToPitchClass(tonicName);
	const template = getProgressionTemplate(templateId);
	return buildProgression(tonic, template).map(resolvedChordSymbol);
}

describe('buildProgression — exact chord sequences', () => {
	it('C major ii-V-I -> Dm7 G7 Cmaj7', () => {
		expect(symbols('C', 'major-ii-v-i')).toEqual(['Dm7', 'G7', 'Cmaj7']);
	});

	it('Eb major ii-V-I -> Fm7 Bb7 Ebmaj7', () => {
		expect(symbols('Eb', 'major-ii-v-i')).toEqual(['Fm7', 'Bb7', 'Ebmaj7']);
	});

	it('A major ii-V-I -> Bm7 E7 Amaj7', () => {
		expect(symbols('A', 'major-ii-v-i')).toEqual(['Bm7', 'E7', 'Amaj7']);
	});

	it('C minor iiø-V-i -> Dm7b5 G7 Cm', () => {
		expect(symbols('C', 'minor-ii-v-i')).toEqual(['Dm7b5', 'G7', 'Cm']);
	});
});

describe('buildProgression — transposition invariance', () => {
	it('preserves degree/quality relationships for every template under every tonic', () => {
		for (const template of listProgressionTemplates()) {
			const expectedChordIds = template.degrees.map((d) => d.chordId);
			const expectedOffsets = template.degrees.map((d) => intervalSemitones(d.fromTonic));

			for (let tonic = 0; tonic < 12; tonic++) {
				const resolved = buildProgression(normalizePitchClass(tonic), template);
				expect(resolved).toHaveLength(template.degrees.length);
				expect(resolved.map((r) => r.chordId)).toEqual(expectedChordIds);

				// Every resolved root sits the same interval-from-tonic away, regardless of tonic.
				const actualOffsets = resolved.map((r) => (r.root - tonic + 12) % 12);
				expect(actualOffsets).toEqual(expectedOffsets);
			}
		}
	});
});

describe('listProgressionTemplates / getProgressionTemplate', () => {
	it('exposes all 5 MVP templates', () => {
		const ids = listProgressionTemplates().map((t) => t.id);
		expect(ids).toEqual(['major-ii-v-i', 'minor-ii-v-i', 'i-vi-ii-v', 'i-iv-v', '12-bar-blues']);
	});

	it('the 12-bar blues template has exactly 12 degrees, all dominant 7', () => {
		const template = getProgressionTemplate('12-bar-blues');
		expect(template.degrees).toHaveLength(12);
		expect(template.degrees.every((d) => d.chordId === 'dominant-7')).toBe(true);
	});

	it('throws for an unknown template id', () => {
		expect(() => getProgressionTemplate('not-a-template')).toThrow();
	});
});
