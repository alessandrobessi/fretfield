import { coerceAcidBassState } from '$lib/acid-bass/migrate';
import { coerceChordPadFxState } from '$lib/chord-pad-fx/migrate';

import { createEmptyGroove } from './pattern';
import { TIME_SIGNATURES } from './time-signature';
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
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES['4/4'];
	return {
		patterns: groove.patterns,
		arrangement: groove.arrangement,
		feel: groove.swing > 0 ? 'swing' : 'straight',
		feelAmount: groove.swing,
		timeSignature: '4/4',
		acidBass: coerceAcidBassState(undefined, { stepsPerBar, stepsPerBeatGroup }),
		chordPadFx: coerceChordPadFxState(undefined)
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
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES['4/4'];
	return {
		...groove,
		timeSignature: '4/4',
		acidBass: coerceAcidBassState(undefined, { stepsPerBar, stepsPerBeatGroup }),
		chordPadFx: coerceChordPadFxState(undefined)
	};
}

/** The Groove Engine's own shape before Acid Bass existed: everything else current, but no `acidBass`. */
interface PreAcidBassGroove {
	patterns: Groove['patterns'];
	arrangement: Groove['arrangement'];
	feel: Groove['feel'];
	feelAmount: number;
	timeSignature: Groove['timeSignature'];
}

function isPreAcidBassGroove(value: unknown): value is PreAcidBassGroove {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		'patterns' in v &&
		'arrangement' in v &&
		typeof v.feel === 'string' &&
		'timeSignature' in v &&
		!('acidBass' in v)
	);
}

/**
 * An existing user's groove must sound exactly as it did before Acid Bass
 * landed -- `enabled: false` is asserted explicitly here rather than just
 * trusting `createDefaultAcidBassState`'s own default, since this is the one
 * invariant that actually matters (the default pattern itself is allowed to
 * contain active notes; it must simply not be audible until the player turns
 * Bass on for the first time).
 */
function migratePreAcidBassGroove(groove: PreAcidBassGroove): Groove {
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES[groove.timeSignature];
	return {
		...groove,
		acidBass: coerceAcidBassState(undefined, { stepsPerBar, stepsPerBeatGroup }),
		chordPadFx: coerceChordPadFxState(undefined)
	};
}

/** The Groove Engine's own shape before the Chord Pad's FX rack existed: everything else current (including `acidBass`), but no `chordPadFx`. */
interface PreChordPadFxGroove {
	patterns: Groove['patterns'];
	arrangement: Groove['arrangement'];
	feel: Groove['feel'];
	feelAmount: number;
	timeSignature: Groove['timeSignature'];
	acidBass: Groove['acidBass'];
}

function isPreChordPadFxGroove(value: unknown): value is PreChordPadFxGroove {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		'patterns' in v &&
		'arrangement' in v &&
		typeof v.feel === 'string' &&
		'timeSignature' in v &&
		'acidBass' in v &&
		!('chordPadFx' in v)
	);
}

function migratePreChordPadFxGroove(groove: PreChordPadFxGroove): Groove {
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES[groove.timeSignature];
	return {
		...groove,
		acidBass: coerceAcidBassState(groove.acidBass, { stepsPerBar, stepsPerBeatGroup }),
		chordPadFx: coerceChordPadFxState(undefined)
	};
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

/**
 * Reads any prior shape from storage/a preset and always returns a
 * current-model `Groove`. The final fallthrough case (every top-level
 * `Groove` field already present) still runs `acidBass`/`chordPadFx` through
 * their own coercion unconditionally -- a groove saved while Acid Bass
 * existed but before it was versioned has every other current field, yet
 * `acidBass` itself is still V1-shaped (no `version`), and even an already-
 * current groove's nested state is untrusted persisted data (spec §78).
 */
export function coerceGroove(raw: unknown): Groove {
	if (isLegacyGroovePattern(raw)) return migrateLegacyPattern(raw);
	if (isPreFeelGroove(raw)) return migratePreFeelGroove(raw);
	if (isPreTimeSignatureGroove(raw)) return migratePreTimeSignatureGroove(raw);
	if (isPreAcidBassGroove(raw)) return migratePreAcidBassGroove(raw);
	if (isPreChordPadFxGroove(raw)) return migratePreChordPadFxGroove(raw);

	const groove = raw as Groove;
	const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES[groove.timeSignature];
	return {
		...groove,
		acidBass: coerceAcidBassState(groove.acidBass, { stepsPerBar, stepsPerBeatGroup }),
		chordPadFx: coerceChordPadFxState(groove.chordPadFx)
	};
}
