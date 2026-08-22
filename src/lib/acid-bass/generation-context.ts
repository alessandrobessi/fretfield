/**
 * Adapts current Scale Practice/Groove state into a pure
 * `BasslineGenerationContext` the `$lib/music/bassline/` generator can
 * consume (Acid Bass Intelligence V4, `~/Downloads/ACID-BASS-INTELLIGENCE-V4.md`
 * §9). This is the one place in the Acid Bass domain allowed to depend on
 * both Groove-adjacent types (`PatternRole`/`TimeSignature`) *and* the pure
 * `music/bassline` domain, since it's the integration bridge -- `music/
 * bassline/*` itself must never import Groove (spec §45).
 *
 * A pure function over plain inputs, not a live store reference -- the
 * store (a later milestone) passes its own current field values in, which
 * keeps this fully testable with hand-built fixtures and keeps no
 * generator theory living in Svelte (spec §45's `scale-practice.svelte.ts`
 * entry).
 */

import type { PatternRole } from '$lib/groove/pattern-role';
import { TIME_SIGNATURES, type TimeSignature } from '$lib/groove/time-signature';
import type { AbsoluteTuning } from '$lib/music/absolute-pitch';
import { buildBarContexts, lcm } from '$lib/music/bassline/context';
import type {
	BasslineBarContext,
	BasslineChordContext,
	BasslineGenerationContext,
	BassPhraseRole
} from '$lib/music/bassline/types';
import type { PitchClass } from '$lib/music/pitch';
import type { ResolvedChord } from '$lib/music/progressions';
import type { PracticeZone } from '$lib/scale-practice/types';

import type { AcidBassGenerationSettings } from './types';

/** `A/B/F/T` -> `main/variation/fill/turnaround` (spec §9). */
const PHRASE_ROLE_BY_PATTERN_ROLE: Record<PatternRole, BassPhraseRole> = {
	A: 'main',
	B: 'variation',
	F: 'fill',
	T: 'turnaround'
};

export interface AcidBassGenerationContextInput {
	root: PitchClass | null;
	/** `scale-practice.svelte.ts`'s own `resolvedProgression`. */
	resolvedProgression: readonly ResolvedChord[];
	/** Index-aligned with `resolvedProgression` -- `null` means that chord's scale was explicitly cleared (the fretboard's own "—"), preserved as-is, never silently substituted (spec §9). */
	progressionChordScales: readonly (string | null)[];
	barsPerChord: number;
	arrangement: readonly PatternRole[];
	timeSignature: TimeSignature;
	zone: PracticeZone;
	tuning: AbsoluteTuning;
	fretCount: number;
	generation: AcidBassGenerationSettings;
}

/**
 * Returns `null` when generation isn't meaningful yet -- no root, no
 * progression selected, or a structurally degenerate arrangement -- rather
 * than inventing a hidden chord (spec §9: "Scale Practice's chord-scale
 * context exists only when a progression is selected"). Callers (the store,
 * later milestones) should disable the Generate action and show an
 * explanatory message in that case, not treat `null` as an error.
 */
export function buildAcidBassGenerationContext(
	input: AcidBassGenerationContextInput
): BasslineGenerationContext | null {
	if (input.root === null) return null;
	if (input.resolvedProgression.length === 0) return null;

	const arrangementBars = input.arrangement.length;
	if (arrangementBars === 0) return null;

	const progressionBars = input.resolvedProgression.length * input.barsPerChord;
	if (progressionBars <= 0) return null;

	const cycleBars = lcm(progressionBars, arrangementBars);
	if (cycleBars <= 0) return null;

	const entries: { phraseRole: BassPhraseRole; chord: BasslineChordContext }[] = [];
	for (let barIndex = 0; barIndex < cycleBars; barIndex++) {
		const chordIndex = Math.floor(barIndex / input.barsPerChord) % input.resolvedProgression.length;
		const chord = input.resolvedProgression[chordIndex];
		const patternRole = input.arrangement[barIndex % arrangementBars];
		entries.push({
			phraseRole: PHRASE_ROLE_BY_PATTERN_ROLE[patternRole],
			chord: {
				root: chord.root,
				chordId: chord.chordId,
				scaleId: input.progressionChordScales[chordIndex] ?? null
			}
		});
	}

	const bars: BasslineBarContext[] = buildBarContexts(entries);
	const meterInfo = TIME_SIGNATURES[input.timeSignature];

	return {
		tonic: input.root,
		bars,
		meter: {
			stepsPerBar: meterInfo.stepsPerBar,
			stepsPerBeatGroup: meterInfo.stepsPerBeatGroup,
			isCompound: meterInfo.isCompound
		},
		style: input.generation.style,
		harmonyMode: input.generation.harmonyMode,
		density: input.generation.density,
		chromaticism: input.generation.chromaticism,
		movement: input.generation.movement,
		register: input.generation.register,
		playability: input.generation.playability,
		zone: { minFret: input.zone.minFret, maxFret: input.zone.maxFret },
		tuning: input.tuning,
		fretCount: input.fretCount,
		seed: input.generation.seed
	};
}
