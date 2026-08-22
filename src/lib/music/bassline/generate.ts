/**
 * Ties pipeline stages 1-5 together (Acid Bass Intelligence V4 §11): rhythm
 * plan (`rhythm.ts`) -> harmonic candidates (`candidates.ts`) -> coherent
 * selection (`voice-leading.ts`) -> controlled chromatic transform
 * (`chromaticism.ts`) -> register/physical realization (`playability.ts`).
 *
 * Deliberately not `generateBasslinePlan()` yet -- stages 6-7 (articulation,
 * explanation) are M9, and per §11 this must never collapse into one large
 * function. `BasslineSkeletonNote` already carries a real MIDI pitch and
 * fretboard position, but not yet accent/slide/gate/probability/ratchet/
 * explanation -- those, plus assembling the final `GeneratedBasslinePlan`
 * shape, are M9's job.
 */

import { getChordDefinition } from '$lib/music/chords';
import type { FretPosition } from '$lib/music/fretboard';
import { analyzeInterval, type HarmonicRole } from '$lib/music/harmony';
import { type IntervalId, intervalFromRoot } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';

import type { BassPitchCandidate, BassPitchCandidateSource } from './candidates';
import { generateHarmonicCandidates } from './candidates';
import type { ChromaticismNoteInput, ChromaticismTransform } from './chromaticism';
import { applyChromaticism } from './chromaticism';
import type { PlayabilityRequest } from './playability';
import { realizeSequence } from './playability';
import { createBasslineRandom } from './random';
import { generateBarRhythm } from './rhythm';
import { getBasslineStyleProfile } from './styles';
import type {
	BassHarmonyMode,
	BassNoteFunction,
	BasslineGenerationContext,
	BasslineStyleId
} from './types';
import type { VoiceLeadingSlotInput } from './voice-leading';
import { selectVoiceLeadingSequence } from './voice-leading';

export interface BasslineSkeletonNote {
	barIndex: number;
	stepIndex: number;
	pitchClass: PitchClass;
	intervalFromChord: IntervalId;
	intervalFromKey: IntervalId;
	harmonicRole: HarmonicRole;
	function: BassNoteFunction;
	midi: number;
	preferredPosition: FretPosition;
	alternativePositions: FretPosition[];
	/** True only when register mode is `'zone'` and no in-zone realization existed at all -- see `playability.ts`. */
	registerFallback: boolean;
}

/**
 * Only active rhythmic slots are represented -- rest steps carry no note to
 * generate. A later milestone (M9) pads this into a full
 * `GeneratedBassBar.steps` array covering every step, matching
 * `GeneratedBassStep`'s discriminated rest/note union.
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
	chordId: string;
	chordRoot: PitchClass;
	chordScaleId: string | null;
	strongBeat: boolean;
	beatGroupStart: boolean;
	weakSubdivision: boolean;
	input: VoiceLeadingSlotInput;
}

/** The un-transformed default `BassNoteFunction` for a candidate's own source -- `chromaticism.ts`'s transforms are the only thing that ever overrides this. */
function defaultFunctionForSource(source: BassPitchCandidateSource): BassNoteFunction {
	switch (source) {
		case 'root':
			return 'root';
		case 'chord':
			return 'chord-tone';
		case 'scale':
			return 'scale-tone';
		case 'anticipation':
			return 'anticipation';
	}
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
				chordId: bar.chord.chordId,
				chordRoot: bar.chord.root,
				chordScaleId: bar.chord.scaleId,
				strongBeat: slot.strongBeat,
				beatGroupStart: slot.beatGroupStart,
				weakSubdivision: slot.weakSubdivision,
				input: {
					candidates: generateHarmonicCandidates(bar.chord, context.tonic, slot),
					isChordBoundary: isFirstActiveSlotOfBar && chordChangedAtThisBar
				}
			});
			isFirstActiveSlotOfBar = false;
		}
	}

	const selections: BassPitchCandidate[] = selectVoiceLeadingSequence(
		pending.map((slot) => slot.input),
		{ harmonyMode: context.harmonyMode, style },
		random
	);

	const chromaticismNotes: ChromaticismNoteInput[] = pending.map((slot, index) => ({
		barIndex: slot.barIndex,
		stepIndex: slot.stepIndex,
		candidate: selections[index],
		chord: { root: slot.chordRoot, chordId: slot.chordId, scaleId: slot.chordScaleId },
		strongBeat: slot.strongBeat,
		beatGroupStart: slot.beatGroupStart,
		weakSubdivision: slot.weakSubdivision
	}));

	const transforms = applyChromaticism(chromaticismNotes, style, context.chromaticism, random);
	const transformByIndex = new Map<number, ChromaticismTransform>(
		transforms.map((t) => [t.index, t])
	);

	const preRealization = pending.map((slot, index) => {
		const transform = transformByIndex.get(index);
		if (transform) {
			const intervalFromChord = intervalFromRoot(slot.chordRoot, transform.pitchClass);
			return {
				barIndex: slot.barIndex,
				stepIndex: slot.stepIndex,
				pitchClass: transform.pitchClass,
				intervalFromChord,
				intervalFromKey: intervalFromRoot(context.tonic, transform.pitchClass),
				harmonicRole: analyzeInterval(getChordDefinition(slot.chordId), intervalFromChord),
				function: transform.function
			};
		}
		const candidate = selections[index];
		return {
			barIndex: slot.barIndex,
			stepIndex: slot.stepIndex,
			pitchClass: candidate.pitchClass,
			intervalFromChord: candidate.intervalFromChord,
			intervalFromKey: candidate.intervalFromKey,
			harmonicRole: candidate.harmonicRole,
			function: defaultFunctionForSource(candidate.source)
		};
	});

	const realizationRequests: PlayabilityRequest[] = preRealization.map((note) => ({
		pitchClass: note.pitchClass
	}));
	const realizations = realizeSequence(realizationRequests, {
		register: context.register,
		zone: context.zone,
		tuning: context.tuning,
		fretCount: context.fretCount,
		playability: context.playability
	});

	const notes: BasslineSkeletonNote[] = preRealization.map((note, index) => {
		const realization = realizations[index];
		return {
			...note,
			midi: realization.midi,
			preferredPosition: realization.preferredPosition,
			alternativePositions: realization.alternativePositions,
			registerFallback: realization.fallback
		};
	});

	return { seed: context.seed, style: context.style, harmonyMode: context.harmonyMode, notes };
}
