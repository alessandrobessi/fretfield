/**
 * Ties all seven pipeline stages together (Acid Bass Intelligence V4 §11):
 * rhythm plan (`rhythm.ts`) -> harmonic candidates (`candidates.ts`) ->
 * coherent selection (`voice-leading.ts`) -> controlled chromatic transform
 * (`chromaticism.ts`) -> register/physical realization (`playability.ts`) ->
 * articulation (accent/slide/gate, §20, inline below -- §20 names no
 * dedicated file) -> explanation (`explanations.ts`). `generateBassline()`
 * is the complete pure feature (§43 M9's acceptance criterion); each stage
 * stays independently testable per §11, so this file only wires them
 * together rather than reimplementing any of them.
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
import type { BassNoteExplanationTarget } from './explanations';
import { buildNoteExplanation } from './explanations';
import type { PlayabilityRequest } from './playability';
import { realizeSequence } from './playability';
import type { BasslineRandom } from './random';
import { createBasslineRandom } from './random';
import { generateBarRhythm } from './rhythm';
import type { BasslineStyleProfile } from './styles';
import { getBasslineStyleProfile } from './styles';
import type {
	BassHarmonyMode,
	BassNoteFunction,
	BassPhraseRole,
	BasslineGenerationContext,
	BasslineStyleId,
	GeneratedBassBar,
	GeneratedBasslinePlan,
	GeneratedBassNoteStep,
	GeneratedBassStep
} from './types';
import type { VoiceLeadingSlotInput } from './voice-leading';
import { pitchClassDistance, selectVoiceLeadingSequence } from './voice-leading';

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
 * generate. `generateBassline()` (below) pads this into a full
 * `GeneratedBassBar.steps` array covering every step.
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
	phraseRole: BassPhraseRole;
	chordId: string;
	chordRoot: PitchClass;
	chordScaleId: string | null;
	strongBeat: boolean;
	beatGroupStart: boolean;
	weakSubdivision: boolean;
	input: VoiceLeadingSlotInput;
}

interface PipelineResult {
	style: BasslineStyleProfile;
	random: BasslineRandom;
	pending: PendingSkeletonSlot[];
	transformByIndex: Map<number, ChromaticismTransform>;
	notes: BasslineSkeletonNote[];
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

/** Pipeline stages 1-5, shared by `generateBasslineSkeleton()` and `generateBassline()` so neither reimplements the other. */
function runPipeline(context: BasslineGenerationContext): PipelineResult {
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
				phraseRole: bar.phraseRole,
				chordId: bar.chord.chordId,
				chordRoot: bar.chord.root,
				chordScaleId: bar.chord.scaleId,
				strongBeat: slot.strongBeat,
				beatGroupStart: slot.beatGroupStart,
				weakSubdivision: slot.weakSubdivision,
				input: {
					candidates: generateHarmonicCandidates(bar.chord, context.tonic, slot),
					isChordBoundary: isFirstActiveSlotOfBar && chordChangedAtThisBar,
					weakSubdivision: slot.weakSubdivision
				}
			});
			isFirstActiveSlotOfBar = false;
		}
	}

	const selections: BassPitchCandidate[] = selectVoiceLeadingSequence(
		pending.map((slot) => slot.input),
		{
			harmonyMode: context.harmonyMode,
			style,
			movement: context.movement,
			chromaticism: context.chromaticism
		},
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

	return { style, random, pending, transformByIndex, notes };
}

export function generateBasslineSkeleton(context: BasslineGenerationContext): BasslineSkeleton {
	const { notes } = runPipeline(context);
	return { seed: context.seed, style: context.style, harmonyMode: context.harmonyMode, notes };
}

// ---------------------------------------------------------------------------
// Stage 6: articulation (§20) -- accent/slide/gate. No dedicated file: §20
// names none, unlike chromaticism.ts/playability.ts/explanations.ts.
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

function clampGate(value: number): number {
	return Math.min(100, Math.max(10, Math.round(value)));
}

