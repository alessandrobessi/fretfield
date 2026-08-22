/**
 * The six bassline styles (Acid Bass Intelligence V4 §12) -- one generation
 * engine driven by style *data*, not six separate generator implementations.
 * Every later stage (rhythm, candidate scoring, voice-leading, chromaticism,
 * articulation) reads these weights rather than special-casing a style by
 * name.
 *
 * All weights are 0-100 generator tendencies, not UI percentages and not
 * claims of objective musical truth (spec §15) -- `maxPreferredLeapSemitones`
 * is the one field in real semitone units. User-level `density`/
 * `chromaticism`/`movement` settings (`AcidBassGenerationSettings`) scale or
 * modify a style profile's own values; they do not replace them.
 *
 * Values are initial musical defaults, deliberately centralized here so they
 * can be tuned later without touching any algorithm.
 */

import type { BasslineStyleId } from './types';

export interface BasslineStyleProfile {
	id: BasslineStyleId;
	label: string;
	description: string;

	/** 0-100 -- overall rhythmic activity/note-density character. */
	rhythmicDensity: number;
	/** 0-100 -- tendency to place notes off the beat-group start. */
	syncopation: number;

	/** 0-100 -- candidate-scoring weight, applied in a later milestone. */
	rootWeight: number;
	chordToneWeight: number;
	scaleToneWeight: number;

	chromaticApproachWeight: number;
	enclosureWeight: number;
	passingToneWeight: number;

	repetitionPreference: number;
	octaveJumpPreference: number;
	movementPreference: number;

	/** 0-100 -- how strongly a strong beat-group start should be filled/targeted. Read directly by `rhythm.ts` in this milestone; the rest feed later milestones. */
	strongBeatTargeting: number;

	accentDensity: number;
	slideDensity: number;

	/** 0-100, the same UI range the manual step editor's own Gate control already uses. */
	preferredGate: number;

	/** Real semitones, not a 0-100 weight -- the largest leap this style comfortably reaches for before a smoother connection is preferred. */
	maxPreferredLeapSemitones: number;
}

const STYLE_PROFILES: Record<BasslineStyleId, BasslineStyleProfile> = {
	rooted: {
		id: 'rooted',
		label: 'Rooted',
		description: 'A foundational bass part, stable and useful for practice.',
		rhythmicDensity: 48,
		syncopation: 18,
		rootWeight: 100,
		chordToneWeight: 58,
		scaleToneWeight: 18,
		chromaticApproachWeight: 5,
		enclosureWeight: 0,
		passingToneWeight: 10,
		repetitionPreference: 75,
		octaveJumpPreference: 25,
		movementPreference: 22,
		strongBeatTargeting: 95,
		accentDensity: 30,
		slideDensity: 8,
		preferredGate: 78,
		maxPreferredLeapSemitones: 7
	},
	funk: {
		id: 'funk',
		label: 'Funk',
		description: 'Syncopated root/octave/chord-tone language with short articulations.',
		rhythmicDensity: 72,
		syncopation: 78,
		rootWeight: 92,
		chordToneWeight: 65,
		scaleToneWeight: 40,
		chromaticApproachWeight: 28,
		enclosureWeight: 8,
		passingToneWeight: 35,
		repetitionPreference: 55,
		octaveJumpPreference: 65,
		movementPreference: 58,
		strongBeatTargeting: 82,
		accentDensity: 72,
		slideDensity: 22,
		preferredGate: 58,
		maxPreferredLeapSemitones: 12
	},
	acid: {
		id: 'acid',
		label: 'Acid',
		description: 'Repeated motifs, chromatic approaches, slides and accents.',
		rhythmicDensity: 68,
		syncopation: 82,
		rootWeight: 78,
		chordToneWeight: 58,
		scaleToneWeight: 42,
		chromaticApproachWeight: 55,
		enclosureWeight: 18,
		passingToneWeight: 32,
		repetitionPreference: 48,
		octaveJumpPreference: 58,
		movementPreference: 65,
		strongBeatTargeting: 75,
		accentDensity: 72,
		slideDensity: 72,
		preferredGate: 72,
		maxPreferredLeapSemitones: 12
	},
	chromatic: {
		id: 'chromatic',
		label: 'Chromatic',
		description: 'Target-driven chromatic movement, never random outside-note selection.',
		rhythmicDensity: 65,
		syncopation: 52,
		rootWeight: 68,
		chordToneWeight: 72,
		scaleToneWeight: 42,
		chromaticApproachWeight: 88,
		enclosureWeight: 62,
		passingToneWeight: 68,
		repetitionPreference: 30,
		octaveJumpPreference: 25,
		movementPreference: 82,
		strongBeatTargeting: 88,
		accentDensity: 45,
		slideDensity: 35,
		preferredGate: 76,
		maxPreferredLeapSemitones: 7
	},
	melodic: {
		id: 'melodic',
		label: 'Melodic',
		description: 'Connected lyrical motion through chord and scale tones.',
		rhythmicDensity: 58,
		syncopation: 46,
		rootWeight: 55,
		chordToneWeight: 78,
		scaleToneWeight: 72,
		chromaticApproachWeight: 22,
		enclosureWeight: 10,
		passingToneWeight: 65,
		repetitionPreference: 18,
		octaveJumpPreference: 20,
		movementPreference: 88,
		strongBeatTargeting: 78,
		accentDensity: 38,
		slideDensity: 28,
		preferredGate: 84,
		maxPreferredLeapSemitones: 7
	},
	walking: {
		id: 'walking',
		label: 'Walking',
		description: 'Beat-oriented connected lines that strongly target chord changes.',
		rhythmicDensity: 52,
		syncopation: 12,
		rootWeight: 88,
		chordToneWeight: 88,
		scaleToneWeight: 64,
		chromaticApproachWeight: 70,
		enclosureWeight: 25,
		passingToneWeight: 78,
		repetitionPreference: 12,
		octaveJumpPreference: 12,
		movementPreference: 82,
		strongBeatTargeting: 96,
		accentDensity: 20,
		slideDensity: 4,
		preferredGate: 90,
		maxPreferredLeapSemitones: 7
	}
};

export function getBasslineStyleProfile(id: BasslineStyleId): BasslineStyleProfile {
	return STYLE_PROFILES[id];
}

export function listBasslineStyleProfiles(): readonly BasslineStyleProfile[] {
	return Object.values(STYLE_PROFILES);
}
