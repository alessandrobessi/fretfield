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
 * Classic drum-machine swing: even-indexed (on-beat) 16th notes are never
 * delayed. Odd-indexed (offbeat, the "and" of each 8th-note pair) steps
 * slide from the straight halfway point (0% swing) toward the triplet
 * position two-thirds of the way through the 8th-note span (100% swing).
 */
export function stepOffsetMs(stepIndex: number, bpm: number, swing: number): number {
	if (stepIndex % 2 === 0) return 0;
	const stepDurationMs = 60_000 / bpm / 4; // 4 sixteenth notes per beat
	return stepDurationMs * (swing / 100) * (1 / 3);
}
