/**
 * Deterministic per-bar rhythm generation (Acid Bass Intelligence V4 §13) --
 * runs *before* pitch generation. Produces an active/rest mask plus
 * per-step rhythmic metadata; a later milestone (`candidates.ts`/
 * `generate.ts`) assigns pitches only to the slots this marks active.
 *
 * Deliberately generated one bar at a time from an already-created
 * `BasslineRandom` (never a raw seed) -- the caller (a later milestone's
 * `generate.ts`) threads one `BasslineRandom` instance across every bar and
 * every pipeline stage, which is what keeps a whole multi-bar plan
 * deterministic from one seed, not just one bar in isolation.
 *
 * V4 generated mode is deterministic and intentional: no per-generated-step
 * probability and no ratchets (spec §13/§25.4) -- `random.chance` here
 * decides once, at generation time, whether a slot is active at all; it
 * never becomes a runtime probability gate the way a manual step's own
 * `probability` field does.
 */

import type { BasslineRandom } from './random';
import type { BasslineMeterContext, BassPhraseRole } from './types';
import type { BasslineStyleProfile } from './styles';

export interface BassRhythmSlot {
	stepIndex: number;
	active: boolean;
	/** The single strongest anchor in the bar -- step 0 only (meter-agnostic; matches the existing manual Acid Bass default patterns' own "step 0 is always the anchor" precedent, `acid-bass/pattern.ts`). Always active. */
	strongBeat: boolean;
	/** The downbeat of every felt beat (spec's own `stepsPerBeatGroup` unit) -- a superset of `strongBeat`. */
	beatGroupStart: boolean;
	/** Every step that is not a `beatGroupStart` -- the off-beat/subdivided positions syncopation acts on. */
	weakSubdivision: boolean;
}

// Tuned so a high-`strongBeatTargeting` style (Walking 96, Rooted 95) lands
// well above a low one (Acid 75) while staying inside 0-100 either way.
const BEAT_GROUP_START_BASE = 35;
const BEAT_GROUP_START_TARGETING_WEIGHT = 0.55;
// Weak subdivisions are driven by syncopation first, density second -- a
// low-syncopation/high-density style (Walking: syncopation 12, density 52)
// must still land well below a high-syncopation style (Acid: 82, Funk: 78).
const WEAK_SUBDIVISION_SYNCOPATION_WEIGHT = 0.5;
const WEAK_SUBDIVISION_DENSITY_WEIGHT = 0.25;

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

/**
 * Phrase-role rhythmic transforms (spec §13): `main` is the untouched
 * baseline; `variation` gets a modest, uniform lift (a touch more
 * syncopated activity throughout); `fill` concentrates extra activity in
 * the second half of the bar; `turnaround` concentrates it in the bar's
 * final beat group, reserving room there for the approach motion a later
 * milestone (`chromaticism.ts`) will place into the next bar's target.
 */
function phraseRoleMultiplier(
	phraseRole: BassPhraseRole,
	stepIndex: number,
	stepsPerBar: number,
	stepsPerBeatGroup: number
): number {
	switch (phraseRole) {
		case 'main':
			return 1;
		case 'variation':
			return 1.15;
		case 'fill':
			return stepIndex >= stepsPerBar / 2 ? 1.3 : 1;
		case 'turnaround':
			return stepIndex >= stepsPerBar - stepsPerBeatGroup ? 1.25 : 1;
	}
}

/**
 * Generates one bar's rhythmic mask. `meter.stepsPerBar` is read directly --
 * never a hardcoded 16 -- so every supported simple/compound time signature
 * works identically. `density` (0-100, the user setting) scales every
 * non-anchor slot's activation chance linearly; the bar's own downbeat
 * (`strongBeat`) is always active regardless of density, so a bassline
 * never loses its own anchor even at density 0.
 */
export function generateBarRhythm(
	style: BasslineStyleProfile,
	phraseRole: BassPhraseRole,
	meter: BasslineMeterContext,
	density: number,
	random: BasslineRandom
): BassRhythmSlot[] {
	const { stepsPerBar, stepsPerBeatGroup } = meter;
	const densityScale = clampPercent(density) / 100;
	const slots: BassRhythmSlot[] = [];

	for (let stepIndex = 0; stepIndex < stepsPerBar; stepIndex++) {
		const beatGroupStart = stepIndex % stepsPerBeatGroup === 0;
		const strongBeat = stepIndex === 0;
		const weakSubdivision = !beatGroupStart;

		let active: boolean;
		if (strongBeat) {
			active = true;
		} else {
			const base = beatGroupStart
				? BEAT_GROUP_START_BASE + style.strongBeatTargeting * BEAT_GROUP_START_TARGETING_WEIGHT
				: style.syncopation * WEAK_SUBDIVISION_SYNCOPATION_WEIGHT +
					style.rhythmicDensity * WEAK_SUBDIVISION_DENSITY_WEIGHT;
			const roleMultiplier = phraseRoleMultiplier(
				phraseRole,
				stepIndex,
				stepsPerBar,
				stepsPerBeatGroup
			);
			const chance = clampPercent(base * roleMultiplier * densityScale);
			active = random.chance(chance);
		}

		slots.push({ stepIndex, active, strongBeat, beatGroupStart, weakSubdivision });
	}

	return slots;
}
