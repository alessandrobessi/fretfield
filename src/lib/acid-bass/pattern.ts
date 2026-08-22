import type { IntervalId } from '$lib/music/intervals';

import { PATTERN_ROLES, type PatternRole } from '$lib/groove/pattern-role';
import type {
	AcidBassGenerationSettings,
	AcidBassPattern,
	AcidBassPatch,
	AcidBassState,
	AcidBassStep,
	AcidStepLocks
} from './types';

export function createEmptyAcidStep(): AcidBassStep {
	return {
		active: false,
		interval: '1',
		octave: 0,
		accent: false,
		slide: false,
		probability: 100,
		ratchet: 1,
		gate: 82,
		locks: undefined
	};
}

function acidStep(interval: IntervalId, overrides: Partial<AcidBassStep> = {}): AcidBassStep {
	return { ...createEmptyAcidStep(), active: true, interval, ...overrides };
}

/**
 * A conservative, deterministic starting pattern (not "sacred musical
 * content" -- see AGENTS.md's Acid Bass doctrine once written): a root hit on
 * beat 1, a root echo on beat 2, a b7 passing tone on beat 2's "and", a
 * second accented root echo two beats before the end, and a 2->b3 slide into
 * the last step. Expressed in terms of `stepsPerBeatGroup` (4 for simple
 * meters, 6 for compound -- see `groove/time-signature.ts`) rather than a
 * hardcoded 16 steps, so it generalizes across every supported meter without
 * slicing a 16-step array in a musically absurd way.
 */
function buildRolePatternA(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 2) {
		pattern[stepsPerBeatGroup] = acidStep('1');
		const passingOffset = Math.floor(stepsPerBeatGroup / 2);
		if (passingOffset > 0 && passingOffset < stepsPerBeatGroup) {
			pattern[stepsPerBeatGroup + passingOffset] = acidStep('b7');
		}
	}
	if (numBeats >= 3) {
		const echoBeat = Math.max(0, numBeats - 2);
		pattern[echoBeat * stepsPerBeatGroup] = acidStep('1', { accent: true });
	}
	if (stepsPerBar >= 2) {
		pattern[stepsPerBar - 2] = acidStep('2', { slide: true });
		pattern[stepsPerBar - 1] = acidStep('b3', { accent: true });
	}
	return pattern;
}

/** A sparser variation of A -- just the root and its echo, no passing tone or ending slide. */
function buildRolePatternB(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 3) {
		const echoBeat = Math.max(0, numBeats - 2);
		pattern[echoBeat * stepsPerBeatGroup] = acidStep('5');
	}
	return pattern;
}

/** A's pattern plus one extra accented note in the final beat group, for a touch more density. */
function buildRolePatternF(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = buildRolePatternA(stepsPerBar, stepsPerBeatGroup);
	if (stepsPerBar >= stepsPerBeatGroup) {
		const fillStep = stepsPerBar - stepsPerBeatGroup;
		if (!pattern[fillStep].active) pattern[fillStep] = acidStep('5', { accent: true });
	}
	return pattern;
}

/** A descending b7->5 gesture into the final step instead of A's forward-leaning 2->b3 slide, for a turnaround's "leading back to the top" character. */
function buildRolePatternT(stepsPerBar: number, stepsPerBeatGroup: number): AcidBassPattern {
	const pattern = Array.from({ length: stepsPerBar }, createEmptyAcidStep);
	const numBeats = Math.max(1, Math.floor(stepsPerBar / stepsPerBeatGroup));

	pattern[0] = acidStep('1', { accent: true });
	if (numBeats >= 2) pattern[stepsPerBeatGroup] = acidStep('1');
	if (stepsPerBar >= 2) {
		pattern[stepsPerBar - 2] = acidStep('b7');
		pattern[stepsPerBar - 1] = acidStep('5', { accent: true });
	}
	return pattern;
}

const ROLE_BUILDERS: Record<
	PatternRole,
	(stepsPerBar: number, stepsPerBeatGroup: number) => AcidBassPattern
> = {
	A: buildRolePatternA,
	B: buildRolePatternB,
	F: buildRolePatternF,
	T: buildRolePatternT
};

