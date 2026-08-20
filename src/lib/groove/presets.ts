import { createEmptyGroove, createEmptyPattern } from './pattern';
import {
	PATTERN_ROLES,
	type DrumVoice,
	type Groove,
	type GroovePattern,
	type PatternRole
} from './types';

function grooveFrom(hits: Partial<Record<DrumVoice, number[]>>, swing = 0): Groove {
	const groove = createEmptyGroove();
	const patternA = groove.patterns.A;
	for (const [voice, steps] of Object.entries(hits) as [DrumVoice, number[]][]) {
		for (const step of steps) patternA.steps[voice][step] = { velocity: 0.7 };
	}
	return { ...groove, patterns: { ...groove.patterns, A: patternA }, swing };
}

function patternFromHits(hits: Partial<Record<DrumVoice, number[]>>): GroovePattern {
	const pattern = createEmptyPattern();
	for (const [voice, steps] of Object.entries(hits) as [DrumVoice, number[]][]) {
		for (const step of steps) pattern.steps[voice][step] = { velocity: 0.7 };
	}
	return pattern;
}

/** Builds a groove with multiple named patterns and an explicit arrangement -- for multi-bar presets like the flagship 12-bar blues, where `grooveFrom`'s single-pattern/one-bar shape isn't enough. */
function multiPatternGroove(
	patterns: Partial<Record<PatternRole, Partial<Record<DrumVoice, number[]>>>>,
	arrangement: PatternRole[],
	swing = 0
): Groove {
	const groove = createEmptyGroove();
	const built = { ...groove.patterns };
	for (const role of PATTERN_ROLES) {
		const hits = patterns[role];
		if (hits) built[role] = patternFromHits(hits);
	}
	return { patterns: built, arrangement, swing };
}

export interface GroovePreset {
	id: string;
	label: string;
	groove: Groove;
}

const GROOVE_PRESETS: GroovePreset[] = [
	{
		// The old single-click metronome's spiritual successor -- one kick per beat, nothing else.
		id: 'click',
		label: 'Click',
		groove: grooveFrom({ kick: [0, 4, 8, 12] })
	},
	{
		id: 'straight-rock',
		label: 'Straight / Rock',
		groove: grooveFrom({
			kick: [0, 8],
			snare: [4, 12],
			closedHat: [0, 2, 4, 6, 8, 10, 12, 14]
		})
	},
	{
		id: 'blues-shuffle',
		label: 'Blues Shuffle',
		groove: grooveFrom(
			{
				kick: [0, 8],
				snare: [4, 12],
				closedHat: [0, 2, 4, 6, 8, 10, 12, 14]
			},
			65
		)
	},
	{
		id: 'jazz-swing',
		label: 'Jazz Swing',
		groove: grooveFrom(
			{
				kick: [0],
				snare: [6],
				// The classic ride pattern ("1, 2-and, 3, 4-and") -- open hat for
				// a washier, more ride-cymbal-like sustain than the closed hat.
				openHat: [0, 6, 8, 14]
			},
			70
		)
	},
	{
		id: 'funk',
		label: 'Funk',
		groove: grooveFrom({
			kick: [0, 6, 10],
			snare: [4, 12],
			// Dense 16th-note hats, not swing timing, carry funk's character here.
			closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
		})
	},
	{
		// The flagship 12-bar groove (roadmap "Groove Engine Roadmap" §5): a
		// tight shuffle for most of the form (A), a variation with extra kick
		// syncopation (B), a snare fill announcing each section change (F), and
		// a turnaround that clearly leads back to bar 1 (T). Pair with the
		// "12-Bar Dominant Blues" progression and "Bars per chord" = 1 for the
		// full flagship experience -- 12 drum bars, 12 chords, one per bar.
		id: 'chicago-shuffle',
		label: 'Chicago Shuffle — 12-Bar Blues',
		groove: multiPatternGroove(
			{
				A: { kick: [0, 8], snare: [4, 12], closedHat: [0, 2, 4, 6, 8, 10, 12, 14] },
				B: {
					kick: [0, 6, 8, 10],
					snare: [4, 12],
					closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
					openHat: [14]
				},
				F: { kick: [0], snare: [8, 10, 12, 13, 14, 15], closedHat: [0, 2, 4, 6] },
				T: {
					kick: [0, 8, 12],
					snare: [4, 10, 12, 14],
					closedHat: [0, 2, 4, 6, 8, 10],
					openHat: [15]
				}
			},
			['A', 'A', 'A', 'B', 'A', 'A', 'B', 'F', 'A', 'B', 'T', 'F'],
			65
		)
	}
];

export function listGroovePresets(): readonly GroovePreset[] {
	return GROOVE_PRESETS;
}
