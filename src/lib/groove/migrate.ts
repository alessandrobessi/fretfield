import { createEmptyGroove } from './pattern';
import {
	DRUM_VOICES,
	STEPS_PER_BAR,
	type DrumVoice,
	type Groove,
	type StepVelocity
} from './types';

/** The kit as it existed pre-Groove-Engine -- frozen here rather than reusing the current (six-voice) `DrumVoice`, since a legacy pattern was only ever recorded for these four. */
type LegacyDrumVoice = 'kick' | 'snare' | 'closedHat' | 'openHat';

/** The pre-Groove-Engine shape: one boolean pattern, no arrangement, no roles. */
interface LegacyGroovePattern {
	steps: Record<LegacyDrumVoice, boolean[]>;
	swing: number;
}

function isLegacyGroovePattern(value: unknown): value is LegacyGroovePattern {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.swing === 'number' && typeof v.steps === 'object' && v.steps !== null;
}

/** The Groove Engine's own shape before the Feel engine (M1-M6): a plain `swing` number instead of `feel`/`feelAmount`. */
interface PreFeelGroove {
	patterns: Groove['patterns'];
	arrangement: Groove['arrangement'];
	swing: number;
}

function isPreFeelGroove(value: unknown): value is PreFeelGroove {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.swing === 'number' && 'patterns' in v && 'arrangement' in v && !('feel' in v);
}

/** A bare swing number can't recover which of "Shuffle"/"Swing" the groove was originally meant to read as -- "swing" is the generic umbrella term, so migrated grooves default to it. */
function migratePreFeelGroove(groove: PreFeelGroove): Groove {
	return {
		patterns: groove.patterns,
		arrangement: groove.arrangement,
		feel: groove.swing > 0 ? 'swing' : 'straight',
		feelAmount: groove.swing,
		timeSignature: '4/4'
	};
}

/** The Groove Engine's own shape before time signatures existed: `feel`/`feelAmount` but no `timeSignature` -- every such groove was implicitly 4/4. */
interface PreTimeSignatureGroove {
	patterns: Groove['patterns'];
	arrangement: Groove['arrangement'];
	feel: Groove['feel'];
	feelAmount: number;
}

function isPreTimeSignatureGroove(value: unknown): value is PreTimeSignatureGroove {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		'patterns' in v && 'arrangement' in v && typeof v.feel === 'string' && !('timeSignature' in v)
	);
}

function migratePreTimeSignatureGroove(groove: PreTimeSignatureGroove): Groove {
	return { ...groove, timeSignature: '4/4' };
}

/**
 * `true` becomes velocity 0.7 ("normal"), `false` becomes 0 ("off") -- see
 * roadmap "Backward Compatibility". The legacy pattern becomes the new
 * model's role `A`, wrapped in a one-bar arrangement `['A']`, so an existing
 * one-bar groove keeps sounding exactly as it did before.
 */
export function migrateLegacyPattern(legacy: LegacyGroovePattern): Groove {
	const groove = createEmptyGroove();
	const patternA = groove.patterns.A;
	const legacySteps = legacy.steps as Partial<Record<DrumVoice, boolean[]>>;
	for (const voice of DRUM_VOICES) {
		// Voices added after the legacy shape was recorded (ride/rim) simply
		// have nothing to migrate -- `createEmptyGroove()` already leaves them
		// all-off, so there's nothing to overwrite here for those voices.
		const steps = legacySteps[voice];
		if (steps === undefined) continue;
		patternA.steps[voice] = Array.from({ length: STEPS_PER_BAR }, (_, i) => ({
			velocity: (steps[i] ? 0.7 : 0) as StepVelocity
		}));
	}
	return {
		...groove,
		patterns: { ...groove.patterns, A: patternA },
		arrangement: ['A'],
		feel: legacy.swing > 0 ? 'swing' : 'straight',
		feelAmount: legacy.swing,
		timeSignature: '4/4'
	};
}

/** Reads any prior shape from storage/a preset and always returns a current-model `Groove`. */
export function coerceGroove(raw: unknown): Groove {
	if (isLegacyGroovePattern(raw)) return migrateLegacyPattern(raw);
	if (isPreFeelGroove(raw)) return migratePreFeelGroove(raw);
	if (isPreTimeSignatureGroove(raw)) return migratePreTimeSignatureGroove(raw);
	return raw as Groove;
}