export function createDefaultAcidPattern(
	stepsPerBar: number,
	stepsPerBeatGroup: number,
	role: PatternRole
): AcidBassPattern {
	return ROLE_BUILDERS[role](stepsPerBar, stepsPerBeatGroup);
}

/**
 * New users default to the `acid24` filter (spec §79: "should not default to
 * the legacy filter"), but with conservative cutoff/resonance/env/accent/
 * drive values -- musical on the first note, not screaming. `legacy` exists
 * for migration compatibility, not as the new-user starting point.
 */
const DEFAULT_LFO1: AcidBassPatch['lfo1'] = {
	enabled: false,
	shape: 'sine',
	destination: 'cutoff',
	rateMode: 'free',
	rateHz: 2,
	division: '1/8',
	depth: 0
};

// Neutral/off -- Osc 2 and LFO 2 both default disabled so every existing
// factory patch and every freshly-created patch keeps sounding exactly like
// it did before these two capabilities existed.
const DEFAULT_LFO2: AcidBassPatch['lfo2'] = {
	enabled: false,
	shape: 'sine',
	destination: 'cutoff',
	rateMode: 'free',
	rateHz: 2,
	division: '1/8',
	depth: 0
};

// V4: neutral/off for every existing (pre-V4) patch and factory preset --
// none of them should gain audible modulation, a curve change, or a wet
// delay signal just by existing after this milestone.
function createNeutralAuxModulationPatch(): AcidBassPatch['modulation']['envelope'] {
	return { enabled: false, destination: 'cutoff', depth: 0 };
}

const DEFAULT_MODULATION: AcidBassPatch['modulation'] = {
	envelope: createNeutralAuxModulationPatch(),
	accent: createNeutralAuxModulationPatch(),
	random: createNeutralAuxModulationPatch()
};

// `'soft'` reproduces the existing V3 tanh-like curve exactly (spec §31) --
// the only character that may exist before Diode/Hard are implemented.
const DEFAULT_DISTORTION: AcidBassPatch['distortion'] = { character: 'soft' };

// Disabled + zero wet -- must preserve existing V3 (dry) output exactly.
const DEFAULT_DELAY: AcidBassPatch['delay'] = {
	enabled: false,
	division: '1/8D',
	feedback: 30,
	mix: 0
};

/** A fresh object every call -- these settings aren't consumed by any generator yet (that lands in a later milestone), but must never be a single shared/mutable reference in the meantime. Recommended defaults per spec §7.2. */
export function createDefaultGenerationSettings(): AcidBassGenerationSettings {
	return {
		style: 'acid',
		harmonyMode: 'chord',
		seed: 0x303303,
		density: 62,
		chromaticism: 35,
		movement: 55,
		register: 'zone',
		playability: 75,
		intelligence: 70
	};
}

export function createDefaultAcidPatch(): AcidBassPatch {
	return {
		oscillator: {
			mainWave: 'saw',
			tune: 0,
			fine: 0,
			mainLevel: 100,
			osc2Enabled: false,
			osc2Wave: 'saw',
			osc2Tune: 0,
			osc2Fine: 0,
			osc2Level: 0,
			osc2PulseWidth: 50,
			subEnabled: false,
			subOctave: -1,
			subWave: 'square',
			subLevel: 35,
			pulseWidth: 50
		},
		filter: {
			model: 'acid24',
			cutoff: 32,
			resonance: 28,
			envAmount: 30,
			keyTracking: 15,
			saturation: 8
		},
		envelope: {
			attack: 10,
			decay: 38,
			release: 30,
			accentAmount: 45
		},
		glide: {
			time: 55,
			curve: 'exponential'
		},
		lfo1: DEFAULT_LFO1,
		lfo2: DEFAULT_LFO2,
		modulation: DEFAULT_MODULATION,
		distortion: DEFAULT_DISTORTION,
		delay: DEFAULT_DELAY,
		output: {
			drive: 4,
			volume: 70
		}
	};
}

