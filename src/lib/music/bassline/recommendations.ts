/**
 * Context-sensitive Bass Style recommendations (Acid Bass Intelligence V4
 * §23) -- ranks styles from the current progression's own chord-family
 * sequence. Never changes the user's style itself (§23: "this feature
 * recommends styles, it does not silently change the user's style") -- pure
 * data in, ranked data out; whatever calls this decides how/whether to show
 * it. Deliberately keyed off chord families (via the existing
 * `getChordDefinition()`), never progression template IDs or literal chord
 * ids, so a recommendation stays meaningful for any progression, curated or
 * future (§23: "prefer chord-family analysis so the recommendation survives
 * future curated templates").
 */

import type { ChordFamily } from '$lib/music/chords';
import { getChordDefinition } from '$lib/music/chords';

import { listBasslineStyleProfiles } from './styles';
import type { BasslineChordContext, BasslineStyleId } from './types';

export interface BassStyleRecommendation {
	style: BasslineStyleId;
	score: number;
	reason: string;
}

/** A style's own weight within a single matched heuristic -- first-listed style scores highest, matching §23's own "favor: funk, walking, chromatic, acid" ordered lists. Positions past the table's length all share its last (lowest) weight. */
const RANK_SCORES: readonly number[] = [40, 30, 20, 10];

/** At or above this fraction of the sequence being `dominant`-family chords counts as "dominant-heavy" (§23) -- a typical blues (often 100% dominant) clears it easily; a plain ii-V-I (1/3 dominant) does not. */
const DOMINANT_HEAVY_THRESHOLD = 0.5;

function containsSubsequence(
	families: readonly ChordFamily[],
	pattern: readonly ChordFamily[]
): boolean {
	for (let start = 0; start + pattern.length <= families.length; start++) {
		if (pattern.every((family, offset) => families[start + offset] === family)) return true;
	}
	return false;
}

interface StyleHeuristic {
	matches(families: readonly ChordFamily[]): boolean;
	/** Ordered by preference, strongest first. */
	styles: readonly BasslineStyleId[];
	reason: string;
}

const HEURISTICS: readonly StyleHeuristic[] = [
	{
		matches: (families) =>
			families.length > 0 &&
			families.filter((family) => family === 'dominant').length / families.length >=
				DOMINANT_HEAVY_THRESHOLD,
		styles: ['funk', 'walking', 'chromatic', 'acid'],
		reason:
			'Dominant-heavy progression suits chromatic approaches and groove-oriented root movement.'
	},
	{
		matches: (families) => containsSubsequence(families, ['minor', 'dominant', 'major']),
		styles: ['walking', 'melodic', 'chromatic'],
		reason: 'ii-V-I-like motion rewards connected, targeted voice leading into each new chord.'
	},
	{
		matches: (families) => families.length > 0 && new Set(families).size === 1,
		styles: ['rooted', 'funk', 'acid'],
		reason: 'Static harmony gives a steady groove and repeated motifs room to establish themselves.'
	}
];

/**
 * Ranks bassline styles for `chords` (typically the current resolved
 * progression). `[]` for an empty progression -- there is nothing to
 * recommend from. Deterministic: the same chord sequence always produces
 * the same ranked list, ties broken by each style's own declared order
 * (`listBasslineStyleProfiles()`), never by object/Map iteration happenstance.
 */
export function recommendBasslineStyles(
	chords: readonly BasslineChordContext[]
): BassStyleRecommendation[] {
	if (chords.length === 0) return [];

	const families = chords.map((chord) => getChordDefinition(chord.chordId).family);

	const scoreByStyle = new Map<BasslineStyleId, number>();
	const reasonByStyle = new Map<BasslineStyleId, string>();

	for (const heuristic of HEURISTICS) {
		if (!heuristic.matches(families)) continue;
		heuristic.styles.forEach((style, index) => {
			const points = RANK_SCORES[Math.min(index, RANK_SCORES.length - 1)];
			scoreByStyle.set(style, (scoreByStyle.get(style) ?? 0) + points);
			if (!reasonByStyle.has(style)) reasonByStyle.set(style, heuristic.reason);
		});
	}

	const styleOrder = listBasslineStyleProfiles().map((profile) => profile.id);
	return Array.from(scoreByStyle.entries())
		.map(([style, score]) => ({ style, score, reason: reasonByStyle.get(style) as string }))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return styleOrder.indexOf(a.style) - styleOrder.indexOf(b.style);
		});
}
