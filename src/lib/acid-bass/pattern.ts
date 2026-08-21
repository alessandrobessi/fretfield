import type { IntervalId } from '$lib/music/intervals';

import { PATTERN_ROLES, type PatternRole } from '$lib/groove/pattern-role';
import type { AcidBassPattern, AcidBassPatch, AcidBassState, AcidBassStep } from './types';

export function createEmptyAcidStep(): AcidBassStep {
	return { active: false, interval: '1', octave: 0, accent: false, slide: false };
}

function acidStep(interval: IntervalId, overrides: Partial<AcidBassStep> = {}): AcidBassStep {
	return { ...createEmptyAcidStep(), active: true, interval, ...overrides };
}

/**
 * A conservative, deterministic starting pattern (not "sacred musical
 * content" -- see AGENTS.md's Acid Bass doctrine once written): a root hit on
 * beat 1, a root echo on beat 2, a b7 passing tone on beat 2's "and", a
 * second accented root echo two beats before the end, and a 2->b3 slide into
 * the last step. Expressed in terms of `stepsPerBeatGroup` (4 for simple
 * meters, 6 for compound -- see `groove/time-signature.ts`) rather than a
 * hardcoded 16 steps, so it generalizes across every supported meter without
 * slicing a 16-step array in a musically absurd way.
 */
function buildRolePatternA(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 2) {
		pattern[stepsPerBeatGroup] = acidStep('1');
		const passingOffset = Math.floor(stepsPerBeatGroup / 2);
		if (passingOffset > 0 && passingOffset < stepsPerBeatGroup) {
			pattern[stepsPerBeatGroup + passingOffset] = acidStep('b7');
		}
	}
	if (numBeats >= 3) {
		const echoBeat = Math.max(0, numBeats - 2);
		pattern[echoBeat * stepsPerBeatGroup] = acidStep('1', { accent: true });
	}
	if (stepsPerBar >= 2) {
		pattern[stepsPerBar - 2] = acidStep('2', { slide: true });
		pattern[stepsPerBar - 1] = acidStep('b3', { accent: true });
	}
	return pattern;
}

/** A sparser variation of A -- just the root and its echo, no passing tone or ending slide. */
function buildRolePatternB(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 3) {
		const echoBeat = Math.max(0, numBeats - 2);
		pattern[echoBeat * stepsPerBeatGroup] = acidStep('5');
	}
	return pattern;
}

/** A's pattern plus one extra accented note in the final beat group, for a touch more density. */
function buildRolePatternF(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = buildRolePatternA(stepsPerBar, stepsPerBeatGroup);
	if (stepsPerBar >= stepsPerBeatGroup) {
		const fillStep = stepsPerBar - stepsPerBeatGroup;
		if (!pattern[fillStep].active) pattern[fillStep] = acidStep('5', { accent: true });
	}
	return pattern;
}

/** A descending b7->5 gesture into the final step instead of A's forward-leaning 2->b3 slide, for a turnaround's "leading back to the top" character. */
function buildRolePatternT(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 2) pattern[stepsPerBeatGroup] = acidStep('1');
	if (stepsPerBar >= 2) {
		pattern[stepsPerBar - 2] = acidStep('b7');
		pattern[stepsPerBar - 1] = acidStep('5', { accent: true });
	}
	return pattern;
}

const ROLE_BUILDERS: Record<
	PatternRole,
	(stepsPerBar: number, stepsPerBeatGroup: number) => AcidBassPattern
> = {
	A: buildRolePatternA,
	B: buildRolePatternB,
	F: buildRolePatternF,
	T: buildRolePatternT
};

export function createDefaultAcidPattern(
	stepsPerBar: number,
	stepsPerBeatGroup: number,
	role: PatternRole
): AcidBassPattern {
	return ROLE_BUILDERS[role](stepsPerBar, stepsPerBeatGroup);
}

/** Deliberately not the "Acid" preset -- a clean, round starting point (see the manual listening checklist's "Clean pulse" case) so turning Bass on for the first time doesn't immediately squeal. */
export function createDefaultAcidPatch(): AcidBassPatch {
	return { wave: 'saw', tone: 35, resonance: 20, motion: 25, decay: 35, drive: 0 };
}

export function createDefaultAcidBassState(
	stepsPerBar: number,
	stepsPerBeatGroup: number
): AcidBassState {
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = createDefaultAcidPattern(stepsPerBar, stepsPerBeatGroup, role);
	}
	return { enabled: false, patch: createDefaultAcidPatch(), patterns };
}

export function setAcidStepActive(
	pattern: AcidBassPattern,
	stepIndex: number,
	active: boolean
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, active } : step));
}

export function setAcidStepInterval(
	pattern: AcidBassPattern,
	stepIndex: number,
	interval: IntervalId
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, interval } : step));
}

export function setAcidStepOctave(
	pattern: AcidBassPattern,
	stepIndex: number,
	octave: AcidBassStep['octave']
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, octave } : step));
}

export function toggleAcidStepAccent(pattern: AcidBassPattern, stepIndex: number): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, accent: !step.accent } : step));
}

export function toggleAcidStepSlide(pattern: AcidBassPattern, stepIndex: number): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, slide: !step.slide } : step));
}

/** Same truncate/pad shape `groove/pattern.ts`'s drum `resizeSteps` uses, applied to an Acid Bass pattern -- preserves existing steps within the new length, pads a shorter-to-longer change with inactive steps. */
export function resizeAcidPattern(pattern: AcidBassPattern, length: number): AcidBassPattern {
	if (pattern.length === length) return pattern;
	if (pattern.length > length) return pattern.slice(0, length);
	const padding = Array.from({ length: length - pattern.length }, createEmptyAcidStep);
	return [...pattern, ...padding];
}

/** Resizes every role's pattern to a new meter, preserving authored content (unlike `createDefaultAcidBassState`, which discards it) -- the counterpart `groove/pattern.ts`'s own `setTimeSignature` calls for the drum patterns. */
export function resizeAcidBassState(state: AcidBassState, stepsPerBar: number): AcidBassState {
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = resizeAcidPattern(state.patterns[role], stepsPerBar);
	}
	return { ...state, patterns };
}