export function createDefaultAcidBassState(
	stepsPerBar: number,
	stepsPerBeatGroup: number
): AcidBassState {
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = createDefaultAcidPattern(stepsPerBar, stepsPerBeatGroup, role);
	}
	return {
		version: 4,
		enabled: false,
		mode: 'manual',
		patch: createDefaultAcidPatch(),
		patterns,
		crossBarSlide: true,
		generation: createDefaultGenerationSettings()
	};
}

export function setAcidStepActive(
	pattern: AcidBassPattern,
	stepIndex: number,
	active: boolean
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, active } : step));
}

export function setAcidStepInterval(
	pattern: AcidBassPattern,
	stepIndex: number,
	interval: IntervalId
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, interval } : step));
}

export function setAcidStepOctave(
	pattern: AcidBassPattern,
	stepIndex: number,
	octave: AcidBassStep['octave']
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, octave } : step));
}

export function toggleAcidStepAccent(pattern: AcidBassPattern, stepIndex: number): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, accent: !step.accent } : step));
}

export function toggleAcidStepSlide(pattern: AcidBassPattern, stepIndex: number): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, slide: !step.slide } : step));
}

export function setAcidStepProbability(
	pattern: AcidBassPattern,
	stepIndex: number,
	probability: number
): AcidBassPattern {
	const clamped = Math.min(100, Math.max(0, probability));
	return pattern.map((step, i) => (i === stepIndex ? { ...step, probability: clamped } : step));
}

export function setAcidStepRatchet(
	pattern: AcidBassPattern,
	stepIndex: number,
	ratchet: AcidBassStep['ratchet']
): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, ratchet } : step));
}

export function setAcidStepGate(
	pattern: AcidBassPattern,
	stepIndex: number,
	gate: number
): AcidBassPattern {
	const clamped = Math.min(100, Math.max(10, gate));
	return pattern.map((step, i) => (i === stepIndex ? { ...step, gate: clamped } : step));
}

/** Sets one lock target's value, or clears it (`value === undefined`) -- drops the whole `locks` object once every target on a step is cleared, so an untouched step never carries an empty `{}` around. */
export function setAcidStepLock(
	pattern: AcidBassPattern,
	stepIndex: number,
	target: keyof AcidStepLocks,
	value: number | undefined
): AcidBassPattern {
	return pattern.map((step, i) => {
		if (i !== stepIndex) return step;
		const nextLocks: AcidStepLocks = { ...step.locks, [target]: value };
		if (value === undefined) delete nextLocks[target];
		return { ...step, locks: Object.keys(nextLocks).length > 0 ? nextLocks : undefined };
	});
}

/** Removes every lock target from one step in one call -- the step editor's "Clear locks" affordance (spec §46), as distinct from `transforms.ts`'s pattern-wide `CLEAR LOCKS` transform. */
export function clearAcidStepLocks(pattern: AcidBassPattern, stepIndex: number): AcidBassPattern {
	return pattern.map((step, i) => (i === stepIndex ? { ...step, locks: undefined } : step));
}

/** Same truncate/pad shape `groove/pattern.ts`'s drum `resizeSteps` uses, applied to an Acid Bass pattern -- preserves existing steps within the new length, pads a shorter-to-longer change with inactive steps. */
export function resizeAcidPattern(pattern: AcidBassPattern, length: number): AcidBassPattern {
	if (pattern.length === length) return pattern;
	if (pattern.length > length) return pattern.slice(0, length);
	const padding = Array.from({ length: length - pattern.length }, createEmptyAcidStep);
	return [...pattern, ...padding];
}

/** Resizes every role's pattern to a new meter, preserving authored content (unlike `createDefaultAcidBassState`, which discards it) -- the counterpart `groove/pattern.ts`'s own `setTimeSignature` calls for the drum patterns. */
export function resizeAcidBassState(state: AcidBassState, stepsPerBar: number): AcidBassState {
	const patterns = {} as Record<PatternRole, AcidBassPattern>;
	for (const role of PATTERN_ROLES) {
		patterns[role] = resizeAcidPattern(state.patterns[role], stepsPerBar);
	}
	return { ...state, patterns };
}
