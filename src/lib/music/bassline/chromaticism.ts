/**
 * Controlled chromaticism (Acid Bass Intelligence V4 §18) -- pipeline stage
 * 4. A *transformation* of an already-selected, coherent line
 * (`voice-leading.ts`'s output), never a new candidate source: every
 * transform this module proposes replaces an existing weak-subdivision
 * selection with a note that resolves, by construction, into a specific
 * unchanged target a few slots later. There is no such thing as an
 * unresolved chromatic note here.
 *
 * Deliberately its own pure module, independent of `generate.ts`'s
 * `BasslineSkeletonNote` shape (that wiring is M8's job, alongside register
 * realization) -- `ChromaticismNoteInput` is this module's own minimal input
 * contract so it stays independently testable per §18's own instruction.
 *
 * Four devices (§18): lower/upper chromatic approach (one `IntervalId`-free
 * function -- direction is just which side of the target the inserted pitch
 * class falls on), diatonic passing tone, and two-note enclosure. Chord
 * boundaries are not treated specially beyond already being a normal
 * `stable`/`structural`/`root`-role target like any other -- §18 only says a
 * boundary target *may* receive extra emphasis, not that it must.
 */

import type { HarmonicRole } from '$lib/music/harmony';
import { transpose } from '$lib/music/pitch';
import type { PitchClass } from '$lib/music/pitch';
import { getScaleDefinition, scalePitchClasses } from '$lib/music/scales';

import type { BassPitchCandidate } from './candidates';
import type { BasslineRandom } from './random';
import type { BasslineStyleProfile } from './styles';
import type { BassNoteFunction, BasslineChordContext } from './types';

export type ChromaticismTransformFunction = Extract<
	BassNoteFunction,
	'chromatic-approach' | 'diatonic-approach' | 'enclosure-upper' | 'enclosure-lower'
>;

/** One already-selected note from `voice-leading.ts`'s output, plus the rhythmic/harmonic context `chromaticism.ts` needs to decide whether -- and how -- to transform it. */
export interface ChromaticismNoteInput {
	barIndex: number;
	stepIndex: number;
	candidate: BassPitchCandidate;
	chord: BasslineChordContext;
	strongBeat: boolean;
	beatGroupStart: boolean;
	weakSubdivision: boolean;
}

/** Replaces `notes[index]`'s pitch class -- `notes[targetIndex]` is never itself replaced by any transform (see `TARGET_ROLES`/eligibility below, which are mutually exclusive by construction). */
export interface ChromaticismTransform {
	index: number;
	pitchClass: PitchClass;
	function: ChromaticismTransformFunction;
	targetIndex: number;
}

/** §18: "target should normally be root/structural/stable." */
const TARGET_ROLES: ReadonlySet<HarmonicRole> = new Set(['root', 'structural', 'stable']);

/**
 * §18 says "prefer chromatic approach on weak subdivisions" and separately
 * "never overwrite a stronger required target merely to increase
 * chromaticism." Combined, a hard rule falls out: this module only ever
 * transforms weak-subdivision, non-target-role notes -- strong-beat/
 * beat-group-start notes and existing root/structural/stable selections are
 * never touched, so the "preference" and the "never overwrite" rule can
 * never conflict.
 */
function isEligibleApproachSlot(
	note: ChromaticismNoteInput,
	index: number,
	claimed: ReadonlySet<number>
): boolean {
	if (claimed.has(index)) return false;
	if (!note.weakSubdivision) return false;
	return !TARGET_ROLES.has(note.candidate.harmonicRole);
}

/** Semitones travelling *up* from `from` to `to`, 1-11 (never 0 -- callers only use this to rank distinct scale tones). */
function stepsUp(from: PitchClass, to: PitchClass): number {
	return (((to - from) % 12) + 12) % 12;
}

function nearestScaleNeighbor(
	target: PitchClass,
	scalePitchClassesForChord: readonly PitchClass[],
	direction: 'above' | 'below'
): PitchClass | null {
	let best: PitchClass | null = null;
	let bestDistance = Infinity;
	for (const pitchClass of scalePitchClassesForChord) {
		if (pitchClass === target) continue;
		const distance =
			direction === 'above' ? stepsUp(target, pitchClass) : stepsUp(pitchClass, target);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = pitchClass;
		}
	}
	return best;
}

function diatonicApproachPitchClass(
	target: ChromaticismNoteInput,
	random: BasslineRandom
): PitchClass | null {
	if (target.chord.scaleId === null) return null;
	const scale = getScaleDefinition(target.chord.scaleId);
	const pitchClasses = scalePitchClasses(target.chord.root, scale);
	const below = nearestScaleNeighbor(target.candidate.pitchClass, pitchClasses, 'below');
	const above = nearestScaleNeighbor(target.candidate.pitchClass, pitchClasses, 'above');
	if (below === null && above === null) return null;
	if (below === null) return above;
	if (above === null) return below;
	return random.chance(50) ? below : above;
}

interface EnclosureNote {
	pitchClass: PitchClass;
	function: ChromaticismTransformFunction;
}

