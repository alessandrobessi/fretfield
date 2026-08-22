/**
 * Acid Bass's own migration/coercion layer (~/Downloads/ACID-BASS-ENGINE-V2.md
 * §77): `groove/migrate.ts` delegates all `acidBass`-shape handling here
 * instead of growing further inline, the same way this domain's own
 * `pattern.ts`/`resolve.ts` already own their own concerns. Four jobs, kept
 * clearly separate below: migrating a genuinely V1-shaped patch/pattern
 * (spec §71-76), migrating a V2-shaped one (singular `patch.lfo`, no Osc 2),
 * and validating/clamping data that already claims to be V3-or-current
 * (V4) shape but came from localStorage -- untrusted input either way (spec
 * §78; V3's own shape is a strict subset of V4's -- pure additions, no
 * restructuring -- so both share the identical trusted-coercion path, see
 * `coerceAcidBassState`).
 */

import { ALL_INTERVALS, type IntervalId } from '$lib/music/intervals';

import { PATTERN_ROLES, type PatternRole } from '$lib/groove/pattern-role';
import {
	createDefaultAcidBassState,
	createDefaultAcidPatch,
	createDefaultGenerationSettings,
	createEmptyAcidStep,
	resizeAcidPattern
} from './pattern';
import {
	v1AccentToV2Value,
	v1AttackSecondsToV2Value,
	v1MasterGainToV2Value,
	v1ReleaseSecondsToV2Value,
	v1SlideSecondsToV2Value
} from './resolve';
import type {
	AcidAuxModulationPatch,
	AcidBassGenerationSettings,
	AcidBassMode,
	AcidBassPattern,
	AcidBassPatch,
	AcidBassState,
	AcidBassStep,
	AcidDelayDivision,
	AcidDistortionCharacter,
	AcidFilterModel,
	AcidGlideCurve,
	AcidLfoDestination,
	AcidLfoDivision,
	AcidLfoRateMode,
	AcidLfoShape,
	AcidModulationDestination,
	AcidOctaveOffset,
	AcidStepLocks,
	AcidSubOctave,
	AcidSubWave,
	AcidWave,
	BassHarmonyMode,
	BasslineStyleId,
	BassRegisterMode
} from './types';

