import {
	DRUM_VOICES,
	PATTERN_ROLES,
	STEPS_PER_BAR,
	type DrumVoice,
	type Groove,
	type GroovePattern,
	type PatternRole,
	type StepVelocity
} from './types';

export function createEmptyPattern(): GroovePattern {
	const steps = {} as Record<DrumVoice, GroovePattern['steps'][DrumVoice]>;
	for (const voice of DRUM_VOICES) {
		steps[voice] = Array.from({ length: STEPS_PER_BAR }, () => ({ velocity: 0 as StepVelocity }));
	}
	return { steps };
}

export function createEmptyGroove(): Groove {
	const patterns = {} as Record<PatternRole, GroovePattern>;
	for (const role of PATTERN_ROLES) patterns[role] = createEmptyPattern();
	return { patterns, arrangement: ['A'], swing: 0 };
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

/** A plain on/off toggle (0 <-> 0.7) -- becomes a full off/ghost/normal/accent cycle once the expressive-step UI lands. */
export function toggleStep(pattern: GroovePattern, voice: DrumVoice, index: number): GroovePattern {
	const current = pattern.steps[voice][index].velocity;
	return setStepVelocity(pattern, voice, index, current === 0 ? 0.7 : 0);
}

export function setSwing(groove: Groove, swing: number): Groove {
	return { ...groove, swing: Math.min(100, Math.max(0, swing)) };
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

/**
 * Swing operates at 8th-note resolution, not 16th -- it delays the "and" of
 * each beat (step index 2 within every 4-step quarter-note group: absolute
 * steps 2, 6, 10, 14), sliding it from the straight halfway point (0% swing)
 * toward the triplet position two-thirds of the way through the beat (100%
 * swing). This is the classic blues-shuffle/jazz-swing feel; genre patterns
 * that want a straight 16th-note character (e.g. funk) just use 0 swing
 * rather than a second swing resolution.
 */
export function stepOffsetMs(stepIndex: number, bpm: number, swing: number): number {
	if (stepIndex % 4 !== 2) return 0;
	const beatDurationMs = 60_000 / bpm;
	return beatDurationMs * (1 / 6) * (swing / 100);
}
