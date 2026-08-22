import { describe, expect, it } from 'vitest';

import { getBasslineStyleProfile, listBasslineStyleProfiles } from '../styles';
import type { BasslineStyleId } from '../types';

const ALL_STYLE_IDS: readonly BasslineStyleId[] = [
	'rooted',
	'funk',
	'acid',
	'chromatic',
	'melodic',
	'walking'
];

const PERCENT_FIELDS = [
	'rhythmicDensity',
	'syncopation',
	'rootWeight',
	'chordToneWeight',
	'scaleToneWeight',
	'chromaticApproachWeight',
	'enclosureWeight',
	'passingToneWeight',
	'repetitionPreference',
	'octaveJumpPreference',
	'movementPreference',
	'strongBeatTargeting',
	'accentDensity',
	'slideDensity',
	'preferredGate'
] as const;

describe('listBasslineStyleProfiles', () => {
	it('lists exactly the six spec-defined styles', () => {
		const profiles = listBasslineStyleProfiles();
		expect(profiles).toHaveLength(6);
		expect(profiles.map((p) => p.id).sort()).toEqual([...ALL_STYLE_IDS].sort());
	});

	it('every field is a finite number, and every 0-100 field is actually within 0-100', () => {
		for (const profile of listBasslineStyleProfiles()) {
			for (const field of PERCENT_FIELDS) {
				const value = profile[field];
				expect(Number.isFinite(value)).toBe(true);
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThanOrEqual(100);
			}
			expect(profile.maxPreferredLeapSemitones).toBeGreaterThan(0);
			expect(profile.label.length).toBeGreaterThan(0);
			expect(profile.description.length).toBeGreaterThan(0);
		}
	});
});

describe('getBasslineStyleProfile', () => {
	it('returns the profile matching the requested id', () => {
		for (const id of ALL_STYLE_IDS) {
			expect(getBasslineStyleProfile(id).id).toBe(id);
		}
	});

	it('matches the spec table for a few representative fields per style', () => {
		expect(getBasslineStyleProfile('rooted')).toMatchObject({
			rootWeight: 100,
			strongBeatTargeting: 95,
			maxPreferredLeapSemitones: 7
		});
		expect(getBasslineStyleProfile('funk')).toMatchObject({
			syncopation: 78,
			accentDensity: 72,
			maxPreferredLeapSemitones: 12
		});
		expect(getBasslineStyleProfile('acid')).toMatchObject({
			slideDensity: 72,
			chromaticApproachWeight: 55,
			maxPreferredLeapSemitones: 12
		});
		expect(getBasslineStyleProfile('chromatic')).toMatchObject({
			chromaticApproachWeight: 88,
			enclosureWeight: 62
		});
		expect(getBasslineStyleProfile('melodic')).toMatchObject({
			movementPreference: 88,
			repetitionPreference: 18
		});
		expect(getBasslineStyleProfile('walking')).toMatchObject({
			strongBeatTargeting: 96,
			syncopation: 12,
			preferredGate: 90
		});
	});
});