interface Meter {
	stepsPerBar: number;
	stepsPerBeatGroup: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// V1 -> V2
// ---------------------------------------------------------------------------

// V1's own fixed constants -- the exact values `acid-bass-voice.ts` used to
// hardcode before V2 existed. Migrated deliberately via the named inverse
// helpers in `resolve.ts` (spec §74), never inline magic numbers.
const V1_ATTACK_SECONDS = 0.006;
const V1_RELEASE_SECONDS = 0.05;
const V1_SLIDE_SECONDS = 0.08;
const V1_ACCENT_VCA_BOOST = 1.28;
const V1_MASTER_GAIN = 0.7;

interface V1AcidBassPatch {
	wave: 'saw' | 'square';
	tone: number;
	resonance: number;
	motion: number;
	decay: number;
	drive: number;
}

interface V1AcidBassStep {
	active: boolean;
	interval: IntervalId;
	octave: -1 | 0 | 1;
	accent: boolean;
	slide: boolean;
}

type V1AcidBassPattern = V1AcidBassStep[];

interface V1AcidBassState {
	enabled: boolean;
	patch: V1AcidBassPatch;
	patterns: Record<PatternRole, V1AcidBassPattern>;
}

/** V1 `acidBass` has no `version` field at all -- the one thing that reliably distinguishes it from current (V2) state, which always stamps `version: 2`. */
function isV1AcidBassState(value: unknown): value is V1AcidBassState {
	if (!isRecord(value)) return false;
	return 'patch' in value && 'patterns' in value && !('version' in value);
}

function migrateV1Step(raw: unknown): AcidBassStep {
	const empty = createEmptyAcidStep();
	if (!isRecord(raw)) return empty;
	return {
		active: typeof raw.active === 'boolean' ? raw.active : empty.active,
		interval: (ALL_INTERVALS as readonly string[]).includes(raw.interval as string)
			? (raw.interval as IntervalId)
			: empty.interval,
		octave: ([-1, 0, 1] as const).includes(raw.octave as AcidOctaveOffset)
			? (raw.octave as AcidOctaveOffset)
			: empty.octave,
		accent: typeof raw.accent === 'boolean' ? raw.accent : empty.accent,
		slide: typeof raw.slide === 'boolean' ? raw.slide : empty.slide,
		// Spec §75: a migrated step always gets the neutral/compatible values
		// for every new sequencer field -- V1 never had these at all.
		probability: 100,
		ratchet: 1,
		gate: 82,
		locks: undefined
	};
}

function migrateV1Pattern(raw: unknown, stepsPerBar: number): AcidBassPattern {
	const steps = Array.isArray(raw) ? raw.map(migrateV1Step) : [];
	return resizeAcidPattern(steps, stepsPerBar);
}

function migrateV1Patch(raw: unknown): AcidBassPatch {
	const p = isRecord(raw) ? raw : {};
	const wave: AcidWave = p.wave === 'square' ? 'square' : 'saw';
	const tone = typeof p.tone === 'number' ? p.tone : 35;
	const resonance = typeof p.resonance === 'number' ? p.resonance : 20;
	const motion = typeof p.motion === 'number' ? p.motion : 25;
	const decay = typeof p.decay === 'number' ? p.decay : 35;
	const drive = typeof p.drive === 'number' ? p.drive : 0;

	const neutral = createDefaultAcidPatch();

	return {
		oscillator: {
			mainWave: wave,
			tune: 0,
			fine: 0,
			mainLevel: 100,
			osc2Enabled: neutral.oscillator.osc2Enabled,
			osc2Wave: neutral.oscillator.osc2Wave,
			osc2Tune: neutral.oscillator.osc2Tune,
			osc2Fine: neutral.oscillator.osc2Fine,
			osc2Level: neutral.oscillator.osc2Level,
			osc2PulseWidth: neutral.oscillator.osc2PulseWidth,
			subEnabled: false,
			subOctave: -1,
			subWave: 'square',
			subLevel: 35,
			pulseWidth: 50
		},
		filter: {
			// `legacy`, not `acid24` -- this is the whole point of the
			// migration: an existing groove must sound exactly as it did.
			model: 'legacy',
			cutoff: tone,
			resonance,
			// V1's Motion was unipolar 0-100 and always opened the filter --
			// maps directly onto the positive half of the new bipolar range
			// (spec §19: "Migration from V1 always maps Motion into positive
			// Env Mod").
			envAmount: motion,
			keyTracking: 0,
			saturation: 0
		},
		envelope: {
			attack: v1AttackSecondsToV2Value(V1_ATTACK_SECONDS),
			decay,
			release: v1ReleaseSecondsToV2Value(V1_RELEASE_SECONDS),
			accentAmount: v1AccentToV2Value(V1_ACCENT_VCA_BOOST)
		},
		glide: {
			time: v1SlideSecondsToV2Value(V1_SLIDE_SECONDS),
			// V1's slide was always a plain linearRampToValueAtTime.
			curve: 'linear'
		},
		lfo1: {
			enabled: false,
			shape: 'sine',
			destination: 'cutoff',
			rateMode: 'free',
			rateHz: 2,
			division: '1/8',
			depth: 0
		},
		lfo2: neutral.lfo2,
		modulation: neutral.modulation,
		distortion: neutral.distortion,
		delay: neutral.delay,
		output: {
			drive,
			volume: v1MasterGainToV2Value(V1_MASTER_GAIN)
		}
	};
}

function migrateV1State(state: V1AcidBassState, meter: Meter): AcidBassState {
	const rawPatterns: Record<string, unknown> = isRecord(state.patterns) ? state.patterns : {};
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = migrateV1Pattern(rawPatterns[role], meter.stepsPerBar);
	}
	return {
		version: 4,
		enabled: state.enabled === true,
		// V1 never had a mode/generation concept -- a migrated groove always
		// lands in 'manual', never silently starts generating (spec §37).
		mode: 'manual',
		patch: migrateV1Patch(state.patch),
		patterns,
		// A migrated groove must not gain new end-of-bar articulation it
		// wasn't authored with (spec §76's preferred policy).
		crossBarSlide: false,
		generation: createDefaultGenerationSettings()
	};
}