const ACCENT_DENSITY_WEIGHT = 0.4;
const ACCENT_CHORD_BOUNDARY_BONUS = 25;
const ACCENT_ROOT_STRONG_BEAT_BONUS = 20;
const ACCENT_SYNCOPATION_BONUS = 15;
const ACCENT_CHROMATIC_DESTINATION_BONUS = 20;
const ACCENT_TURNAROUND_ARRIVAL_BONUS = 25;
/** Styles at or above this `syncopation` weight qualify as "important syncopation" territory (Funk 78, Acid 82; Walking/Rooted/Melodic/Chromatic fall below). */
const SYNCOPATED_STYLE_THRESHOLD = 60;

interface AccentSlotContext {
	strongBeat: boolean;
	weakSubdivision: boolean;
	isChordBoundary: boolean;
	isTurnaroundArrival: boolean;
}

/** §20: reward accent on a strong chord target, root-on-a-strong-beat, important syncopation in Funk/Acid, the destination after a chromatic approach, and turnaround arrival -- but never unconditionally ("do not accent every root"): with no qualifying reason at all, accent is never even rolled. */
function computeAccent(
	note: { function: BassNoteFunction; harmonicRole: HarmonicRole },
	slot: AccentSlotContext,
	isChromaticDestination: boolean,
	style: BasslineStyleProfile,
	random: BasslineRandom
): boolean {
	let bonus = 0;
	if (
		slot.isChordBoundary &&
		(note.harmonicRole === 'root' ||
			note.harmonicRole === 'structural' ||
			note.harmonicRole === 'stable')
	) {
		bonus += ACCENT_CHORD_BOUNDARY_BONUS;
	}
	if (note.function === 'root' && slot.strongBeat) {
		bonus += ACCENT_ROOT_STRONG_BEAT_BONUS;
	}
	if (slot.weakSubdivision && style.syncopation >= SYNCOPATED_STYLE_THRESHOLD) {
		bonus += ACCENT_SYNCOPATION_BONUS;
	}
	if (isChromaticDestination) {
		bonus += ACCENT_CHROMATIC_DESTINATION_BONUS;
	}
	if (slot.isTurnaroundArrival) {
		bonus += ACCENT_TURNAROUND_ARRIVAL_BONUS;
	}
	if (bonus <= 0) return false;
	return random.chance(clampPercent(style.accentDensity * ACCENT_DENSITY_WEIGHT + bonus));
}

const SLIDE_DENSITY_WEIGHT = 0.5;
/** Only a semitone or whole-step destination is a legal slide target (§20). */
const SLIDE_MAX_DISTANCE = 2;

/** §20: reward slide toward an adjacent (semitone/whole-step) active note, scaled by style `slideDensity`. Generated V4's ratchet is always 1 (§20's own simplifying note), so there is no ratchet-vs-slide conflict to resolve here. Cross-bar sliding is a patch-level (`AcidBassPatch.crossBarSlide`) concern this pure module has no access to -- proposing slide candidacy here, gating it against that setting is later store-integration work. */
function computeSlide(
	pitchClass: PitchClass,
	nextPitchClass: PitchClass | null,
	style: BasslineStyleProfile,
	random: BasslineRandom
): boolean {
	if (nextPitchClass === null) return false;
	const distance = pitchClassDistance(pitchClass, nextPitchClass);
	if (distance === 0 || distance > SLIDE_MAX_DISTANCE) return false;
	return random.chance(clampPercent(style.slideDensity * SLIDE_DENSITY_WEIGHT));
}

const GATE_CHROMATIC_SOURCE_DELTA = -15;
const GATE_FUNK_SYNCOPATION_DELTA = -10;
const GATE_PHRASE_ENDING_DELTA = 10;
const GATE_WALKING_DELTA = 10;

/** §20: start from style `preferredGate`, modify modestly by context, clamp to the existing Acid Bass legal 10-100 range. A slide source's gate is forced open (100) into its destination, per §20's own instruction. */
function computeGate(
	style: BasslineStyleProfile,
	isChromaticSource: boolean,
	weakSubdivision: boolean,
	isLastActiveOfBar: boolean,
	slide: boolean
): number {
	if (slide) return 100;
	let gate = style.preferredGate;
	if (isChromaticSource) gate += GATE_CHROMATIC_SOURCE_DELTA;
	if (style.id === 'funk' && weakSubdivision) gate += GATE_FUNK_SYNCOPATION_DELTA;
	if (isLastActiveOfBar) gate += GATE_PHRASE_ENDING_DELTA;
	if (style.id === 'walking') gate += GATE_WALKING_DELTA;
	return clampGate(gate);
}

