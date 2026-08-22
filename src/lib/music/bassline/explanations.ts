/**
 * Harmonic explanations (Acid Bass Intelligence V4 §21) -- pipeline stage 7.
 * Produced entirely from data the generator already computed (interval,
 * role, function, target); never reverse-engineered later in Svelte, per
 * §21's own explicit instruction. Reuses `roleCharacter()` for the generic
 * chord/scale-tone case rather than a second UI-copy table (§21: "use
 * existing roleCharacter() where useful").
 *
 * Musical, descriptive language throughout -- never verdict language like
 * "wrong"/"bad"/"forbidden" (§21, matching AGENTS.md §22's "no wrong note"
 * framing).
 */

import { type HarmonicRole, roleCharacter } from '$lib/music/harmony';
import { type IntervalId, intervalLabel } from '$lib/music/intervals';
import { defaultNoteName } from '$lib/music/pitch';
import type { PitchClass } from '$lib/music/pitch';
import { resolvedChordSymbol } from '$lib/music/progressions';

import type { BassNoteExplanation, BassNoteFunction, BasslineChordContext } from './types';

export interface BassNoteExplanationTarget {
	pitchClass: PitchClass;
	midi: number;
	intervalFromChord: IntervalId;
}

export interface BassNoteExplanationInput {
	pitchClass: PitchClass;
	function: BassNoteFunction;
	harmonicRole: HarmonicRole;
	intervalFromChord: IntervalId;
	intervalFromKey: IntervalId;
	chord: BasslineChordContext;
	/** Only meaningful for the target-referencing functions (chromatic-approach, diatonic-approach, enclosure-upper, enclosure-lower, voice-leading-target). */
	target?: BassNoteExplanationTarget;
}

function genericToneDetail(role: HarmonicRole): string {
	switch (role) {
		case 'root':
			return 'Strong tonal anchor.';
		case 'structural':
			return "Structural chord tone — defines the chord's quality.";
		case 'stable':
			return 'Stable chord tone.';
		default:
			return roleCharacter(role);
	}
}

/** Whether `target` sits exactly one semitone above `pitchClass` (mod 12) -- chromatic-approach transforms are always exactly this by construction (`chromaticism.ts`). */
function resolvesUpward(pitchClass: PitchClass, target: PitchClass): boolean {
	return (((target - pitchClass) % 12) + 12) % 12 === 1;
}

export function buildNoteExplanation(input: BassNoteExplanationInput): BassNoteExplanation {
	const chordLabel = resolvedChordSymbol(input.chord);
	const intervalText = intervalLabel(input.intervalFromChord);
	const targetName = input.target ? defaultNoteName(input.target.pitchClass) : null;

	const base = {
		role: input.harmonicRole,
		function: input.function,
		intervalFromChord: input.intervalFromChord,
		intervalFromKey: input.intervalFromKey,
		...(input.target && {
			targetMidi: input.target.midi,
			targetInterval: input.target.intervalFromChord
		})
	};

	switch (input.function) {
		case 'root':
			return { ...base, headline: `Root of ${chordLabel}`, detail: 'Strong tonal anchor.' };

		case 'chord-tone':
			return {
				...base,
				headline: `${intervalText} of ${chordLabel}`,
				detail: genericToneDetail(input.harmonicRole)
			};

		case 'scale-tone':
			return {
				...base,
				headline: `${intervalText} of ${chordLabel}`,
				detail: `Scale tone. ${genericToneDetail(input.harmonicRole)}`
			};

		case 'passing-tone':
			return {
				...base,
				headline: 'Scale passing tone',
				detail: targetName
					? `Connects toward ${targetName} by step.`
					: 'Connects between chord tones by step.'
			};

		case 'chromatic-approach': {
			const direction = targetName
				? resolvesUpward(input.pitchClass, input.target!.pitchClass)
					? 'upward'
					: 'downward'
				: null;
			return {
				...base,
				headline: targetName ? `Chromatic approach to ${targetName}` : 'Chromatic approach',
				detail: direction
					? `Resolves ${direction} by semitone into the next target.`
					: 'Resolves by semitone into the next target.'
			};
		}

		case 'diatonic-approach':
			return {
				...base,
				headline: targetName ? `Diatonic approach to ${targetName}` : 'Diatonic approach',
				detail: targetName
					? `Connects by step toward ${targetName}.`
					: 'Connects by step toward the next target.'
			};

		case 'enclosure-upper':
			return {
				...base,
				headline: targetName ? `Upper enclosure of ${targetName}` : 'Upper enclosure',
				detail: targetName
					? `Approaches ${targetName} from above, resolving on the next target.`
					: 'Approaches the target from above.'
			};

		case 'enclosure-lower':
			return {
				...base,
				headline: targetName ? `Lower enclosure of ${targetName}` : 'Lower enclosure',
				detail: targetName
					? `Approaches ${targetName} from below, resolving on the next target.`
					: 'Approaches the target from below.'
			};

		case 'voice-leading-target':
			return {
				...base,
				headline: `${intervalText} of ${chordLabel}`,
				detail: targetName
					? `Guide tone. Moves by step to ${targetName} in the next harmony.`
					: 'Guide tone, chosen for smooth motion into the next harmony.'
			};

		case 'pedal':
			return {
				...base,
				headline: `${intervalText} of ${chordLabel}`,
				detail: 'Sustained pedal tone.'
			};

		case 'anticipation':
			return {
				...base,
				headline: `${intervalText} of ${chordLabel}`,
				detail: 'Anticipates the upcoming harmony.'
			};
	}
}