// ---------------------------------------------------------------------------
// V2 -> V4 (singular `patch.lfo` -> `lfo1`/`lfo2`, Osc 2 added, plus every
// V4 addition below)
// ---------------------------------------------------------------------------

/**
 * V2's own shape is a strict subset of V4's -- oscillator (minus `osc2*`),
 * filter, envelope, glide, and output all coerce identically, so this
 * re-keys the one field that actually changed shape (`lfo` -> `lfo1`) and
 * hands off to `coercePatch` (defined below) rather than duplicating every
 * other field's own defaulting/clamping logic. `osc2*`/`lfo2`/`modulation`/
 * `distortion`/`delay`, simply absent from a V2 record, come back as their
 * safe neutral/off defaults for free.
 */
function migrateV2Patch(raw: unknown): AcidBassPatch {
	const record = isRecord(raw) ? raw : {};
	return coercePatch({ ...record, lfo1: record.lfo, lfo2: undefined });
}

function migrateV2State(raw: Record<string, unknown>, meter: Meter): AcidBassState {
	return {
		version: 4,
		enabled: coerceBoolean(raw.enabled, false),
		// V2 never had a mode/generation concept either -- same "always
		// manual" rule as V1 (spec §37).
		mode: 'manual',
		patch: migrateV2Patch(raw.patch),
		patterns: coercePatterns(raw.patterns, meter.stepsPerBar),
		// Unlike V1->V4 (forced false, since V1 never had this concept at
		// all), V2 already modeled cross-bar slide correctly -- preserve
		// whatever the groove already had.
		crossBarSlide: coerceBoolean(raw.crossBarSlide, true),
		generation: createDefaultGenerationSettings()
	};
}

// ---------------------------------------------------------------------------
// V3/V4 validation/coercion (persisted data is untrusted input, spec §78)
// ---------------------------------------------------------------------------

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

function coerceNumericEnum<T extends number>(
	value: unknown,
	allowed: readonly T[],
	fallback: T
): T {
	return typeof value === 'number' && (allowed as readonly number[]).includes(value)
		? (value as T)
		: fallback;
}

const MAIN_WAVES: readonly AcidWave[] = ['saw', 'square', 'triangle', 'pulse'];
const SUB_WAVES: readonly AcidSubWave[] = ['square', 'triangle'];
const SUB_OCTAVES: readonly AcidSubOctave[] = [-1, -2];
const FILTER_MODELS: readonly AcidFilterModel[] = ['legacy', 'svf12', 'acid24'];
const GLIDE_CURVES: readonly AcidGlideCurve[] = ['linear', 'exponential'];
const LFO_SHAPES: readonly AcidLfoShape[] = ['sine', 'triangle', 'square', 'sampleHold'];
const LFO_DESTINATIONS: readonly AcidLfoDestination[] = [
	'cutoff',
	'pitch',
	'pulseWidth',
	'subLevel',
	'osc2Level'
];
const LFO_RATE_MODES: readonly AcidLfoRateMode[] = ['free', 'sync'];
const LFO_DIVISIONS: readonly AcidLfoDivision[] = [
	'1/1',
	'1/2',
	'1/4',
	'1/8',
	'1/8T',
	'1/16',
	'1/16T',
	'1/32'
];
const OCTAVE_OFFSETS: readonly AcidOctaveOffset[] = [-1, 0, 1];
const RATCHETS: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
const LOCK_TARGETS = ['cutoff', 'resonance', 'envAmount', 'drive', 'lfoDepth'] as const;