// ---------------------------------------------------------------------------
// Stage 7 + final assembly
// ---------------------------------------------------------------------------

/** The complete pure feature (§43 M9 acceptance): every pipeline stage, end to end, into a `GeneratedBasslinePlan`. */
export function generateBassline(context: BasslineGenerationContext): GeneratedBasslinePlan {
	const { style, random, pending, transformByIndex, notes } = runPipeline(context);

	const chromaticDestinationIndices = new Set<number>(
		Array.from(transformByIndex.values(), (t) => t.targetIndex)
	);

	const lastActiveIndexByBar = new Map<number, number>();
	pending.forEach((slot, index) => lastActiveIndexByBar.set(slot.barIndex, index));
	const lastActiveIndices = new Set(lastActiveIndexByBar.values());

	const stepsByBar = new Map<number, GeneratedBassStep[]>();
	for (const bar of context.bars) {
		stepsByBar.set(
			bar.barIndex,
			Array.from({ length: context.meter.stepsPerBar }, (_, stepIndex) => ({
				stepIndex,
				active: false as const
			}))
		);
	}

	pending.forEach((slot, index) => {
		const note = notes[index];
		const isChromaticSource = transformByIndex.has(index);
		const isChromaticDestination = chromaticDestinationIndices.has(index);
		const isTurnaroundArrival = slot.phraseRole === 'turnaround' && slot.input.isChordBoundary;

		const accent = computeAccent(
			note,
			{
				strongBeat: slot.strongBeat,
				weakSubdivision: slot.weakSubdivision,
				isChordBoundary: slot.input.isChordBoundary,
				isTurnaroundArrival
			},
			isChromaticDestination,
			style,
			random
		);

		const nextNote = notes.length > 1 ? notes[(index + 1) % notes.length] : null;
		const slide = computeSlide(note.pitchClass, nextNote?.pitchClass ?? null, style, random);

		const gate = computeGate(
			style,
			isChromaticSource,
			slot.weakSubdivision,
			lastActiveIndices.has(index),
			slide
		);

		let target: BassNoteExplanationTarget | undefined;
		const transform = transformByIndex.get(index);
		if (transform) {
			const targetNote = notes[transform.targetIndex];
			target = {
				pitchClass: targetNote.pitchClass,
				midi: targetNote.midi,
				intervalFromChord: targetNote.intervalFromChord
			};
		}

		const explanation = buildNoteExplanation({
			pitchClass: note.pitchClass,
			function: note.function,
			harmonicRole: note.harmonicRole,
			intervalFromChord: note.intervalFromChord,
			intervalFromKey: note.intervalFromKey,
			chord: { root: slot.chordRoot, chordId: slot.chordId, scaleId: slot.chordScaleId },
			target
		});

		const step: GeneratedBassNoteStep = {
			stepIndex: slot.stepIndex,
			active: true,
			midi: note.midi,
			pitchClass: note.pitchClass,
			intervalFromChord: note.intervalFromChord,
			intervalFromKey: note.intervalFromKey,
			function: note.function,
			harmonicRole: note.harmonicRole,
			accent,
			slide,
			gate,
			probability: 100,
			ratchet: 1,
			preferredPosition: note.preferredPosition,
			alternativePositions: note.alternativePositions,
			explanation
		};

		stepsByBar.get(slot.barIndex)![slot.stepIndex] = step;
	});

	const bars: GeneratedBassBar[] = context.bars.map((bar) => ({
		barIndex: bar.barIndex,
		phraseRole: bar.phraseRole,
		chord: bar.chord,
		steps: stepsByBar.get(bar.barIndex)!
	}));

	return { seed: context.seed, style: context.style, harmonyMode: context.harmonyMode, bars };
}
