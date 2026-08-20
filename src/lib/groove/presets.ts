import { createEmptyGroove } from './pattern';
import type { DrumVoice, Groove } from './types';

export interface GroovePreset {
	id: string;
	label: string;
	groove: Groove;
}

function grooveFrom(hits: Partial<Record<DrumVoice, number[]>>, swing = 0): Groove {
	const groove = createEmptyGroove();
	const patternA = groove.patterns.A;
	for (const [voice, steps] of Object.entries(hits) as [DrumVoice, number[]][]) {
		for (const step of steps) patternA.steps[voice][step] = { velocity: 0.7 };
	}
	return { ...groove, patterns: { ...groove.patterns, A: patternA }, swing };
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
	}
];

export function listGroovePresets(): readonly GroovePreset[] {
	return GROOVE_PRESETS;
}