// V4
const ACID_BASS_MODES: readonly AcidBassMode[] = ['manual', 'generated'];
const DISTORTION_CHARACTERS: readonly AcidDistortionCharacter[] = ['soft', 'diode', 'hard'];
const MODULATION_DESTINATIONS: readonly AcidModulationDestination[] = [
	'cutoff',
	'resonance',
	'pitch',
	'pulseWidth',
	'subLevel',
	'osc2Level',
	'drive'
];
const DELAY_DIVISIONS: readonly AcidDelayDivision[] = [
	'1/4',
	'1/8',
	'1/8D',
	'1/8T',
	'1/16',
	'1/16D',
	'1/16T'
];
const BASSLINE_STYLES: readonly BasslineStyleId[] = [
	'rooted',
	'funk',
	'acid',
	'chromatic',
	'melodic',
	'walking'
];
const BASS_HARMONY_MODES: readonly BassHarmonyMode[] = ['chord', 'key', 'voice-leading'];
const BASS_REGISTER_MODES: readonly BassRegisterMode[] = ['low', 'mid', 'high', 'zone'];

function coerceLfo(raw: unknown, defaults: AcidBassPatch['lfo1']): AcidBassPatch['lfo1'] {
	const lfo = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(lfo.enabled, defaults.enabled),
		shape: coerceEnum(lfo.shape, LFO_SHAPES, defaults.shape),
		destination: coerceEnum(lfo.destination, LFO_DESTINATIONS, defaults.destination),
		rateMode: coerceEnum(lfo.rateMode, LFO_RATE_MODES, defaults.rateMode),
		rateHz: coerceNumber(lfo.rateHz, defaults.rateHz, 0.05, 20),
		division: coerceEnum(lfo.division, LFO_DIVISIONS, defaults.division),
		depth: coerceNumber(lfo.depth, defaults.depth, 0, 100)
	};
}

function coerceAuxModulation(
	raw: unknown,
	defaults: AcidAuxModulationPatch
): AcidAuxModulationPatch {
	const mod = isRecord(raw) ? raw : {};
	return {
		enabled: coerceBoolean(mod.enabled, defaults.enabled),
		destination: coerceEnum(mod.destination, MODULATION_DESTINATIONS, defaults.destination),
		depth: coerceNumber(mod.depth, defaults.depth, -100, 100)
	};
}

/** Unsigned 32-bit, per spec §10/§37 -- `>>> 0` is the standard JS coercion-to-uint32 trick. Local to this file for now; a canonical copy may move to `music/bassline/random.ts` once that module exists (a later milestone), without needing to delete this one. */
function coerceSeed(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return value >>> 0;
}

function coerceGenerationSettings(raw: unknown): AcidBassGenerationSettings {
	const defaults = createDefaultGenerationSettings();
	const g = isRecord(raw) ? raw : {};
	return {
		style: coerceEnum(g.style, BASSLINE_STYLES, defaults.style),
		harmonyMode: coerceEnum(g.harmonyMode, BASS_HARMONY_MODES, defaults.harmonyMode),
		seed: coerceSeed(g.seed, defaults.seed),
		density: coerceNumber(g.density, defaults.density, 0, 100),
		chromaticism: coerceNumber(g.chromaticism, defaults.chromaticism, 0, 100),
		movement: coerceNumber(g.movement, defaults.movement, 0, 100),
		register: coerceEnum(g.register, BASS_REGISTER_MODES, defaults.register),
		playability: coerceNumber(g.playability, defaults.playability, 0, 100),
		intelligence: coerceNumber(g.intelligence, defaults.intelligence, 0, 100)
	};
}

