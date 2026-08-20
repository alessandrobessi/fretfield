/**
 * The drum machine's pattern data model — one bar of 16th-note steps per
 * voice, plus a global swing amount. Deliberately plain data (no functions,
 * no class instances) so a `GroovePattern` round-trips through JSON
 * unchanged for the Saved Material Library (saved-grooves.svelte.ts) the
 * same way `ChordBlock[]` does for Scale Maps.
 */

export type DrumVoice = 'kick' | 'snare' | 'closedHat' | 'openHat';

export const DRUM_VOICES: readonly DrumVoice[] = ['kick', 'snare', 'closedHat', 'openHat'];

export const STEPS_PER_BAR = 16;

export interface GroovePattern {
	steps: Record<DrumVoice, boolean[]>;
	/** 0-100: 0 is straight sixteenths, 100 is a full triplet/shuffle feel. */
	swing: number;
}

export function createEmptyGroove(): GroovePattern {
	return {
		steps: {
			kick: new Array(STEPS_PER_BAR).fill(false),
			snare: new Array(STEPS_PER_BAR).fill(false),
			closedHat: new Array(STEPS_PER_BAR).fill(false),
			openHat: new Array(STEPS_PER_BAR).fill(false)
		},
		swing: 0
	};
}

export function toggleStep(pattern: GroovePattern, voice: DrumVoice, index: number): GroovePattern {
	const steps = pattern.steps[voice].map((on, i) => (i === index ? !on : on));
	return { ...pattern, steps: { ...pattern.steps, [voice]: steps } };
}

export function setSwing(pattern: GroovePattern, swing: number): GroovePattern {
	return { ...pattern, swing: Math.min(100, Math.max(0, swing)) };
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
