import { createDefaultChordPadFxState } from './pattern';
import type {
	ChordPadChorusPatch,
	ChordPadDelayDivision,
	ChordPadDelayPatch,
	ChordPadFlangerPatch,
	ChordPadFxState,
	ChordPadPhaserPatch,
	ChordPadReverbPatch,
	ChordPadTremoloPatch
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

function coercePhaser(raw: unknown, defaults: ChordPadPhaserPatch): ChordPadPhaserPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		rate: coerceNumber(v.rate, defaults.rate, 0.05, 2),
		depth: coerceNumber(v.depth, defaults.depth, 0, 100),
		mix: coerceNumber(v.mix, defaults.mix, 0, 100)
	};
}

function coerceFlanger(raw: unknown, defaults: ChordPadFlangerPatch): ChordPadFlangerPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		rate: coerceNumber(v.rate, defaults.rate, 0.05, 3),
		depth: coerceNumber(v.depth, defaults.depth, 0, 100),
		feedback: coerceNumber(v.feedback, defaults.feedback, 0, 100),
		mix: coerceNumber(v.mix, defaults.mix, 0, 100)
	};
}

function coerceTremolo(raw: unknown, defaults: ChordPadTremoloPatch): ChordPadTremoloPatch {
	const v = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(v.enabled, defaults.enabled),
		rate: coerceNumber(v.rate, defaults.rate, 0.5, 10),
		depth: coerceNumber(v.depth, defaults.depth, 0, 100)
	};
}

/**
 * Reads any prior shape from storage and always returns a current
 * `ChordPadFxState`. `version: 1` (Reverb/Delay/Chorus only) migrates by
 * keeping those three exactly as persisted and defaulting `phaser`/
 * `flanger`/`tremolo` off/neutral, mirroring `acid-bass/migrate.ts`'s own
 * version-branch precedent -- everything else (current `version: 2`, or
 * missing/garbage data) runs every field through full defensive coercion,
 * since persisted JSON is untrusted regardless of its own claimed version.
 */
export function coerceChordPadFxState(raw: unknown): ChordPadFxState {
	const defaults = createDefaultChordPadFxState();
	const v = isRecord(raw) ? raw : {};
	const isV1 = v.version === 1;
	return {
		version: 2,
		reverb: coerceReverb(v.reverb, defaults.reverb),
		delay: coerceDelay(v.delay, defaults.delay),
		chorus: coerceChorus(v.chorus, defaults.chorus),
		phaser: coercePhaser(isV1 ? undefined : v.phaser, defaults.phaser),
		flanger: coerceFlanger(isV1 ? undefined : v.flanger, defaults.flanger),
		tremolo: coerceTremolo(isV1 ? undefined : v.tremolo, defaults.tremolo)
	};
}