function coercePatch(raw: unknown): AcidBassPatch {
	const defaults = createDefaultAcidPatch();
	if (!isRecord(raw)) return defaults;
	const osc = isRecord(raw.oscillator) ? raw.oscillator : {};
	const filt = isRecord(raw.filter) ? raw.filter : {};
	const env = isRecord(raw.envelope) ? raw.envelope : {};
	const glide = isRecord(raw.glide) ? raw.glide : {};
	const mod = isRecord(raw.modulation) ? raw.modulation : {};
	const dist = isRecord(raw.distortion) ? raw.distortion : {};
	const delay = isRecord(raw.delay) ? raw.delay : {};
	const output = isRecord(raw.output) ? raw.output : {};

	return {
		oscillator: {
			mainWave: coerceEnum(osc.mainWave, MAIN_WAVES, defaults.oscillator.mainWave),
			tune: coerceNumber(osc.tune, defaults.oscillator.tune, -12, 12),
			fine: coerceNumber(osc.fine, defaults.oscillator.fine, -50, 50),
			mainLevel: coerceNumber(osc.mainLevel, defaults.oscillator.mainLevel, 0, 100),
			osc2Enabled: coerceBoolean(osc.osc2Enabled, defaults.oscillator.osc2Enabled),
			osc2Wave: coerceEnum(osc.osc2Wave, MAIN_WAVES, defaults.oscillator.osc2Wave),
			osc2Tune: coerceNumber(osc.osc2Tune, defaults.oscillator.osc2Tune, -12, 12),
			osc2Fine: coerceNumber(osc.osc2Fine, defaults.oscillator.osc2Fine, -50, 50),
			osc2Level: coerceNumber(osc.osc2Level, defaults.oscillator.osc2Level, 0, 100),
			osc2PulseWidth: coerceNumber(osc.osc2PulseWidth, defaults.oscillator.osc2PulseWidth, 5, 95),
			subEnabled: coerceBoolean(osc.subEnabled, defaults.oscillator.subEnabled),
			subOctave: coerceNumericEnum(osc.subOctave, SUB_OCTAVES, defaults.oscillator.subOctave),
			subWave: coerceEnum(osc.subWave, SUB_WAVES, defaults.oscillator.subWave),
			subLevel: coerceNumber(osc.subLevel, defaults.oscillator.subLevel, 0, 100),
			pulseWidth: coerceNumber(osc.pulseWidth, defaults.oscillator.pulseWidth, 5, 95)
		},
		filter: {
			model: coerceEnum(filt.model, FILTER_MODELS, defaults.filter.model),
			cutoff: coerceNumber(filt.cutoff, defaults.filter.cutoff, 0, 100),
			resonance: coerceNumber(filt.resonance, defaults.filter.resonance, 0, 100),
			envAmount: coerceNumber(filt.envAmount, defaults.filter.envAmount, -100, 100),
			keyTracking: coerceNumber(filt.keyTracking, defaults.filter.keyTracking, 0, 100),
			saturation: coerceNumber(filt.saturation, defaults.filter.saturation, 0, 100)
		},
		envelope: {
			attack: coerceNumber(env.attack, defaults.envelope.attack, 0, 100),
			decay: coerceNumber(env.decay, defaults.envelope.decay, 0, 100),
			release: coerceNumber(env.release, defaults.envelope.release, 0, 100),
			accentAmount: coerceNumber(env.accentAmount, defaults.envelope.accentAmount, 0, 100)
		},
		glide: {
			time: coerceNumber(glide.time, defaults.glide.time, 0, 100),
			curve: coerceEnum(glide.curve, GLIDE_CURVES, defaults.glide.curve)
		},
		lfo1: coerceLfo(raw.lfo1, defaults.lfo1),
		lfo2: coerceLfo(raw.lfo2, defaults.lfo2),
		modulation: {
			envelope: coerceAuxModulation(mod.envelope, defaults.modulation.envelope),
			accent: coerceAuxModulation(mod.accent, defaults.modulation.accent),
			random: coerceAuxModulation(mod.random, defaults.modulation.random)
		},
		distortion: {
			character: coerceEnum(dist.character, DISTORTION_CHARACTERS, defaults.distortion.character)
		},
		delay: {
			enabled: coerceBoolean(delay.enabled, defaults.delay.enabled),
			division: coerceEnum(delay.division, DELAY_DIVISIONS, defaults.delay.division),
			feedback: coerceNumber(delay.feedback, defaults.delay.feedback, 0, 100),
			mix: coerceNumber(delay.mix, defaults.delay.mix, 0, 100)
		},
		output: {
			drive: coerceNumber(output.drive, defaults.output.drive, 0, 100),
			volume: coerceNumber(output.volume, defaults.output.volume, 0, 100)
		}
	};
}

