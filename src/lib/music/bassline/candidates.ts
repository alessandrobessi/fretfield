/**
 * Harmonic candidate generation and local scoring (Acid Bass Intelligence V4
 * §14/§15) -- for a given chord/scale context and rhythmic slot, produces the
 * set of pitch classes a later milestone's selection algorithm (`generate.ts`,
 * M6) may choose between. Uses the existing harmonic engine (`harmony.ts`)
 * rather than re-deriving a new chord-role table, per §14's explicit
 * instruction and AGENTS.md §6.
 *
 * Chromatic notes are deliberately never inserted here -- `chromaticism.ts`
 * (M7) transforms an already-coherent selected line, it does not widen this
 * candidate pool. `anticipation` is part of the spec's own candidate-source
 * vocabulary (§14) but is optional and not produced by this milestone; the
 * union includes it so a later milestone can add it without a breaking type
 * change.
 *
 * `localScore` on each candidate reflects only §15's `harmonicScore`
 * component -- the piece a candidate can know about itself, independent of
 * style/harmony-mode/previous selections. `generate.ts` (M6) adds the
 * remaining components (`styleScore`, `beatPlacementScore`, `harmonyModeScore`,
 * `repetitionScore`, `movementScore`) on top of this starting point; this
 * module never recomputes those.
 */

import { getChordDefinition } from '$lib/music/chords';
import {
	analyzeInterval,
	type HarmonicRole,
	isChordTone,
	roleStability,
	roleTension
} from '$lib/music/harmony';
import { type IntervalId, intervalFromRoot, transposeByInterval } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';
import { getScaleDefinition, scalePitchClasses } from '$lib/music/scales';

import type { BassRhythmSlot } from './rhythm';
import type { BasslineChordContext } from './types';

export type BassPitchCandidateSource = 'root' | 'chord' | 'scale' | 'anticipation';

export interface BassPitchCandidate {
	pitchClass: PitchClass;
	intervalFromChord: IntervalId;
	intervalFromKey: IntervalId;
	harmonicRole: HarmonicRole;
	source: BassPitchCandidateSource;
	localScore: number;
}

/**
 * §15's "example relative tendencies" table, centralized rather than left as
 * anonymous inline numbers so it stays independently testable and tunable.
 * These are generator weights, not UI percentages and not claims of
 * objective musical truth (matches `styles.ts`'s own framing). The
 * strong-slot adjustment below (not this table) is what implements "tension
 * +22 on weak slots" / "alteration +18 on weak slots" -- these base values
 * are the weak-slot (unsuppressed) tendency.
 */
const HARMONIC_BASE_WEIGHT: Record<HarmonicRole, number> = {
	root: 100,
	structural: 90,
	stable: 82,
	extension: 58,
	color: 42,
	tension: 22,
	alteration: 18,
	'chromatic-approach': 15,
	avoid: -120
};

// §15's "strong-step multiplier": root/structural/stable/chord-tone
// candidates should be boosted at strong beat/beat-group starts, scaled by
// the role's own `roleStability()` so the boost stays proportional rather
// than a second hand-picked table.
const STRONG_SLOT_STABILITY_BOOST_WEIGHT = 14;

// The complementary rule -- "weak subdivisions may tolerate tension/
// alteration/chromatic-approach/passing motion" -- implemented as a
// strong-slot suppression scaled by the role's own `roleTension()` (which
// also captures §15's b9-over-dominant nuance via `roleTension`'s interval
// argument), floored so it can only ever reduce a positive base, never flip
// its sign.
const STRONG_SLOT_TENSION_SUPPRESSION_WEIGHT = 0.65;
const MIN_STRONG_SLOT_SUPPRESSION = 0.25;

/** A slot counts as "strong" for scoring purposes at its own downbeat or any beat-group start -- the same positions §13's rhythm generator itself favors for stable anchors. */
function isStrongSlot(slot: Pick<BassRhythmSlot, 'strongBeat' | 'beatGroupStart'>): boolean {
	return slot.strongBeat || slot.beatGroupStart;
}

/**
 * Exposed directly so the weight table's behavior (including the strong/weak
 * split) is independently testable, not just as a side effect of full
 * candidate generation. `avoid` is deliberately left at its unsuppressed,
 * strongly negative base on every slot -- `generateHarmonicCandidates` never
 * emits an `avoid` candidate in the first place (§14), so this branch only
 * matters to a caller probing the scorer directly.
 */
export function harmonicCandidateScore(
	role: HarmonicRole,
	interval: IntervalId,
	slot: Pick<BassRhythmSlot, 'strongBeat' | 'beatGroupStart'>
): number {
	const base = HARMONIC_BASE_WEIGHT[role];
	if (!isStrongSlot(slot) || role === 'avoid') {
		return base;
	}
	const stabilityBoost = roleStability(role) * STRONG_SLOT_STABILITY_BOOST_WEIGHT;
	const tensionSuppression = Math.max(
		MIN_STRONG_SLOT_SUPPRESSION,
		1 - roleTension(role, interval) * STRONG_SLOT_TENSION_SUPPRESSION_WEIGHT
	);
	return base * tensionSuppression + stabilityBoost;
}

/**
 * Root/chord/scale candidates for one active rhythmic slot over `chord`.
 * Chord-required tones (including the root itself) are always chord tones by
 * construction and can never classify as `avoid`; scale tones that duplicate
 * a chord tone (checked via `isChordTone()`, not just pitch-class dedup) are
 * skipped since the chord loop already added them, and scale tones that
 * classify as `avoid` are excluded entirely, per §14's "V4's initial
 * candidate skeleton should generally exclude `avoid` candidates."
 */
export function generateHarmonicCandidates(
	chordContext: BasslineChordContext,
	tonic: PitchClass,
	slot: Pick<BassRhythmSlot, 'strongBeat' | 'beatGroupStart'>
): BassPitchCandidate[] {
	const chord = getChordDefinition(chordContext.chordId);
	const seen = new Set<PitchClass>();

	function buildCandidate(
		pitchClass: PitchClass,
		source: BassPitchCandidateSource
	): BassPitchCandidate | null {
		if (seen.has(pitchClass)) return null;
		seen.add(pitchClass);
		const intervalFromChord = intervalFromRoot(chordContext.root, pitchClass);
		const harmonicRole = analyzeInterval(chord, intervalFromChord);
		if (harmonicRole === 'avoid') return null;
		return {
			pitchClass,
			intervalFromChord,
			intervalFromKey: intervalFromRoot(tonic, pitchClass),
			harmonicRole,
			source,
			localScore: harmonicCandidateScore(harmonicRole, intervalFromChord, slot)
		};
	}

	const candidates: BassPitchCandidate[] = [];

	const root = buildCandidate(chordContext.root, 'root');
	if (root) candidates.push(root);

	for (const interval of chord.required) {
		if (interval === '1') continue;
		const candidate = buildCandidate(transposeByInterval(chordContext.root, interval), 'chord');
		if (candidate) candidates.push(candidate);
	}

	if (chordContext.scaleId !== null) {
		const scale = getScaleDefinition(chordContext.scaleId);
		for (const pitchClass of scalePitchClasses(chordContext.root, scale)) {
			const intervalFromChord = intervalFromRoot(chordContext.root, pitchClass);
			if (isChordTone(chord, intervalFromChord)) continue;
			const candidate = buildCandidate(pitchClass, 'scale');
			if (candidate) candidates.push(candidate);
		}
	}

	return candidates;
}