/**
 * §18's two enclosure examples (`D -> B -> C`, `B -> Db -> C`) both pair one
 * chromatic-lower approach with one upper neighbor that is sometimes
 * chromatic (Db) and sometimes diatonic (D) -- "the exact upper/lower
 * ordering may depend on available scale/chord context." This picks the
 * upper neighbor from the assigned scale when one is available, otherwise
 * falls back to a chromatic upper neighbor, and randomizes which of the two
 * notes plays first (the "outer" slot, further from the target) versus
 * immediately before the target (the "inner" slot) -- both example orderings
 * are legitimate instances of the same general device.
 */
function buildEnclosure(
	target: ChromaticismNoteInput,
	random: BasslineRandom
): [outer: EnclosureNote, inner: EnclosureNote] {
	const targetPitchClass = target.candidate.pitchClass;
	const lower: EnclosureNote = {
		pitchClass: transpose(targetPitchClass, -1),
		function: 'enclosure-lower'
	};
	const diatonicAbove =
		target.chord.scaleId !== null
			? nearestScaleNeighbor(
					targetPitchClass,
					scalePitchClasses(target.chord.root, getScaleDefinition(target.chord.scaleId)),
					'above'
				)
			: null;
	const upper: EnclosureNote = {
		pitchClass:
			diatonicAbove !== null && random.chance(50) ? diatonicAbove : transpose(targetPitchClass, 1),
		function: 'enclosure-upper'
	};
	return random.chance(50) ? [upper, lower] : [lower, upper];
}

type ChromaticismDevice = 'chromatic' | 'diatonic' | 'enclosure';

function pickDevice(
	style: BasslineStyleProfile,
	enclosureEligible: boolean,
	random: BasslineRandom
): ChromaticismDevice {
	const weights: [ChromaticismDevice, number][] = [
		['chromatic', style.chromaticApproachWeight],
		['diatonic', style.passingToneWeight]
	];
	if (enclosureEligible) {
		weights.push(['enclosure', style.enclosureWeight]);
	}
	const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
	if (total <= 0) return 'chromatic';
	let roll = random.next() * total;
	for (const [device, weight] of weights) {
		if (roll < weight) return device;
		roll -= weight;
	}
	return weights[weights.length - 1][0];
}

/**
 * Proposes chromatic/diatonic/enclosure transforms over an already-selected
 * note sequence. `notes` is treated as one repeating cycle (matching the
 * generation context's own wrap-aware design, `context.ts`) -- a target at
 * index 0 may legitimately be approached by a transform at the sequence's
 * last index, per §18's explicit "wrap-aware turnaround resolution is
 * allowed." Every transform this function returns already has a resolved,
 * unchanged target within `notes`, so no returned transform is ever
 * dangling.
 *
 * `chromaticism` (0-100, the user setting) scales how often an eligible
 * transform actually fires; `chromaticism <= 0` always returns `[]`.
 * `random` is an already-created `BasslineRandom` -- callers thread the same
 * single instance the rest of the pipeline (`rhythm.ts`, `voice-leading.ts`)
 * already uses, so a seed still reproduces the whole plan deterministically.
 */
export function applyChromaticism(
	notes: readonly ChromaticismNoteInput[],
	style: BasslineStyleProfile,
	chromaticism: number,
	random: BasslineRandom
): ChromaticismTransform[] {
	if (notes.length < 2 || chromaticism <= 0) return [];

	const deviceWeightTotal =
		style.chromaticApproachWeight + style.enclosureWeight + style.passingToneWeight;
	if (deviceWeightTotal <= 0) return [];

	const count = notes.length;
	const claimed = new Set<number>();
	const transforms: ChromaticismTransform[] = [];

	for (let targetIndex = 0; targetIndex < count; targetIndex++) {
		const target = notes[targetIndex];
		if (!TARGET_ROLES.has(target.candidate.harmonicRole)) continue;

		const prevIndex = (targetIndex - 1 + count) % count;
		if (prevIndex === targetIndex) continue;
		const prev = notes[prevIndex];
		if (!isEligibleApproachSlot(prev, prevIndex, claimed)) continue;

		if (!random.chance(chromaticism)) continue;

		const prevPrevIndex = (prevIndex - 1 + count) % count;
		const enclosureEligible =
			style.enclosureWeight > 0 &&
			prevPrevIndex !== targetIndex &&
			prevPrevIndex !== prevIndex &&
			isEligibleApproachSlot(notes[prevPrevIndex], prevPrevIndex, claimed);

		const device = pickDevice(style, enclosureEligible, random);

		if (device === 'enclosure') {
			const [outer, inner] = buildEnclosure(target, random);
			transforms.push({
				index: prevPrevIndex,
				pitchClass: outer.pitchClass,
				function: outer.function,
				targetIndex
			});
			transforms.push({
				index: prevIndex,
				pitchClass: inner.pitchClass,
				function: inner.function,
				targetIndex
			});
			claimed.add(prevPrevIndex);
			claimed.add(prevIndex);
			continue;
		}

		if (device === 'diatonic') {
			const pitchClass = diatonicApproachPitchClass(target, random);
			if (pitchClass === null) continue; // no scale assigned -- fall through, leave this slot untransformed
			transforms.push({ index: prevIndex, pitchClass, function: 'diatonic-approach', targetIndex });
			claimed.add(prevIndex);
			continue;
		}

		const lower = random.chance(50);
		transforms.push({
			index: prevIndex,
			pitchClass: transpose(target.candidate.pitchClass, lower ? -1 : 1),
			function: 'chromatic-approach',
			targetIndex
		});
		claimed.add(prevIndex);
	}

	return transforms;
}
