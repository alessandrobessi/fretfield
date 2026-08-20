import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '../../music/pitch';
import {
	decodeStateFromSearchParams,
	encodeStateToSearchParams,
	type URLState
} from '../url-state';

const FULL_STATE: URLState = {
	root: noteNameToPitchClass('C'),
	chordId: 'dominant-7',
	displayMode: 'both',
	analysisMode: 'chord-tones'
};

const DEFAULT_STATE: URLState = {
	root: null,
	chordId: 'major',
	displayMode: 'intervals',
	analysisMode: 'field'
};

describe('encodeStateToSearchParams', () => {
	it('omits every field that matches the default, for short shareable URLs', () => {
		const params = encodeStateToSearchParams(DEFAULT_STATE);
		expect(params.toString()).toBe('');
	});

	it('encodes every non-default field', () => {
		const params = encodeStateToSearchParams(FULL_STATE);
		expect(params.get('root')).toBe('C');
		expect(params.get('chord')).toBe('dominant-7');
		expect(params.get('display')).toBe('both');
		expect(params.get('analysis')).toBe('chord-tones');
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

	it('silently ignores an unknown chord id', () => {
		const decoded = decodeStateFromSearchParams(new URLSearchParams('chord=bogus'));
		expect(decoded).toEqual({});
	});

	it('never throws on a garbage query string', () => {
		expect(() =>
			decodeStateFromSearchParams(new URLSearchParams('a=b&c=d&root=&mode='))
		).not.toThrow();
	});
});
