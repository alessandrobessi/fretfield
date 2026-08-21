import { createDefaultAcidBassState, resizeAcidBassState } from '$lib/acid-bass/pattern';

import { TIME_SIGNATURES } from './time-signature';
import {
	DRUM_VOICES,
	PATTERN_ROLES,
	STEPS_PER_BAR,
	type DrumVoice,
	type Groove,
	type GrooveFeel,
	type GroovePattern,
	type GrooveStep,
	type PatternRole,
	type StepVelocity,
	type TimeSignature
} from './types';

export function createEmptyPattern(stepsPerBar: number = STEPS_PER_BAR): GroovePattern {
	const steps = {} as Record<DrumVoice, GroovePattern['steps'][DrumVoice]>;
	for (const voice of DRUM_VOICES) {
		steps[voice] = Array.from({ length: stepsPerBar }, () => ({ velocity: 0 as StepVelocity }));
	}
	return { steps };
}

export function createEmptyGroove(timeSignature: TimeSignature = '4/4'): Groove {
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES[timeSignature];
	const patterns = {} as Record<PatternRole, GroovePattern>;
	for (const role of PATTERN_ROLES) patterns[role] = createEmptyPattern(stepsPerBar);
	return {
		patterns,
		arrangement: ['A'],
		feel: 'straight',
		feelAmount: 0,
		timeSignature,
		acidBass: createDefaultAcidBassState(stepsPerBar, stepsPerBeatGroup)
	};
}

export function setStepVelocity(
	pattern: GroovePattern,
	voice: DrumVoice,
	index: number,
	velocity: StepVelocity
): GroovePattern {
	const steps = pattern.steps[voice].map((step, i) => (i === index ? { ...step, velocity } : step));
	return { ...pattern, steps: { ...pattern.steps, [voice]: steps } };
}

const VELOCITY_CYCLE: readonly StepVelocity[] = [0, 0.35, 0.7, 1];

/** Clicking a step advances it off -> ghost -> normal -> accent -> off. */
export function cycleStepVelocity(
	pattern: GroovePattern,
	voice: DrumVoice,
	index: number
): GroovePattern {
	const current = pattern.steps[voice][index].velocity;
	const next = VELOCITY_CYCLE[(VELOCITY_CYCLE.indexOf(current) + 1) % VELOCITY_CYCLE.length];
	return setStepVelocity(pattern, voice, index, next);
}

export function setFeel(groove: Groove, feel: GrooveFeel): Groove {
	return { ...groove, feel };
}

export function setFeelAmount(groove: Groove, amount: number): Groove {
	return { ...groove, feelAmount: Math.min(100, Math.max(0, amount)) };
}

export function setPatternForRole(
	groove: Groove,
	role: PatternRole,
	pattern: GroovePattern
): Groove {
	return { ...groove, patterns: { ...groove.patterns, [role]: pattern } };
}

export function setArrangementBar(groove: Groove, barIndex: number, role: PatternRole): Groove {
	const arrangement = groove.arrangement.slice();
	arrangement[barIndex] = role;
	return { ...groove, arrangement };
}

/** Grows or shrinks the arrangement to exactly `length` bars, clamped to at least 1 -- new bars default to role `A`, extra bars are truncated from the end. */
export function setArrangementLength(groove: Groove, length: number): Groove {
	const clamped = Math.max(1, Math.round(length));
	const arrangement = Array.from({ length: clamped }, (_, i) => groove.arrangement[i] ?? 'A');
	return { ...groove, arrangement };
}

/** Same truncate/pad shape `setArrangementLength` uses for bars, applied here to one voice's step array instead. */
function resizeSteps(steps: GrooveStep[], length: number): GrooveStep[] {
	if (steps.length === length) return steps;
	if (steps.length > length) return steps.slice(0, length);
	const padding = Array.from({ length: length - steps.length }, () => ({
		velocity: 0 as StepVelocity
	}));
	return [...steps, ...padding];
}

/**
 * Switches the whole groove to a new meter, resizing every pattern's every
 * voice to the new step count -- steps beyond the new length are dropped,
 * a shorter-to-longer change pads with off-steps. One meter for the whole
 * groove, not per-bar (see AGENTS.md).
 */
export function setTimeSignature(groove: Groove, timeSignature: TimeSignature): Groove {
	const stepsPerBar = TIME_SIGNATURES[timeSignature].stepsPerBar;
	const patterns = {} as Record<PatternRole, GroovePattern>;
	for (const role of PATTERN_ROLES) {
		const steps = {} as Record<DrumVoice, GrooveStep[]>;
		for (const voice of DRUM_VOICES) {
			steps[voice] = resizeSteps(groove.patterns[role].steps[voice], stepsPerBar);
		}
		patterns[role] = { steps };
	}
	return {
		...groove,
		patterns,
		timeSignature,
		acidBass: resizeAcidBassState(groove.acidBass, stepsPerBar)
	};
}

/**
 * Swing operates at 8th-note resolution, not 16th -- it delays the "and" of
 * each beat (the step at the midpoint of every `stepsPerBeatGroup`-step
 * beat group), sliding it from the straight halfway point (0% swing)
 * toward the triplet position two-thirds of the way through the beat (100%
 * swing). This is the classic blues-shuffle/jazz-swing feel; genre patterns
 * that want a straight 16th-note character (e.g. funk) just use 0 swing
 * rather than a second swing resolution.
 *
 * Only meaningful for simple meters (`stepsPerBeatGroup === 4`) -- compound
 * meters (6-step beat groups) already carry their own triplet-like
 * 3-against-2 feel, so swing is inert on top of that (see AGENTS.md).
 * `stepsPerBeatGroup` defaults to 4 so existing 4/4 call sites are
 * unaffected.
 */
export function stepOffsetMs(
	stepIndex: number,
	bpm: number,
	swing: number,
	stepsPerBeatGroup: number = 4
): number {
	if (stepsPerBeatGroup !== 4) return 0;
	if (stepIndex % stepsPerBeatGroup !== 2) return 0;
	const beatDurationMs = 60_000 / bpm;
	return beatDurationMs * (1 / 6) * (swing / 100);
}
