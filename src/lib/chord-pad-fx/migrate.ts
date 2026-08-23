import { createDefaultChordPadFxState } from './pattern';
import type {
	ChordPadChorusPatch,
	ChordPadDelayDivision,
	ChordPadDelayPatch,
	ChordPadFxState,
	ChordPadReverbPatch
} from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function coerceNumber(value: unknown, fallback: number, min: number, max: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

const DELAY_DIVISIONS: readonly ChordPadDelayDivision[] = [
	'1/4',
	'1/8',
	'1/8D',
	'1/8T',
	'1/16',
	'1/16D',
	'1/16T'
];

function coerceReverb(raw: unknown, defaults: ChordPadReverbPatch): ChordPadReverbPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		size: coerceNumber(v.size, defaults.size, 0, 100),
		damping: coerceNumber(v.damping, defaults.damping, 0, 100),
		mix: coerceNumber(v.mix, defaults.mix, 0, 100)
	};
}

function coerceDelay(raw: unknown, defaults: ChordPadDelayPatch): ChordPadDelayPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		division: coerceEnum(v.division, DELAY_DIVISIONS, defaults.division),
		feedback: coerceNumber(v.feedback, defaults.feedback, 0, 100),
		mix: coerceNumber(v.mix, defaults.mix, 0, 100)
	};
}

function coerceChorus(raw: unknown, defaults: ChordPadChorusPatch): ChordPadChorusPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		rate: coerceNumber(v.rate, defaults.rate, 0.1, 5),
		depth: coerceNumber(v.depth, defaults.depth, 0, 100),
		mix: coerceNumber(v.mix, defaults.mix, 0, 100)
	};
}

/**
 * Reads any prior shape from storage and always returns a current
 * `ChordPadFxState`. `version: 1` is the only shape that has ever existed --
 * no version-branch migration needed yet (unlike `acid-bass/migrate.ts`,
 * which has several) -- but every field is still defensively coerced, since
 * persisted JSON is untrusted regardless of its own claimed version.
 */
export function coerceChordPadFxState(raw: unknown): ChordPadFxState {
	const defaults = createDefaultChordPadFxState();
	const v = isRecord(raw) ? raw : {};
	return {
		version: 1,
		reverb: coerceReverb(v.reverb, defaults.reverb),
		delay: coerceDelay(v.delay, defaults.delay),
		chorus: coerceChorus(v.chorus, defaults.chorus)
	};
}