function coerceLocks(raw: unknown): AcidStepLocks | undefined {
	if (!isRecord(raw)) return undefined;
	const locks: AcidStepLocks = {};
	for (const target of LOCK_TARGETS) {
		const value = raw[target];
		if (typeof value !== 'number' || !Number.isFinite(value)) continue;
		locks[target] = target === 'envAmount' ? clamp(value, -100, 100) : clamp(value, 0, 100);
	}
	return Object.keys(locks).length > 0 ? locks : undefined;
}

function coerceStep(raw: unknown): AcidBassStep {
	const empty = createEmptyAcidStep();
	if (!isRecord(raw)) return empty;
	return {
		active: coerceBoolean(raw.active, empty.active),
		interval: coerceEnum(raw.interval, ALL_INTERVALS, empty.interval),
		octave: coerceNumericEnum(raw.octave, OCTAVE_OFFSETS, empty.octave),
		accent: coerceBoolean(raw.accent, empty.accent),
		slide: coerceBoolean(raw.slide, empty.slide),
		probability: coerceNumber(raw.probability, empty.probability, 0, 100),
		ratchet: coerceNumericEnum(raw.ratchet, RATCHETS, empty.ratchet),
		gate: coerceNumber(raw.gate, empty.gate, 10, 100),
		locks: coerceLocks(raw.locks)
	};
}

function coercePattern(raw: unknown, stepsPerBar: number): AcidBassPattern {
	const steps = Array.isArray(raw) ? raw.map(coerceStep) : [];
	return resizeAcidPattern(steps, stepsPerBar);
}

function coercePatterns(raw: unknown, stepsPerBar: number): Record<PatternRole, AcidBassPattern> {
	const r = isRecord(raw) ? raw : {};
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = coercePattern(r[role], stepsPerBar);
	}
	return patterns;
}

/**
 * Reads whatever's persisted for `Groove.acidBass` and always returns a
 * valid, current-shape `AcidBassState` -- the Acid Bass equivalent of
 * `groove/migrate.ts`'s `coerceGroove`. Four cases: genuinely V1-shaped (no
 * `version` field at all) -> migrated via the `v1*ToV2Value` helpers, with
 * `crossBarSlide` forced off (spec §76) and `mode` forced to `'manual'`
 * (spec §37); `version: 2` (singular `patch.lfo`, no Osc 2) -> migrated via
 * `migrateV2Patch`/`State`, `mode` likewise forced to `'manual'`;
 * `version: 3` or `version: 4` -> validated and clamped field-by-field
 * rather than trusted outright (persisted browser state is untrusted input,
 * spec §78) -- V3's own shape is a strict subset of V4's (pure additions:
 * `mode`/`generation`/`patch.modulation`/`patch.distortion`/`patch.delay`,
 * no restructuring), so both versions share this one coercion path, and a
 * genuine V3 record's *real* `mode`/`generation` (neither of which it has)
 * correctly comes back as the safe `'manual'`/neutral defaults; anything
 * else (a pre-Acid-Bass groove with no `acidBass` at all, or unrecognizable
 * garbage) -> a fresh default state.
 */
export function coerceAcidBassState(raw: unknown, meter: Meter): AcidBassState {
	if (isV1AcidBassState(raw)) return migrateV1State(raw, meter);

	if (isRecord(raw) && raw.version === 2) return migrateV2State(raw, meter);

	if (isRecord(raw) && (raw.version === 3 || raw.version === 4)) {
		return {
			version: 4,
			enabled: coerceBoolean(raw.enabled, false),
			mode: coerceEnum(raw.mode, ACID_BASS_MODES, 'manual'),
			patch: coercePatch(raw.patch),
			patterns: coercePatterns(raw.patterns, meter.stepsPerBar),
			crossBarSlide: coerceBoolean(raw.crossBarSlide, true),
			generation: coerceGenerationSettings(raw.generation)
		};
	}

	return createDefaultAcidBassState(meter.stepsPerBar, meter.stepsPerBeatGroup);
}
