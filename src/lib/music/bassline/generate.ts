/**
 * Ties pipeline stages 1-3 together (Acid Bass Intelligence V4 §11): rhythm
 * plan (`rhythm.ts`) -> harmonic candidates (`candidates.ts`) -> coherent
 * selection (`voice-leading.ts`) -> a multi-bar pitch-class-level skeleton.
 *
 * Deliberately not `generateBasslinePlan()` yet -- stages 4-7 (controlled
 * chromatic transform, register/physical realization, articulation,
 * explanation) are later milestones (M7-M9), and per §11 this must never
 * collapse into one large function. `BasslineSkeleton`'s notes stay
 * pitch-class-level (`BassPitchCandidate`, not MIDI) per §17's own allowance
 * ("intermediate generated notes may remain pitch-class level inside
 * internal types").
 */

import type { BassPitchCandidate } from './candidates';
import { generateHarmonicCandidates } from './candidates';
import { createBasslineRandom } from './random';
import { generateBarRhythm } from './rhythm';
import { getBasslineStyleProfile } from './styles';
import type { BassHarmonyMode, BasslineGenerationContext, BasslineStyleId } from './types';
import type { VoiceLeadingSlotInput } from './voice-leading';
import { selectVoiceLeadingSequence } from './voice-leading';

export interface BasslineSkeletonNote {
	barIndex: number;
	stepIndex: number;
	candidate: BassPitchCandidate;
}

/**
 * Only active rhythmic slots are represented -- rest steps carry no
 * candidate to select from. A later milestone (register realization, M9)
 * pads this into a full `GeneratedBassBar.steps` array covering every step,
 * matching `GeneratedBassStep`'s discriminated rest/note union.
 */
export interface BasslineSkeleton {
	seed: number;
	style: BasslineStyleId;
	harmonyMode: BassHarmonyMode;
	notes: BasslineSkeletonNote[];
}

interface PendingSkeletonSlot {
	barIndex: number;
	stepIndex: number;
	input: VoiceLeadingSlotInput;
}

export function generateBasslineSkeleton(context: BasslineGenerationContext): BasslineSkeleton {
	const style = getBasslineStyleProfile(context.style);
	const random = createBasslineRandom(context.seed);

	const pending: PendingSkeletonSlot[] = [];

	for (const bar of context.bars) {
		const rhythmSlots = generateBarRhythm(
			style,
			bar.phraseRole,
			context.meter,
			context.density,
			random
		);
		const chordChangedAtThisBar =
			bar.chord.root !== bar.previousChord.root || bar.chord.chordId !== bar.previousChord.chordId;
		let isFirstActiveSlotOfBar = true;

		for (const slot of rhythmSlots) {
			if (!slot.active) continue;
			pending.push({
				barIndex: bar.barIndex,
				stepIndex: slot.stepIndex,
				input: {
					candidates: generateHarmonicCandidates(bar.chord, context.tonic, slot),
					isChordBoundary: isFirstActiveSlotOfBar && chordChangedAtThisBar
				}
			});
			isFirstActiveSlotOfBar = false;
		}
	}

	const selections = selectVoiceLeadingSequence(
		pending.map((slot) => slot.input),
		{ harmonyMode: context.harmonyMode, style },
		random
	);

	const notes: BasslineSkeletonNote[] = pending.map((slot, index) => ({
		barIndex: slot.barIndex,
		stepIndex: slot.stepIndex,
		candidate: selections[index]
	}));

	return { seed: context.seed, style: context.style, harmonyMode: context.harmonyMode, notes };
}
