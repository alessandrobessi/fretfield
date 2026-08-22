/**
 * Coherent candidate-sequence selection (Acid Bass Intelligence V4 §16/§17)
 * -- pipeline stage 3, "voice-leading / key strategy." Not a resurrection of
 * the removed Voice Leading Paths UI mode: this is internal, pure
 * generator-scoring logic, never surfaced as its own practice mode.
 *
 * Selects one candidate per active slot from an already-built per-slot
 * candidate pool (`candidates.ts`) using a bounded beam search, so a locally
 * tempting but sequentially incoherent choice can be discarded in favor of a
 * globally better line -- a greedy per-slot argmax cannot do this.
 *
 * `localScore` on each `BassPitchCandidate` (from `candidates.ts`) is only
 * §15's `harmonicScore` component. This module adds the rest of §15's local
 * components (`styleScore`, `harmonyModeScore`, `repetitionScore`,
 * `movementScore` -- folded into one `additionalLocalScore` helper below,
 * since none of them need to be independently swappable) plus §17's
 * `transitionScore` (`voiceLeadingScore` + `motionScore`, both captured by
 * `transitionReward`). `beatPlacementScore` is deliberately not duplicated
 * here -- `candidates.ts`'s own strong/weak-slot boost and suppression
 * already is that component, computed once per candidate rather than once
 * per beam-search visit.
 */

import type { IntervalId } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';

import type { BassPitchCandidate } from './candidates';
import type { BasslineRandom } from './random';
import type { BasslineStyleProfile } from './styles';
import type { BassHarmonyMode } from './types';

export interface BasslineBeamState {
	selections: BassPitchCandidate[];
	score: number;
	previousPitchClass: PitchClass | null;
	previousIntervalFromKey: IntervalId | null;
	/** How many consecutive prior slots already repeated this same pitch class -- feeds the escalating repetition penalty below, so a beam can never lock onto "always repeat the single highest-scoring candidate" regardless of style. */
	consecutiveRepeats: number;
}

/** One active slot's candidate pool, plus whether it is the first active slot of a newly-arrived chord (§17: "at a chord boundary, increase the importance of..."). */
export interface VoiceLeadingSlotInput {
	candidates: readonly BassPitchCandidate[];
	isChordBoundary: boolean;
}

export interface VoiceLeadingOptions {
	harmonyMode: BassHarmonyMode;
	style: BasslineStyleProfile;
	/** §17 suggests 8 "or another small constant proven adequate by tests." */
	beamWidth?: number;
}

const DEFAULT_BEAM_WIDTH = 8;

/**
 * Circular pitch-class distance -- 0-6, since pitch classes wrap at the
 * octave and the "long way round" is never shorter than the direct way.
 * Absolute MIDI/register motion is a later stage's (`playability.ts`)
 * concern; this stays pitch-class-only per §17.
 */
export function pitchClassDistance(a: PitchClass, b: PitchClass): number {
	const diff = Math.abs(a - b) % 12;
	return Math.min(diff, 12 - diff);
}

/**
 * §17's reward table -- common tone strongest, down through the largest
 * possible circular distance (6). ">7 semitones" from the spec's own prose
 * never actually occurs here: it describes absolute-interval reasoning
 * ("treat as an equivalent inversion distance modulo 12"), which circular
 * pitch-class distance already *is* by construction, so every distance this
 * function receives is already in 0-6.
 */
const TRANSITION_REWARD_BY_DISTANCE: readonly number[] = [
	100, // 0 -- common tone
	94, // 1 -- very strong (semitone)
	80, // 2 -- strong (whole step)
	55, // 3 -- moderate
	55, // 4 -- moderate
	25, // 5 -- weak
	25 // 6 -- weak (the maximum possible circular distance)
];

export function transitionReward(distance: number): number {
	const clamped = Math.min(6, Math.max(0, Math.round(distance)));
	return TRANSITION_REWARD_BY_DISTANCE[clamped];
}

// §16's per-mode emphasis: Voice Leading weights transition motion far more
// heavily than Chord/Key, which stay closer to today's "root/chord tones on
// the beat" Acid Bass semantics and let transition motion break only mild
// ties.
const TRANSITION_WEIGHT_BY_HARMONY_MODE: Record<BassHarmonyMode, number> = {
	chord: 0.25,
	key: 0.25,
	'voice-leading': 1
};

// Scales style 0-100 weights down into the same rough magnitude as
// `candidates.ts`'s harmonic base weights (tens, not hundreds) so no single
// component silently dominates the sum.
const STYLE_SOURCE_WEIGHT_SCALE = 0.3;
const REPETITION_SCALE = 0.3;
const MOVEMENT_SCALE = 0.3;
/** §16.2: "repeated key-relative motifs are rewarded" -- a flat bonus for continuing the previous slot's `intervalFromKey`, independent of style. */
const KEY_MODE_MOTIF_BONUS = 20;
/**
 * A style's own `repetitionPreference` sets how many consecutive repeats
 * feel free before the cost kicks in (low-repetitionPreference styles like
 * Melodic/Walking tolerate barely more than one; high-repetitionPreference
 * styles like Rooted tolerate several) -- past that point, each further
 * repeat gets markedly more expensive, so no style's raw harmonic dominance
 * (root's harmonicScore is always the highest available candidate) can lock
 * a beam onto repeating one pitch class forever.
 */
