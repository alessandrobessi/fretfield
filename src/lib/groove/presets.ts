import { createEmptyGroove, createEmptyPattern } from './pattern';
import {
	PATTERN_ROLES,
	type DrumVoice,
	type Groove,
	type GrooveFeel,
	type GroovePattern,
	type PatternRole
} from './types';

function grooveFrom(
	hits: Partial<Record<DrumVoice, number[]>>,
	feel: GrooveFeel = 'straight',
	feelAmount = 0
): Groove {
	const groove = createEmptyGroove();
	const patternA = groove.patterns.A;
	for (const [voice, steps] of Object.entries(hits) as [DrumVoice, number[]][]) {
		for (const step of steps) patternA.steps[voice][step] = { velocity: 0.7 };
	}
	return { ...groove, patterns: { ...groove.patterns, A: patternA }, feel, feelAmount };
}

/** A plain step index, or a step paired with a minimum Intensity threshold (see `groove/intensity.ts`) -- lets a preset author decorative hits that only kick in as Intensity rises. */
type HitSpec = number | { step: number; minIntensity: number };

function patternFromHits(hits: Partial<Record<DrumVoice, HitSpec[]>>): GroovePattern {
	const pattern = createEmptyPattern();
	for (const [voice, specs] of Object.entries(hits) as [DrumVoice, HitSpec[]][]) {
		for (const spec of specs) {
			if (typeof spec === 'number') {
				pattern.steps[voice][spec] = { velocity: 0.7 };
			} else {
				pattern.steps[voice][spec.step] = { velocity: 0.7, minIntensity: spec.minIntensity };
			}
		}
	}
	return pattern;
}

/** Builds a groove with multiple named patterns and an explicit arrangement -- for multi-bar presets like the flagship 12-bar blues, where `grooveFrom`'s single-pattern/one-bar shape isn't enough. */
function multiPatternGroove(
	patterns: Partial<Record<PatternRole, Partial<Record<DrumVoice, HitSpec[]>>>>,
	arrangement: PatternRole[],
	feel: GrooveFeel = 'straight',
	feelAmount = 0
): Groove {
	const groove = createEmptyGroove();
	const built = { ...groove.patterns };
	for (const role of PATTERN_ROLES) {
		const hits = patterns[role];
		if (hits) built[role] = patternFromHits(hits);
	}
	return {
		patterns: built,
		arrangement,
		feel,
		feelAmount,
		timeSignature: groove.timeSignature,
		acidBass: groove.acidBass,
		chordPadFx: groove.chordPadFx
	};
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
			'shuffle',
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
				// The classic "1, 2-and, 3, 4-and" ride pattern -- a real ride
				// voice now, rather than faking it with the open hat.
				ride: [0, 6, 8, 14]
			},
			'swing',
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
		//
		// B and F also carry a couple of Intensity-gated decorative hits (see
		// groove/intensity.ts): the groove is tight and sparse at low
		// Intensity, and fills in on its own as Intensity rises, rather than
		// needing a separate preset per density level.
		id: 'chicago-shuffle',
		label: 'Chicago Shuffle — 12-Bar Blues',
		groove: multiPatternGroove(
			{
				A: { kick: [0, 8], snare: [4, 12], closedHat: [0, 2, 4, 6, 8, 10, 12, 14] },
				B: {
					kick: [0, { step: 6, minIntensity: 70 }, 8, { step: 10, minIntensity: 70 }],
					snare: [4, 12],
					closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
					openHat: [{ step: 14, minIntensity: 85 }]
				},
				F: {
					kick: [0],
					snare: [8, 10, { step: 12, minIntensity: 40 }, 13, 14, 15],
					closedHat: [0, 2, 4, 6]
				},
				T: {
					kick: [0, 8, 12],
					snare: [4, 10, 12, 14],
					closedHat: [0, 2, 4, 6, 8, 10],
					openHat: [15]
				}
			},
			['A', 'A', 'A', 'B', 'A', 'A', 'B', 'F', 'A', 'B', 'T', 'F'],
			'shuffle',
			65
		)
	},
	{
		id: 'house',
		label: 'House',
		groove: grooveFrom({
			kick: [0, 4, 8, 12],
			snare: [4, 12],
			closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
			openHat: [2, 6, 10, 14]
		})
	},
	{
		id: 'techno',
		label: 'Techno',
		groove: grooveFrom({
			kick: [0, 4, 8, 12],
			closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			rim: [8]
		})
	},
	{
		id: 'drum-and-bass',
		label: 'Drum & Bass',
		groove: grooveFrom({
			// A syncopated breakbeat feel rather than four-on-the-floor -- kick
			// on 1 and the "and" of 3, snare backbeat, dense hats underneath.
			kick: [0, 10],
			snare: [4, 12],
			closedHat: [0, 2, 4, 6, 8, 10, 12, 14],
			openHat: [14]
		})
	},
	{
		id: 'trance',
		label: 'Trance',
		groove: grooveFrom({
			kick: [0, 4, 8, 12],
			snare: [4, 12],
			closedHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			openHat: [14]
		})
	},
	{
		id: 'rnb',
		label: 'RnB',
		groove: grooveFrom(
			{
				// A laid-back one-drop-ish kick (not on every beat) under a
				// gentle swing pocket, rather than a straight backbeat.
				kick: [0, 7, 8],
				snare: [4, 12],
				closedHat: [0, 2, 4, 6, 8, 10, 12, 14]
			},
			'swing',
			40
		)
	},
	{
		id: 'bossa-nova',
		label: 'Bossa Nova',
		groove: grooveFrom({
			// The classic bossa "boom-chick": a syncopated kick, rim clicks
			// standing in for the clave/side-stick pattern, and a sparse
			// downbeat-only hat -- no backbeat snare at all.
			kick: [0, 6, 8, 14],
			rim: [2, 5, 10, 13],
			closedHat: [0, 4, 8, 12]
		})
	}
];

export function listGroovePresets(): readonly GroovePreset[] {
	return GROOVE_PRESETS;
}
