import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '../../music/pitch';
import {
	decodeStateFromSearchParams,
	encodeStateToSearchParams,
	type URLState
} from '../url-state';

const FULL_STATE: URLState = {
	root: noteNameToPitchClass('C'),
	mode: 'progression',
	chordId: 'dominant-7',
	displayMode: 'both',
	analysisMode: 'chord-tones',
	progressionTemplateId: 'major-ii-v-i',
	activeChordIndex: 1,
	pathPreset: 'guide-tones',
	region: { minFret: 2, maxFret: 6 }
};

const DEFAULT_STATE: URLState = {
	root: null,
	mode: 'chord',
	chordId: 'major',
	displayMode: 'intervals',
	analysisMode: 'field',
	progressionTemplateId: null,
	activeChordIndex: 0,
	pathPreset: 'balanced',
	region: null
};

describe('encodeStateToSearchParams', () => {
	it('omits every field that matches the default, for short shareable URLs', () => {
		const params = encodeStateToSearchParams(DEFAULT_STATE);
		expect(params.toString()).toBe('');
	});

	it('encodes every non-default field', () => {
		const params = encodeStateToSearchParams(FULL_STATE);
		expect(params.get('root')).toBe('C');
		expect(params.get('mode')).toBe('progression');
		expect(params.get('chord')).toBe('dominant-7');
		expect(params.get('display')).toBe('both');
		expect(params.get('analysis')).toBe('chord-tones');
		expect(params.get('progression')).toBe('major-ii-v-i');
		expect(params.get('chordIndex')).toBe('1');
		expect(params.get('pathPreset')).toBe('guide-tones');
		expect(params.get('region')).toBe('2-6');
	});
});

describe('decodeStateFromSearchParams', () => {
	it('round-trips a fully-populated state', () => {
		const params = encodeStateToSearchParams(FULL_STATE);
		const decoded = decodeStateFromSearchParams(params);
		expect(decoded).toEqual(FULL_STATE);
	});

	it('returns an empty object for an empty query string', () => {
		expect(decodeStateFromSearchParams(new URLSearchParams(''))).toEqual({});
	});

	it('silently ignores an invalid root note name', () => {
		const decoded = decodeStateFromSearchParams(new URLSearchParams('root=not-a-note'));
		expect(decoded.root).toBeUndefined();
	});

	it('silently ignores an unknown mode/chord/progression/preset', () => {
		const decoded = decodeStateFromSearchParams(
			new URLSearchParams('mode=bogus&chord=bogus&progression=bogus&pathPreset=bogus')
		);
		expect(decoded).toEqual({});
	});

	it('silently ignores a malformed region', () => {
		expect(decodeStateFromSearchParams(new URLSearchParams('region=abc')).region).toBeUndefined();
		expect(decodeStateFromSearchParams(new URLSearchParams('region=6-2')).region).toBeUndefined();
	});

	it('silently ignores a negative or non-numeric chordIndex', () => {
		expect(
			decodeStateFromSearchParams(new URLSearchParams('chordIndex=-1')).activeChordIndex
		).toBeUndefined();
		expect(
			decodeStateFromSearchParams(new URLSearchParams('chordIndex=abc')).activeChordIndex
		).toBeUndefined();
	});

	it('never throws on a garbage query string', () => {
		expect(() =>
			decodeStateFromSearchParams(new URLSearchParams('a=b&c=d&root=&mode='))
		).not.toThrow();
	});
});
