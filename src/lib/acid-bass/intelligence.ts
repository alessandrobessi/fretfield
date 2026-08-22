/**
 * The Acid Intelligence bridge (Acid Bass Intelligence V4 §22) -- not
 * another generator. It converts a `GeneratedBassStep`'s already-decided
 * musical function into a theory-free performance instruction the scheduler/
 * audio voice can consume, the same way `resolveAcidStepMidi()` already
 * bridges a manual step's theory-aware `interval` into a plain MIDI number.
 * `acid-bass-voice.ts` never learns about chord/scale/HarmonicRole/
 * BassNoteFunction -- this is the one place that boundary gets crossed.
 *
 * M10 shipped the minimal neutral adapter only (pass the generator's own
 * accent/gate straight through, no locks, no random-modulation). M14 adds
 * §22's actual musical mapping table -- deliberately only the subset that
 * doesn't need modulation (M15) or distortion (M16) to exist yet: gate
 * refinement, accent emphasis, and one filter/env lock. The music generator
 * still decides note/Accent/Slide/Gate basics (§22: "do not change note
 * generation here") -- this module only ever enriches, never overrides, what
 * the generator already chose.
 */

import type { HarmonicRole } from '$lib/music/harmony';
import { getBasslineStyleProfile } from '$lib/music/bassline/styles';
import type { BasslineStyleId, GeneratedBassNoteStep } from '$lib/music/bassline/types';

import type { AcidBassPatch, AcidStepLocks } from './types';

export interface AcidGeneratedExpression {
	accent: boolean;
	gatePercent: number;
	/** Temporary step-local performance offsets, reusing the existing parameter-lock idea where appropriate. Always `undefined` at `intelligence <= 0` (§22's own "intelligence = 0 returns the generated articulation with no extra parameter locks"). */
	locks?: AcidStepLocks;
	/** Deterministic -1..1 value supplied to Random modulation (§22). 0 at `intelligence <= 0`; consumed once Random modulation (M15) exists. */
	randomModulationValue: number;
}

/** §18's "target should normally be root/structural/stable" -- a "strong destination" for accent-emphasis purposes is exactly that same set. */
const STRONG_DESTINATION_ROLES: ReadonlySet<HarmonicRole> = new Set([
	'root',
	'structural',
	'stable'
]);
/** A "high-tension event" for the filter/env lock -- the harmonic engine's own tension-flavored roles. */
const HIGH_TENSION_ROLES: ReadonlySet<HarmonicRole> = new Set(['tension', 'alteration']);

/** §22: "chromatic approach -> slightly shorter gate." Max shortening (percentage points) at `intelligence: 100`. */
const CHROMATIC_GATE_SHORTEN_MAX = 15;
/** §22: "high-tension event -> modest ... envAmount lift." Max lift (absolute points, `envAmount` is bipolar -100..100) at `intelligence: 100`. */
const ENV_AMOUNT_LIFT_MAX = 18;
const GATE_MIN = 10;
const GATE_MAX = 100;
const ENV_AMOUNT_MIN = -100;
const ENV_AMOUNT_MAX = 100;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * A standard integer bit-mixing hash (murmur3-style finalizer, the same
 * technique `acid-bass/sequencer.ts`'s own `seededRoll` already uses) seeded
 * off the step's own stable identity fields plus a caller-supplied salt so
 * the accent roll and the random-modulation value don't collide on the same
 * step -- never `Math.random()`, so the exact same step/intelligence/style
 * always produces the exact same expression (§22's "deterministic expression"
 * requirement).
 */
function deterministicUnit(step: GeneratedBassNoteStep, salt: number): number {
	let h = (step.stepIndex * 73856093) ^ (step.midi * 19349663) ^ (salt * 83492791);
	h = Math.imul(h ^ (h >>> 16), 2246822519);
	h = Math.imul(h ^ (h >>> 13), 3266489917);
	h ^= h >>> 16;
	return (h >>> 0) / 0xffffffff;
}

/**
 * §22's Acid Intelligence bridge. `intelligence <= 0` returns the generated
 * articulation completely unmodified (no locks, no random-modulation
 * contribution) -- the guaranteed neutral floor the spec requires.
 */
export function resolveAcidIntelligence(
	step: GeneratedBassNoteStep,
	patch: AcidBassPatch,
	intelligence: number,
	style: BasslineStyleId
): AcidGeneratedExpression {
	if (intelligence <= 0) {
		return { accent: step.accent, gatePercent: step.gate, randomModulationValue: 0 };
	}

	const amount = clamp(intelligence, 0, 100) / 100;

	// Gate refinement: a chromatic-approach note resolves with a slightly
	// shorter, snappier gate rather than ringing into its target.
	const gatePercent =
		step.function === 'chromatic-approach'
			? clamp(step.gate - CHROMATIC_GATE_SHORTEN_MAX * amount, GATE_MIN, GATE_MAX)
			: step.gate;

	// Accent emphasis: an unaccented strong destination gains a chance of
	// extra accent -- scaled by both intelligence and the style's own
	// `accentDensity`, so a busier style leans into intelligence-driven
	// accents more readily than a sparse one. Never removes an accent the
	// generator already decided (§22: enrich, never override).
	let accent = step.accent;
	if (!accent && STRONG_DESTINATION_ROLES.has(step.harmonicRole)) {
		const accentDensity = getBasslineStyleProfile(style).accentDensity;
		const threshold = amount * (accentDensity / 100) * 100;
		const roll = deterministicUnit(step, 1) * 100;
		if (roll < threshold) accent = true;
	}

	// Filter/env lock: a high-tension event gets a modest envAmount lift over
	// the patch's own current value, clamped to `envAmount`'s legal range.
	let locks: AcidStepLocks | undefined;
	if (HIGH_TENSION_ROLES.has(step.harmonicRole)) {
		locks = {
			envAmount: clamp(
				patch.filter.envAmount + ENV_AMOUNT_LIFT_MAX * amount,
				ENV_AMOUNT_MIN,
				ENV_AMOUNT_MAX
			)
		};
	}

	// Deterministic random-modulation value: stable per step, scaled toward 0
	// as intelligence drops so the Random source (M15) stays proportionally
	// quieter at lower intelligence too.
	const randomModulationValue = clamp((deterministicUnit(step, 2) * 2 - 1) * amount, -1, 1);

	return { accent, gatePercent, locks, randomModulationValue };
}