const REPETITION_TOLERANCE_BASE = 1;
const REPETITION_TOLERANCE_PREFERENCE_WEIGHT = 40;
const REPETITION_ESCALATION_PENALTY = 20;
/** §17: chord-boundary slots weight root/structural/stable more heavily. */
const CHORD_BOUNDARY_ROOT_BONUS = 16;
const CHORD_BOUNDARY_STRUCTURAL_BONUS = 10;
// A small seed-dependent nudge so equally-scored candidates don't collapse
// to the exact same choice for every seed -- deliberately tiny relative to
// the score components above, so it only ever breaks near-ties.
const SCORE_JITTER_RANGE = 6;

function styleSourceWeight(candidate: BassPitchCandidate, style: BasslineStyleProfile): number {
	switch (candidate.source) {
		case 'root':
			return style.rootWeight;
		case 'chord':
			return style.chordToneWeight;
		case 'scale':
			return style.scaleToneWeight;
		case 'anticipation':
			return 0;
	}
}

/**
 * §15's `styleScore` + `harmonyModeScore` + `repetitionScore` +
 * `movementScore`, folded into one helper since all four only need the same
 * inputs (the candidate, the beam-so-far, and the current options) and none
 * of them are independently reused elsewhere.
 */
function additionalLocalScore(
	candidate: BassPitchCandidate,
	beam: BasslineBeamState,
	slot: VoiceLeadingSlotInput,
	options: VoiceLeadingOptions
): number {
	let score = styleSourceWeight(candidate, options.style) * STYLE_SOURCE_WEIGHT_SCALE;

	if (
		options.harmonyMode === 'key' &&
		beam.previousIntervalFromKey !== null &&
		candidate.intervalFromKey === beam.previousIntervalFromKey
	) {
		score += KEY_MODE_MOTIF_BONUS;
	}

	if (slot.isChordBoundary) {
		if (candidate.source === 'root') {
			score += CHORD_BOUNDARY_ROOT_BONUS * (options.style.rootWeight / 100);
		}
		if (candidate.harmonicRole === 'structural' || candidate.harmonicRole === 'stable') {
			score += CHORD_BOUNDARY_STRUCTURAL_BONUS;
		}
	}

	if (beam.previousPitchClass !== null) {
		if (candidate.pitchClass === beam.previousPitchClass) {
			const tolerance =
				REPETITION_TOLERANCE_BASE +
				options.style.repetitionPreference / REPETITION_TOLERANCE_PREFERENCE_WEIGHT;
			const excessRepeats = Math.max(0, beam.consecutiveRepeats + 1 - tolerance);
			score +=
				options.style.repetitionPreference * REPETITION_SCALE -
				excessRepeats * REPETITION_ESCALATION_PENALTY;
		} else {
			score += options.style.movementPreference * MOVEMENT_SCALE;
		}
	}

	return score;
}

/**
 * Bounded beam search over a whole slot sequence (§17). `random` is an
 * already-created `BasslineRandom` -- the caller (`generate.ts`) threads one
 * instance across the entire plan, matching the pattern `rhythm.ts`
 * established, so the same seed always reproduces the same sequence.
 */
export function selectVoiceLeadingSequence(
	slots: readonly VoiceLeadingSlotInput[],
	options: VoiceLeadingOptions,
	random: BasslineRandom
): BassPitchCandidate[] {
	const beamWidth = options.beamWidth ?? DEFAULT_BEAM_WIDTH;
	const transitionWeight = TRANSITION_WEIGHT_BY_HARMONY_MODE[options.harmonyMode];

	let beams: BasslineBeamState[] = [
		{
			selections: [],
			score: 0,
			previousPitchClass: null,
			previousIntervalFromKey: null,
			consecutiveRepeats: 0
		}
	];

	for (const slot of slots) {
		const nextBeams: BasslineBeamState[] = [];
		for (const beam of beams) {
			for (const candidate of slot.candidates) {
				const isRepeat =
					beam.previousPitchClass !== null && candidate.pitchClass === beam.previousPitchClass;
				const transition =
					beam.previousPitchClass === null
						? 0
						: transitionReward(pitchClassDistance(beam.previousPitchClass, candidate.pitchClass));
				const jitter = (random.next() - 0.5) * SCORE_JITTER_RANGE;
				const score =
					beam.score +
					candidate.localScore +
					additionalLocalScore(candidate, beam, slot, options) +
					transition * transitionWeight +
					jitter;
				nextBeams.push({
					selections: [...beam.selections, candidate],
					score,
					previousPitchClass: candidate.pitchClass,
					previousIntervalFromKey: candidate.intervalFromKey,
					consecutiveRepeats: isRepeat ? beam.consecutiveRepeats + 1 : 0
				});
			}
		}
		nextBeams.sort((a, b) => b.score - a.score);
		beams = nextBeams.slice(0, beamWidth);
	}

	return beams[0]?.selections ?? [];
}
