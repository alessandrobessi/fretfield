import type { IntervalId } from '$lib/music/intervals';
import type { PracticeMode } from './types';

/** Presentation metadata for each mode — mirrors `src/lib/config/roles.ts`'s pattern for the four Field modes. */
export interface PracticeModeStyle {
	mode: PracticeMode;
	label: string;
	question: string;
}

export const PRACTICE_MODE_STYLES: Record<PracticeMode, PracticeModeStyle> = {
	'find-interval': {
		mode: 'find-interval',
		label: 'Find Interval',
		question: 'Can you locate this interval relative to the root?'
	},
	'find-chord-tone': {
		mode: 'find-chord-tone',
		label: 'Find Chord Tone',
		question: 'Can you find this structural note of the current chord?'
	},
	'resolve-note': {
		mode: 'resolve-note',
		label: 'Resolve Note',
		question: 'Given this note, can you find a strong resolution into the next chord?'
	},
	'follow-path': {
		mode: 'follow-path',
		label: 'Follow Path',
		question: 'Can you follow the selected voice-leading path, one step at a time?'
	}
};

/**
 * Beginner-friendly default order for Find Interval — chord tones first
 * (echoes the spec's own example progression: 3, 5, b7, 9), then the rest of
 * the field. Just an ordering preference for which target to reach for next;
 * generators still accept an explicit interval or exclusion set.
 */
export const DEFAULT_INTERVAL_PRACTICE_POOL: readonly IntervalId[] = [
	'3',
	'5',
	'b7',
	'2',
	'b3',
	'4',
	'6',
	'7',
	'b2',
	'#4',
	'b6'
];

/** Injectable so tests are deterministic (product spec §17) — defaults to `Math.random`. */
export type RandomSource = () => number;

export const defaultRandomSource: RandomSource = () => Math.random();

/** Picks a uniformly random element, excluding any whose key (via `keyOf`) is in `exclude`. Falls back to the full list if everything would be excluded. */
export function pickExcluding<T>(
	items: readonly T[],
	exclude: ReadonlySet<string>,
	keyOf: (item: T) => string,
	random: RandomSource
): T {
	const available = items.filter((item) => !exclude.has(keyOf(item)));
	const pool = available.length > 0 ? available : items;
	const index = Math.floor(random() * pool.length);
	return pool[Math.min(index, pool.length - 1)];
}
