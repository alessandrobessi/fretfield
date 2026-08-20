import type { GrooveStep } from './types';

/**
 * Whether `step` sounds at the given global Intensity level -- a step that's
 * off never sounds regardless of intensity, and a step with no authored
 * `minIntensity` always sounds once it's on (matches every step written
 * before the Intensity engine existed). Lets a single authored groove get
 * progressively denser as intensity rises, per AGENTS.md, instead of
 * needing a separate preset per density level.
 */
export function stepShouldSound(step: GrooveStep, intensity: number): boolean {
	return step.velocity > 0 && (step.minIntensity ?? 0) <= intensity;
}
