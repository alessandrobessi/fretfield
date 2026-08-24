/**
 * Scale Practice's Acid Bass voice — a monophonic synth bass living
 * alongside `drum-voices.ts`/`chord-voices.ts` in the Groove Engine's
 * output. Unlike those two (a fresh node graph built per hit/chord, fire and
 * forget), this voice is deliberately persistent: one oscillator section, one
 * filter, one amplitude envelope, built once and reused for every note, so
 * slides can glide the oscillator's own frequency instead of crossfading
 * between two discrete notes. Must not know about chords, progressions,
 * scales, interval labels, fret positions, `PatternRole` semantics, or
 * Svelte stores — it receives plain frequencies, timing, and accent/slide
 * booleans; harmonic resolution happens in `scale-practice.svelte.ts` before
 * calling in, the same boundary `chord-voices.ts`'s `triggerChordPad` keeps.
 *
 * V2 (~/Downloads/ACID-BASS-ENGINE-V2.md): main oscillator now supports all
 * four `AcidWave`s (saw/square/triangle native, Pulse via a regenerated
 * `PeriodicWave`), plus a sub oscillator (square/triangle, -1/-2 octaves)
 * mixed in via `mixCompensation` so driving both hard never doubles the
 * output unpredictably. Tune/fine apply as one frequency ratio
 * (`tuneFineToRatio`) to every oscillator, main and sub alike. The filter
 * section adds key tracking (cutoff follows note pitch, via the same
 * already-tested `keyTrackingMultiplier` MIDI math the rest of the codebase
 * uses -- the voice converts its own Hz back to a floating MIDI note via
 * `frequencyToMidi` rather than duplicating that math) and pre-filter
 * saturation (a second, independent drive stage feeding the filter, distinct
 * from the post-filter output Drive). `legacy`/`svf12` both stay on the
 * Biquad path (see `resonanceToModelParameter` in `resolve.ts`); `acid24`
 * routes to a dedicated `AudioWorkletNode` (M10, `acid-worklet-node.ts`) once
 * it finishes loading -- both paths run in parallel the whole time (the same
 * "always connected, crossfade the inactive one to zero" idiom this file
 * uses everywhere else), so switching models or the worklet finishing its
 * async load never audibly glitches. If the worklet never loads (unsupported
 * browser, asset fetch failure -- logged to the console only, never a
 * user-facing error), `acid24` silently keeps sounding like the `svf12`
 * approximation instead.
 *
 * Pulse/PWM (M11): the same worklet-or-fallback pattern applies to the
 * Pulse wave -- a dedicated `AudioWorkletNode` (`acid-pulse-oscillator-
 * processor.js`) generates a genuinely live, sample-accurate,
 * PolyBLEP-band-limited pulse with an a-rate `pulseWidth` AudioParam, and
 * crossfades in (via `applyPulseOscillatorRouting`) once it loads; until
 * then (or forever, if it never does) Pulse keeps using the static
 * `PeriodicWave` regenerated on `setPatch()`. "LFO -> Pulse Width" is only
 * ever connected to the worklet's own AudioParam, so it stays a genuine
 * no-op against the `PeriodicWave` fallback -- there's nothing live to
 * modulate there.
 *
 * Sequencer powers (M5): Gate is now per-trigger (`gatePercent`, replacing
 * the old fixed 82% constant) and parameter locks (`locks`) can override
 * cutoff/resonance/envAmount/drive for one trigger only, reverting
 * automatically afterward. Ratchet and probability are resolved entirely in
 * `scale-practice.svelte.ts` before this file ever sees a trigger -- each
 * ratchet hit just arrives as its own ordinary `schedule()` call with a
 * shorter `stepDurationSeconds`, so this file stays unaware ratchets exist
 * at all (see the file's own "must not know about `PatternRole` semantics"
 * doctrine above).
 *
 * Modulation (M7): two independent, free-running LFOs (`lfo1`/`lfo2`, both
 * `acid-bass-lfo.ts` instances), each routed to whichever single destination
 * its own patch slot names (Cutoff/Pitch/Sub Level/Osc 2 Level/Pulse Width --
 * the last only live once the M11 Pulse worklet has loaded, see above) via
 * its own parallel bank of depth-scaling gain nodes, the same "always
 * connected, gain the inactive ones to zero" idiom as everything else here.
 * Still not a many-to-many modulation matrix -- each LFO targets exactly one
 * destination. Sync-mode rate depends on the transport's current BPM, which
 * this file otherwise never touches -- `setTempo()` is the one deliberate
 * exception, called by `scale-practice.svelte.ts` whenever tempo changes, so
 * a live tempo edit re-syncs both LFOs without needing a full `setPatch()`.
 * `lfoDepth` locks apply the same "override this trigger only, then revert"
 * treatment `locks.drive` already gets -- to LFO 1 only, never LFO 2 (see
 * `AcidStepLocks`'s own doc comment).
 *
 * A second full oscillator (M13-ish, no spec doc -- a direct follow-up
 * request): Osc 2 sits alongside Main and Sub, with its own wave (any
 * `AcidWave`, including Pulse) and its own independent tune/fine (not
 * Main's), which is what makes it useful for detune/unison stacking.
 * Implemented as a single type-switched `OscillatorNode`, the same
 * simplification Sub already uses, not a 4-way crossfaded bank like Main --
 * a wave change here is an infrequent patch edit. `mixCompensation` now
 * budgets all three oscillators' energy together.
 *
 * Auxiliary modulation (M15, Acid Bass Intelligence V4 §33): three more
 * single-destination sources -- Envelope, Accent, Random -- alongside
 * lfo1/lfo2 (still five total, still never a many-to-many matrix). Unlike
 * the LFOs (continuous, free-running oscillators), all three are inherently
 * per-trigger phenomena, so each is built as one silent `ConstantSourceNode`
 * (a fixed DC "1", started once and never touched again) feeding its own
 * 7-destination gain bank (the wider `AcidModulationDestination` set --
 * adds Resonance/Drive, which LFO doesn't reach yet) -- the *shape* of each
 * trigger's contribution is scheduled directly onto whichever gain node is
 * currently the active destination, inside `schedule()` itself, via
 * `scheduleAuxModulationContour()`: Envelope reuses the same rise/decay
 * timing the filter envelope already uses for that trigger; Accent only
 * ever schedules a nonzero contour on an accented trigger; Random schedules
 * a flat held value (`trigger.randomModulationValue`, -1..1, supplied by the
 * caller -- see `AcidBassTrigger`'s own doc comment) for the trigger's gate
 * duration. All three are skipped on a legato (slide-destination) trigger,
 * matching `retriggerFilterEnvelope`'s own "no fresh attack on legato" rule.
 *
 * Distortion characters (M16): `distortion.ts`'s `getDistortionCurve` now
 * supplies both `WaveShaperNode`s' (Saturation, Drive) `.curve`, selected by
 * `patch.distortion.character` and swapped in `setPatch()` rather than
 * rebuilt -- `getDistortionCurve` itself caches one `Float32Array` per
 * character, so a patch edit only ever reassigns which already-built curve
 * each shaper points at.
 *
 * Tempo-synced delay (M17): one dedicated `DelayNode` with its own feedback
 * loop, inserted as a parallel send after Drive/`outputTrim` and before
 * master Output -- the dry path (`outputTrim -> master`) is untouched and
 * always at full level, so `enabled: false`/`mix: 0` reproduces dry output
 * exactly (spec's own migration-default acceptance criterion). Delay time
 * re-derives from the transport's current BPM via the *existing* `setTempo()`
 * hook (`delay.ts`'s `delayDivisionToSeconds`, the same pattern the LFOs'
 * `applyLfoRate` already established) -- no second clock.
 */

import {
	delayDivisionToSeconds,
	delayFeedbackToGain,
	delayMixToSendGain
} from '$lib/acid-bass/delay';
import { getDistortionCurve } from '$lib/acid-bass/distortion';
import { createDefaultAcidPatch } from '$lib/acid-bass/pattern';
import {
	accentAmountToMultipliers,
	ACID24_RESONANCE_SWING_RATIO,
	attackToSeconds,
	BASS_REFERENCE_OCTAVE_MIDI,
	clampCutoffHz,
	cutoffToHz,
	decayToSeconds,
	driveToPregain,
	envAmountToRatio,
	glideTimeToSeconds,
	keyTrackingMultiplier,
	lfoSyncFrequencyHz,
	mixCompensation,
	pulseWidthClamp,
	releaseToSeconds,
	resolveAccentModulationAmount,
	resolveAuxModulationAmount,
	resolveRandomModulationAmount,
	resonanceToModelParameter,
	saturationToPregain,
	subOctaveToRatio,
	sustainToRatio,
	tuneFineToRatio
} from '$lib/acid-bass/resolve';
import { resolveStepLocks, type ResolvedStepLocks } from '$lib/acid-bass/sequencer';
import { volumeToGain } from '$lib/audio/gain';
import type {
	AcidBassPatch,
	AcidFilterModel,
	AcidGlideCurve,
	AcidLfoDestination,
	AcidModulationDestination,
	AcidStepLocks,
	AcidWave
} from '$lib/acid-bass/types';

import { createAcidBassLfo } from './acid-bass-lfo';
import { createAcid24WorkletNode, createPulseOscillatorWorkletNode } from './acid-worklet-node';
import { frequencyToMidi } from './note-mapping';

export type { AcidBassPatch } from '$lib/acid-bass/types';

export interface AcidBassTrigger {
	time: number;
	frequencyHz: number;
	stepDurationSeconds: number;
	accent: boolean;
	/** 0-100 -- how much of this trigger's own duration the note stays open before release (replaces V1's fixed 82% gate). */
	gatePercent: number;
	/** Overrides cutoff/resonance/envAmount/drive for this trigger only (spec's five lock targets; `lfoDepth` has nothing to apply to until the LFO milestone lands) -- reverts to the patch's own values once this trigger's duration elapses. */
	locks?: AcidStepLocks;
	/** This note should glide into the given frequency instead of releasing -- the oscillator ramps near the end of this step; no release is scheduled here, since the destination step's own (legato) call continues the same envelope motion. */
	slideToFrequencyHz?: number;
	/** This note is the destination of an incoming slide from the previous step -- continue the already-open envelope rather than re-triggering a fresh attack/filter-sweep. */
	legato?: boolean;
	/** -1..1, deterministic per trigger -- the Random aux modulation source's own held value for this note (spec §33: "Random value enters voice as a plain trigger number"). 0 for manual-mode triggers (no random source exists there); the Acid Intelligence bridge supplies a real value in generated mode (M14). Never `Math.random()` inside this file. */
	randomModulationValue: number;
}

export interface AcidBassVoice {
	setPatch(patch: AcidBassPatch, atTime?: number): void;
	schedule(trigger: AcidBassTrigger): void;
	/** Re-syncs the LFO's rate when it's in Sync mode -- the only tempo-related thing this voice ever needs to know (see file header). */
	setTempo(bpm: number): void;
	silence(atTime?: number): void;
	dispose(): void;
	/**
	 * A live `AnalyserNode` already connected to this voice's own real final
	 * output (post-oscillators/filter/envelope/modulation/distortion/delay --
	 * everything, exactly what reaches `destination`), for a genuine
	 * oscilloscope/spectrum display (user-requested, 2026-08) rather than the
	 * client-rendered re-creations `AcidBassLfoScope`/`AcidBassEnvelopeScope`/
	 * `AcidBassAuxModScope` use elsewhere -- this is the one place in the app
	 * that actually threads an `AnalyserNode` up from the real audio graph,
	 * which those three components' own doc comments note as the reason they
	 * don't. A tap, not a redirect: connecting an analyser never affects what
	 * the voice itself sounds like. Never explicitly disconnected -- it goes
	 * out of scope together with the rest of this voice's graph on `dispose()`.
	 */
	readonly outputAnalyser: AnalyserNode;
	/**
	 * A second live tap, this one on `delayNode`'s own output only -- the
	 * wet/echo signal alone, before it's summed with the always-present dry
	 * path into `master` (see the delay send/return wiring comment above
	 * `delayNode`'s own declaration). Silent (flat) whenever delay is
	 * disabled or its mix is 0, exactly reflecting `delaySend.gain` resolving
	 * to 0 in that case -- the same "reads as waiting/off, not broken" intent
	 * as `outputAnalyser` (user-requested, 2026-08).
	 */
	readonly delayAnalyser: AnalyserNode;
}

/**
 * A deliberate, narrow testability seam -- this file has no unit tests of
 * its own otherwise (DSP wiring is normally verified live, per this app's
 * established boundary), and the internal graph nodes below are all
 * function-local closures with no other way to reach them from outside.
 * Exists specifically to let `acid-bass-voice.spec.ts` assert real
 * connectivity (which gain node feeds which AudioParam) rather than just
 * "did `setPatch`/`schedule` throw" -- the exact class of bug this file
 * already shipped once (LFO/Mod Cutoff and Resonance wired to the Biquad
 * filter's own AudioParams but never to the `acid24` AudioWorkletNode's,
 * silently inaudible once that worklet became the default, only-audible
 * path). Every property here is a read-only reference to a node that
 * already exists for production reasons -- attaching this adds no new
 * nodes, no new behavior, and no runtime cost beyond a handful of object
 * references.
 */
export interface AcidBassVoiceTestHooks {
	__test: {
		readonly filter: BiquadFilterNode;
		readonly vca: GainNode;
		readonly subGain: GainNode;
		readonly osc2Gain: GainNode;
		readonly driveInput: GainNode;
		readonly delayNode: DelayNode;
		/** One representative pitch-modulation target -- every main-wave oscillator, Sub, and Osc 2 all get the identical connection (see the file's own `pitchModulatedOscillators` array), so checking one confirms the pattern without exposing all six. */
		readonly representativeOscillatorDetune: AudioParam;
		readonly acid24Node: () => AudioWorkletNode | null;
		readonly pulseWorkletNode: () => AudioWorkletNode | null;
		readonly lfoGains: (slot: 1 | 2) => Record<AcidLfoDestination, GainNode>;
		readonly auxModGains: (
			source: 'envelope' | 'accent' | 'random'
		) => Record<AcidModulationDestination, GainNode>;
		/** Resolves once both the acid24 and Pulse-oscillator worklets have settled (loaded, or permanently failed/unavailable) -- awaiting this before asserting worklet-specific connections avoids racing the fire-and-forget `.then()` callbacks that wire them up. */
		waitForWorkletsReady(): Promise<void>;
	};
}

const MIN_RELEASE_SECONDS = 0.02;
const SILENCE_RAMP_SECONDS = 0.03;
const WAVE_CROSSFADE_TIME_CONSTANT = 0.01;
const PARAM_SMOOTH_TIME_CONSTANT = 0.02;

// exponentialRampToValueAtTime can't target exactly 0.
const MIN_GAIN = 0.0001;
const MIN_SAFE_FILTER_HZ = 20;
const MIN_SAFE_OSC_HZ = 1;

// Conservative overall level -- this voice shares the Groove Engine's output
// with drums and the chord pad (see AGENTS.md's audio-safety doctrine).
const BASE_VCA_PEAK = 0.6;
// Post-shaper trim, applied once -- the WaveShaperNode's tanh curve is
// already self-limiting (its range is always -1..1 regardless of drive), so
// this is headroom against the rest of the Groove Engine's output, not a
// precise loudness-compensation curve.
const DRIVE_OUTPUT_TRIM = 0.8;

const DEFAULT_PATCH: AcidBassPatch = createDefaultAcidPatch();

// LFO depth (0-100) -> each destination's own natural swing at full depth --
// fixed, not proportional to the current cutoff/note/sub level (simpler and
// predictable, the same "musically convincing, not circuit-accurate" call
// the acid24 filter's own design makes elsewhere in this codebase).
const MAX_CUTOFF_LFO_SWING_HZ = 2500;
const MAX_PITCH_LFO_CENTS = 100;
const MAX_SUBLEVEL_LFO_SWING = 0.5;
const MAX_OSC2LEVEL_LFO_SWING = 0.5;
// A fraction of the Pulse worklet's own 0-1 duty-cycle range -- the
// AudioParam's own declared min/max (0.05-0.95) clamps the summed result,
// so this doesn't need its own separate safety margin.
const MAX_PULSE_WIDTH_LFO_SWING = 0.3;

/** 0-100 depth -> the actual modulation amount for one destination -- `subLevel`/`osc2Level` are inert whenever Sub/Osc 2 themselves are off rather than audibly wobbling around silence, and `pulseWidth` only reaches anything once the Pulse oscillator worklet has loaded (see `lfoTargetGain`); this still resolves a real amount for it regardless, since the gain is what actually gates audibility. */
function lfoDepthAmount(
	destination: AcidLfoDestination,
	depth: number,
	subEnabled: boolean,
	osc2Enabled: boolean
): number {
	const ratio = Math.min(1, Math.max(0, depth / 100));
	switch (destination) {
		case 'cutoff':
			return ratio * MAX_CUTOFF_LFO_SWING_HZ;
		case 'pitch':
			return ratio * MAX_PITCH_LFO_CENTS;
		case 'subLevel':
			return subEnabled ? ratio * MAX_SUBLEVEL_LFO_SWING : 0;
		case 'osc2Level':
			return osc2Enabled ? ratio * MAX_OSC2LEVEL_LFO_SWING : 0;
		case 'pulseWidth':
			return ratio * MAX_PULSE_WIDTH_LFO_SWING;
	}
}

/** Until the `acid24` AudioWorklet exists (a later V2 milestone), both `svf12` and `acid24` share the same Biquad-based approximation -- `acid24`'s own ladder-filter resonance semantics don't apply to a `BiquadFilterNode` at all, and falling back to the cleaner `svf12` curve is closer to the intended character than the V1-compatibility-oriented `legacy` curve would be. */
function biquadResonanceModel(model: AcidFilterModel): 'legacy' | 'svf12' {
	return model === 'legacy' ? 'legacy' : 'svf12';
}

/** `AcidWave` values that map directly onto a native `OscillatorType`, i.e. everything but Pulse (which has no native oscillator type and goes through `createPulseWave` instead). "Saw" is the one name that doesn't match its native type string verbatim. */
function nativeOscType(wave: Exclude<AcidWave, 'pulse'>): OscillatorType {
	return wave === 'saw' ? 'sawtooth' : wave;
}

/** Sets Osc 2's wave the same way Sub's is set -- a direct type switch (or, for Pulse, a regenerated static `PeriodicWave`), not a 4-way crossfaded bank like Main's. A wave change here is an infrequent patch edit; see the file header. */
function applyOsc2Wave(
	osc: OscillatorNode,
	ctx: AudioContext,
	wave: AcidWave,
	pulseWidth: number
): void {
	if (wave === 'pulse') {
		osc.setPeriodicWave(createPulseWave(ctx, pulseWidth));
	} else {
		osc.type = nativeOscType(wave);
	}
}

// Enough harmonics for a reasonably bandlimited bass-register pulse without
// being wasteful -- this voice never runs above the bass register, so
// aliasing from a 30-harmonic series is inaudible in practice.
const PULSE_HARMONICS = 30;

/** A bandlimited pulse wave at the given duty cycle (5-95, see `pulseWidthClamp`), built as a Fourier sine series -- the standard construction for an odd rectangular wave, the same family the built-in `'square'` type belongs to (its 50%-duty special case). Regenerated on `setPatch()` rather than modulated live (see file header). */
function createPulseWave(ctx: AudioContext, dutyPercent: number): PeriodicWave {
	const duty = pulseWidthClamp(dutyPercent) / 100;
	const real = new Float32Array(PULSE_HARMONICS + 1);
	const imag = new Float32Array(PULSE_HARMONICS + 1);
	for (let n = 1; n <= PULSE_HARMONICS; n++) {
		imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
	}
	return ctx.createPeriodicWave(real, imag);
}

/**
 * Builds one persistent monophonic voice on `ctx`. Every oscillator (the
 * four main waveforms plus the sub) starts running immediately (silent, via
 * per-wave gains sitting at 0) and keeps running until `dispose()` -- cheap
 * to leave the inactive ones gained to zero, and it's what makes slide/
 * legato behavior possible: there's only ever one set of oscillators to
 * glide, never a fresh one per note.
 */
export function createAcidBassVoice(
	ctx: AudioContext,
	destination: AudioNode = ctx.destination
): AcidBassVoice & AcidBassVoiceTestHooks {
	let currentPatch: AcidBassPatch = DEFAULT_PATCH;

	const sawOsc = ctx.createOscillator();
	sawOsc.type = 'sawtooth';
	const squareOsc = ctx.createOscillator();
	squareOsc.type = 'square';
	const triangleOsc = ctx.createOscillator();
	triangleOsc.type = 'triangle';
	const pulseOsc = ctx.createOscillator();
	pulseOsc.setPeriodicWave(createPulseWave(ctx, currentPatch.oscillator.pulseWidth));
	const subOsc = ctx.createOscillator();
	subOsc.type = currentPatch.oscillator.subWave;
	// Osc 2 -- a second full oscillator (own wave/tune/fine/level), a single
	// type-switched node like Sub rather than a 4-way crossfaded bank like Main.
	const osc2Osc = ctx.createOscillator();
	applyOsc2Wave(
		osc2Osc,
		ctx,
		currentPatch.oscillator.osc2Wave,
		currentPatch.oscillator.osc2PulseWidth
	);

	const mainLevelRatio = currentPatch.oscillator.mainLevel / 100;
	const sawGain = ctx.createGain();
	sawGain.gain.setValueAtTime(
		currentPatch.oscillator.mainWave === 'saw' ? mainLevelRatio : 0,
		ctx.currentTime
	);
	const squareGain = ctx.createGain();
	squareGain.gain.setValueAtTime(
		currentPatch.oscillator.mainWave === 'square' ? mainLevelRatio : 0,
		ctx.currentTime
	);
	const triangleGain = ctx.createGain();
	triangleGain.gain.setValueAtTime(
		currentPatch.oscillator.mainWave === 'triangle' ? mainLevelRatio : 0,
		ctx.currentTime
	);
	const pulseGain = ctx.createGain();
	pulseGain.gain.setValueAtTime(
		currentPatch.oscillator.mainWave === 'pulse' ? mainLevelRatio : 0,
		ctx.currentTime
	);
	// The worklet-based Pulse oscillator's own output (M11) -- starts silent
	// regardless of the patch, since the worklet hasn't loaded yet; crossfades
	// in from pulseGain (the static PeriodicWave fallback) once it has, via
	// applyPulseOscillatorRouting.
	const pulseWorkletGain = ctx.createGain();
	pulseWorkletGain.gain.setValueAtTime(0, ctx.currentTime);
	const subGain = ctx.createGain();
	subGain.gain.setValueAtTime(
		currentPatch.oscillator.subEnabled ? currentPatch.oscillator.subLevel / 100 : 0,
		ctx.currentTime
	);
	const osc2Gain = ctx.createGain();
	osc2Gain.gain.setValueAtTime(
		currentPatch.oscillator.osc2Enabled ? currentPatch.oscillator.osc2Level / 100 : 0,
		ctx.currentTime
	);
	// Applied once, after the main+osc2+sub gains are summed -- unity when
	// only the main oscillator is driven, pulled down only once combined
	// energy would exceed unity (see `mixCompensation`).
	const mixCompensationGain = ctx.createGain();
	mixCompensationGain.gain.setValueAtTime(
		mixCompensation(
			currentPatch.oscillator.mainLevel,
			currentPatch.oscillator.osc2Level,
			currentPatch.oscillator.subLevel
		),
		ctx.currentTime
	);

	// A second, independent drive stage feeding the filter -- the classic
	// acid "drive into the filter" character, distinct from the post-filter
	// output Drive further down the chain.
	const saturationInput = ctx.createGain();
	saturationInput.gain.setValueAtTime(
		saturationToPregain(currentPatch.filter.saturation),
		ctx.currentTime
	);
	const saturationShaper = ctx.createWaveShaper();
	saturationShaper.curve = getDistortionCurve(currentPatch.distortion.character);
	saturationShaper.oversample = '2x';

	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.Q.setValueAtTime(
		resonanceToModelParameter(
			biquadResonanceModel(currentPatch.filter.model),
			currentPatch.filter.resonance
		),
		ctx.currentTime
	);
	filter.frequency.setValueAtTime(
		clampCutoffHz(cutoffToHz(currentPatch.filter.cutoff), ctx.sampleRate),
		ctx.currentTime
	);

	// Biquad output is unity by default (the fallback path); the acid24
	// worklet's own output starts silent and only ever crossfades in once the
	// worklet has actually finished loading and the patch wants it (see
	// applyFilterModelRouting below) -- both stay connected the whole time.
	const biquadOutputGain = ctx.createGain();
	biquadOutputGain.gain.setValueAtTime(1, ctx.currentTime);
	const acid24OutputGain = ctx.createGain();
	acid24OutputGain.gain.setValueAtTime(0, ctx.currentTime);

	const vca = ctx.createGain();
	vca.gain.setValueAtTime(MIN_GAIN, ctx.currentTime);

	const driveInput = ctx.createGain();
	driveInput.gain.setValueAtTime(driveToPregain(currentPatch.output.drive), ctx.currentTime);
	const shaper = ctx.createWaveShaper();
	shaper.curve = getDistortionCurve(currentPatch.distortion.character);
	shaper.oversample = '2x';
	const outputTrim = ctx.createGain();
	outputTrim.gain.setValueAtTime(DRIVE_OUTPUT_TRIM, ctx.currentTime);
	const master = ctx.createGain();
	master.gain.setValueAtTime(volumeToGain(currentPatch.output.volume), ctx.currentTime);

	// Tempo-synced delay (M17) -- a parallel send off `outputTrim`, feeding
	// back into `master` alongside the always-present dry signal. Max delay
	// time generous enough for the slowest supported division at a slow tempo
	// (1/4 note at 30bpm = 2s). `delaySend` starts at 0 -- silent, exactly dry
	// -- until `setPatch()` resolves the real enabled/mix value; the initial
	// delayTime is an arbitrary placeholder for the same reason (inaudible
	// until then, and `setPatch()` corrects it immediately in practice).
	const MAX_DELAY_SECONDS = 2.5;
	const delaySend = ctx.createGain();
	delaySend.gain.setValueAtTime(0, ctx.currentTime);
	const delayNode = ctx.createDelay(MAX_DELAY_SECONDS);
	delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
	const delayFeedback = ctx.createGain();
	delayFeedback.gain.setValueAtTime(
		delayFeedbackToGain(currentPatch.delay.feedback),
		ctx.currentTime
	);

	// Two independent LFOs, each routed to whichever single destination the
	// patch names via its own parallel bank of depth-scaling gains -- the
	// inactive ones always sit at 0 rather than being connected/disconnected
	// on the fly (see file header). Not a many-to-many modulation matrix:
	// each LFO still targets exactly one destination at a time.
	const lfo1 = createAcidBassLfo(ctx);
	const cutoffLfo1Gain = ctx.createGain();
	cutoffLfo1Gain.gain.setValueAtTime(0, ctx.currentTime);
	const pitchLfo1Gain = ctx.createGain();
	pitchLfo1Gain.gain.setValueAtTime(0, ctx.currentTime);
	const subLevelLfo1Gain = ctx.createGain();
	subLevelLfo1Gain.gain.setValueAtTime(0, ctx.currentTime);
	const osc2LevelLfo1Gain = ctx.createGain();
	osc2LevelLfo1Gain.gain.setValueAtTime(0, ctx.currentTime);
	// Only ever reaches the worklet Pulse oscillator's own pulseWidth
	// AudioParam (M11) -- connected once that worklet loads; a genuine no-op
	// (stays at 0, nothing to connect it to) if it never does, per file header.
	const pulseWidthLfo1Gain = ctx.createGain();
	pulseWidthLfo1Gain.gain.setValueAtTime(0, ctx.currentTime);

	const lfo2 = createAcidBassLfo(ctx);
	const cutoffLfo2Gain = ctx.createGain();
	cutoffLfo2Gain.gain.setValueAtTime(0, ctx.currentTime);
	const pitchLfo2Gain = ctx.createGain();
	pitchLfo2Gain.gain.setValueAtTime(0, ctx.currentTime);
	const subLevelLfo2Gain = ctx.createGain();
	subLevelLfo2Gain.gain.setValueAtTime(0, ctx.currentTime);
	const osc2LevelLfo2Gain = ctx.createGain();
	osc2LevelLfo2Gain.gain.setValueAtTime(0, ctx.currentTime);
	const pulseWidthLfo2Gain = ctx.createGain();
	pulseWidthLfo2Gain.gain.setValueAtTime(0, ctx.currentTime);

	sawOsc.connect(sawGain);
	squareOsc.connect(squareGain);
	triangleOsc.connect(triangleGain);
	pulseOsc.connect(pulseGain);
	subOsc.connect(subGain);
	osc2Osc.connect(osc2Gain);
	sawGain.connect(mixCompensationGain);
	squareGain.connect(mixCompensationGain);
	triangleGain.connect(mixCompensationGain);
	pulseGain.connect(mixCompensationGain);
	pulseWorkletGain.connect(mixCompensationGain);
	subGain.connect(mixCompensationGain);
	osc2Gain.connect(mixCompensationGain);
	mixCompensationGain.connect(saturationInput);
	saturationInput.connect(saturationShaper);
	saturationShaper.connect(filter);
	filter.connect(biquadOutputGain);
	biquadOutputGain.connect(vca);
	acid24OutputGain.connect(vca);
	vca.connect(driveInput);
	driveInput.connect(shaper);
	shaper.connect(outputTrim);
	outputTrim.connect(master);
	master.connect(destination);

	// Delay send/return (M17) -- outputTrim feeds the delay line through its
	// own mix-scaled send gain; the delay's own output feeds back into itself
	// (the feedback loop) and also straight into master (the wet return),
	// entirely parallel to the always-present dry outputTrim -> master path
	// above.
	outputTrim.connect(delaySend);
	delaySend.connect(delayNode);
	delayNode.connect(delayFeedback);
	delayFeedback.connect(delayNode);
	delayNode.connect(master);

	// A live tap on the real final signal (dry + delay's wet return, both
	// already summed into `master` above) -- see `outputAnalyser`'s own doc
	// comment on the `AcidBassVoice` interface for why this exists. A tap,
	// not a redirect: connecting an analyser is silent and non-destructive,
	// `master` still reaches `destination` exactly as it always did.
	const outputAnalyser = ctx.createAnalyser();
	outputAnalyser.fftSize = 2048;
	master.connect(outputAnalyser);

	// A second tap, on `delayNode`'s own output -- see `delayAnalyser`'s own
	// doc comment on the `AcidBassVoice` interface for why this exists
	// alongside `outputAnalyser` rather than reusing it.
	const delayAnalyser = ctx.createAnalyser();
	delayAnalyser.fftSize = 2048;
	delayNode.connect(delayAnalyser);

	// Cutoff/pitch modulation add onto whatever's already scheduled there
	// (AudioParams sum every connected signal with their own automation
	// curve, so both LFOs' contributions to the same destination simply sum)
	// -- Sub Level/Osc 2 Level modulation adds onto their own gain's
	// crossfade target the same way. Pitch reaches every oscillator's
	// `detune` (cents-based, so the perceived depth stays consistent across
	// notes regardless of the note's own absolute frequency) -- including
	// Osc 2 and the currently-inactive main waves, which is harmless since
	// an inactive wave's own gain is 0 anyway.
	const pitchModulatedOscillators = [sawOsc, squareOsc, triangleOsc, pulseOsc, subOsc, osc2Osc];
	for (const [lfo, gains] of [
		[
			lfo1,
			{
				cutoff: cutoffLfo1Gain,
				pitch: pitchLfo1Gain,
				subLevel: subLevelLfo1Gain,
				osc2Level: osc2LevelLfo1Gain,
				pulseWidth: pulseWidthLfo1Gain
			}
		],
		[
			lfo2,
			{
				cutoff: cutoffLfo2Gain,
				pitch: pitchLfo2Gain,
				subLevel: subLevelLfo2Gain,
				osc2Level: osc2LevelLfo2Gain,
				pulseWidth: pulseWidthLfo2Gain
			}
		]
	] as const) {
		gains.cutoff.connect(filter.frequency);
		for (const osc of pitchModulatedOscillators) {
			gains.pitch.connect(osc.detune);
		}
		gains.subLevel.connect(subGain.gain);
		gains.osc2Level.connect(osc2Gain.gain);
		lfo.output.connect(gains.cutoff);
		lfo.output.connect(gains.pitch);
		lfo.output.connect(gains.subLevel);
		lfo.output.connect(gains.osc2Level);
		lfo.output.connect(gains.pulseWidth);
	}

	// Three more single-destination modulation sources (Envelope/Accent/
	// Random, M15) -- unlike the LFOs, all three are per-trigger phenomena, so
	// each is a silent constant "1" source whose own 7-destination gain bank
	// (the wider `AcidModulationDestination` set, adding Resonance/Drive) gets
	// scheduled directly inside `schedule()` rather than left continuously
	// running. Still the same "always connected, gain the inactive ones to
	// zero" idiom as the LFO destinations.
	function createAuxModGainBank(): Record<AcidModulationDestination, GainNode> {
		const bank: Record<AcidModulationDestination, GainNode> = {
			cutoff: ctx.createGain(),
			resonance: ctx.createGain(),
			pitch: ctx.createGain(),
			pulseWidth: ctx.createGain(),
			subLevel: ctx.createGain(),
			osc2Level: ctx.createGain(),
			drive: ctx.createGain()
		};
		for (const gainNode of Object.values(bank)) {
			gainNode.gain.setValueAtTime(0, ctx.currentTime);
		}
		return bank;
	}

	function connectAuxModSource(
		source: ConstantSourceNode,
		gains: Record<AcidModulationDestination, GainNode>
	): void {
		source.connect(gains.cutoff);
		source.connect(gains.resonance);
		source.connect(gains.pitch);
		source.connect(gains.pulseWidth);
		source.connect(gains.subLevel);
		source.connect(gains.osc2Level);
		source.connect(gains.drive);
		gains.cutoff.connect(filter.frequency);
		gains.resonance.connect(filter.Q);
		for (const osc of pitchModulatedOscillators) {
			gains.pitch.connect(osc.detune);
		}
		gains.subLevel.connect(subGain.gain);
		gains.osc2Level.connect(osc2Gain.gain);
		gains.drive.connect(driveInput.gain);
		// gains.pulseWidth connects once the Pulse worklet loads (see below) --
		// a genuine no-op against the static PeriodicWave fallback, same as LFO.
	}

	const envModSource = ctx.createConstantSource();
	envModSource.offset.setValueAtTime(1, ctx.currentTime);
	const envModGains = createAuxModGainBank();
	connectAuxModSource(envModSource, envModGains);

	const accentModSource = ctx.createConstantSource();
	accentModSource.offset.setValueAtTime(1, ctx.currentTime);
	const accentModGains = createAuxModGainBank();
	connectAuxModSource(accentModSource, accentModGains);

	const randomModSource = ctx.createConstantSource();
	randomModSource.offset.setValueAtTime(1, ctx.currentTime);
	const randomModGains = createAuxModGainBank();
	connectAuxModSource(randomModSource, randomModGains);

	sawOsc.start(ctx.currentTime);
	squareOsc.start(ctx.currentTime);
	triangleOsc.start(ctx.currentTime);
	pulseOsc.start(ctx.currentTime);
	subOsc.start(ctx.currentTime);
	osc2Osc.start(ctx.currentTime);
	envModSource.start(ctx.currentTime);
	accentModSource.start(ctx.currentTime);
	randomModSource.start(ctx.currentTime);
	let disposed = false;
	let currentBpm = 80;
	let acid24Node: AudioWorkletNode | null = null;
	let pulseWorkletNode: AudioWorkletNode | null = null;

	/** Crossfades between the Biquad and acid24 outputs -- `acid24` only actually routes to the worklet once it exists; otherwise (still loading, or it failed) this keeps the Biquad path active regardless of what the patch asks for, which is exactly the fallback behavior the file header describes. */
	function applyFilterModelRouting(patch: AcidBassPatch, atTime: number): void {
		const useAcid24 = patch.filter.model === 'acid24' && acid24Node !== null;
		biquadOutputGain.gain.cancelScheduledValues(atTime);
		biquadOutputGain.gain.setTargetAtTime(useAcid24 ? 0 : 1, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
		acid24OutputGain.gain.cancelScheduledValues(atTime);
		acid24OutputGain.gain.setTargetAtTime(useAcid24 ? 1 : 0, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
	}

	/** Same idea as applyFilterModelRouting, for the Pulse wave's two implementations -- the worklet one only once it exists, the static PeriodicWave one otherwise. Both are silent unless `mainWave === 'pulse'`. */
	function applyPulseOscillatorRouting(patch: AcidBassPatch, atTime: number): void {
		const mainLevel = patch.oscillator.mainLevel / 100;
		const isPulse = patch.oscillator.mainWave === 'pulse';
		const useWorklet = isPulse && pulseWorkletNode !== null;
		pulseGain.gain.cancelScheduledValues(atTime);
		pulseGain.gain.setTargetAtTime(
			isPulse && !useWorklet ? mainLevel : 0,
			atTime,
			WAVE_CROSSFADE_TIME_CONSTANT
		);
		pulseWorkletGain.gain.cancelScheduledValues(atTime);
		pulseWorkletGain.gain.setTargetAtTime(
			useWorklet ? mainLevel : 0,
			atTime,
			WAVE_CROSSFADE_TIME_CONSTANT
		);
	}

	// Fire-and-forget: the voice must stay usable (via the Biquad fallback)
	// for however long this takes, or forever if it never resolves to a node
	// at all -- see createAcid24WorkletNode's own no-throw contract. The
	// promise itself is kept (not `void`-discarded) only so `__test.
	// waitForWorkletsReady()` below can await it -- nothing else ever reads it.
	const acid24Ready = createAcid24WorkletNode(ctx).then((node) => {
		if (disposed) {
			node?.disconnect();
			return;
		}
		if (node === null) return;
		acid24Node = node;
		mixCompensationGain.connect(node);
		node.connect(acid24OutputGain);
		// Cutoff/Resonance modulation (both LFOs, and the three aux-mod
		// sources' Resonance-capable bank) was only ever wired to the Biquad
		// `filter`'s own AudioParams above -- genuinely inaudible once the
		// patch's model is `acid24` (the default) and this worklet has
		// crossfaded in, since the Biquad path it *was* modulating no longer
		// reaches the output. Same "connect once the worklet resolves" pattern
		// `pulseWidthParam` uses below for the Pulse oscillator worklet.
		const acid24CutoffParam = node.parameters.get('cutoff');
		if (acid24CutoffParam !== undefined) {
			cutoffLfo1Gain.connect(acid24CutoffParam);
			cutoffLfo2Gain.connect(acid24CutoffParam);
			envModGains.cutoff.connect(acid24CutoffParam);
			accentModGains.cutoff.connect(acid24CutoffParam);
			randomModGains.cutoff.connect(acid24CutoffParam);
		}
		// The Resonance destination's own swing is tuned against the Biquad Q
		// range, not acid24's much narrower ladder-feedback range -- routed
		// through a fixed-ratio scaling gain (`ACID24_RESONANCE_SWING_RATIO`,
		// resolve.ts) rather than the raw mod gain, so the acid24 path gets a
		// proportionally equivalent swing instead of a wildly oversized one.
		const acid24ResonanceParam = node.parameters.get('resonance');
		if (acid24ResonanceParam !== undefined) {
			for (const resonanceGain of [
				envModGains.resonance,
				accentModGains.resonance,
				randomModGains.resonance
			]) {
				const scaler = ctx.createGain();
				scaler.gain.setValueAtTime(ACID24_RESONANCE_SWING_RATIO, ctx.currentTime);
				resonanceGain.connect(scaler);
				scaler.connect(acid24ResonanceParam);
			}
		}
		applyFilterModelRouting(currentPatch, ctx.currentTime);
	});

	// Same fire-and-forget pattern, for the Pulse oscillator worklet (M11).
	const pulseWorkletReady = createPulseOscillatorWorkletNode(ctx).then((node) => {
		if (disposed) {
			node?.disconnect();
			return;
		}
		if (node === null) return;
		pulseWorkletNode = node;
		node.connect(pulseWorkletGain);
		const pulseWidthParam = node.parameters.get('pulseWidth');
		if (pulseWidthParam !== undefined) {
			pulseWidthParam.setValueAtTime(
				pulseWidthClamp(currentPatch.oscillator.pulseWidth) / 100,
				ctx.currentTime
			);
			pulseWidthLfo1Gain.connect(pulseWidthParam);
			pulseWidthLfo2Gain.connect(pulseWidthParam);
			envModGains.pulseWidth.connect(pulseWidthParam);
			accentModGains.pulseWidth.connect(pulseWidthParam);
			randomModGains.pulseWidth.connect(pulseWidthParam);
		}
		applyPulseOscillatorRouting(currentPatch, ctx.currentTime);
	});

	const mainOscillators = [sawOsc, squareOsc, triangleOsc, pulseOsc];

	/** Every AudioParam a new note's frequency should land on -- the native oscillators plus the Pulse worklet's own `frequency` param, once it exists (it has no separate `OscillatorNode` to fall back to for pitch, only for gain-crossfade routing). */
	function mainFrequencyParams(): AudioParam[] {
		const params: AudioParam[] = mainOscillators.map((osc) => osc.frequency);
		const workletFrequency = pulseWorkletNode?.parameters.get('frequency');
		if (workletFrequency !== undefined) params.push(workletFrequency);
		return params;
	}

	function setOscFrequencyAtTime(osc: OscillatorNode, hz: number, time: number): void {
		osc.frequency.cancelScheduledValues(time);
		osc.frequency.setValueAtTime(Math.max(hz, MIN_SAFE_OSC_HZ), time);
	}

	function setParamFrequencyAtTime(param: AudioParam, hz: number, time: number): void {
		param.cancelScheduledValues(time);
		param.setValueAtTime(Math.max(hz, MIN_SAFE_OSC_HZ), time);
	}

	/** Whichever depth-scaling gain node `destination` currently routes through, for the given LFO slot -- each LFO has its own independent 5-destination gain bank. */
	function lfoTargetGain(lfoSlot: 1 | 2, destination: AcidLfoDestination): GainNode {
		const gains =
			lfoSlot === 1
				? {
						cutoff: cutoffLfo1Gain,
						pitch: pitchLfo1Gain,
						subLevel: subLevelLfo1Gain,
						osc2Level: osc2LevelLfo1Gain,
						pulseWidth: pulseWidthLfo1Gain
					}
				: {
						cutoff: cutoffLfo2Gain,
						pitch: pitchLfo2Gain,
						subLevel: subLevelLfo2Gain,
						osc2Level: osc2LevelLfo2Gain,
						pulseWidth: pulseWidthLfo2Gain
					};
		return gains[destination];
	}

	type AuxModulationSourceKind = 'envelope' | 'accent' | 'random';

	function auxModGainBank(
		sourceKind: AuxModulationSourceKind
	): Record<AcidModulationDestination, GainNode> {
		if (sourceKind === 'envelope') return envModGains;
		if (sourceKind === 'accent') return accentModGains;
		return randomModGains;
	}

	/**
	 * Schedules one aux-mod source's per-trigger contour on whichever gain
	 * node currently targets `destination`: ramps 0 -> `amount` over
	 * `riseSeconds`, holds, then settles back to 0 starting `holdSeconds`
	 * later (the same `setTargetAtTime`-after-`time`-plus-`duration` idiom
	 * `locks.drive`'s own revert-after-one-trigger scheduling already uses
	 * below). Every *other* destination for this source is explicitly ramped
	 * to 0 at the same time, so a mid-pattern destination change never leaves
	 * a stale contribution lingering on the old target. `amount === 0`
	 * (source disabled, or Accent/Random resolving to nothing this trigger)
	 * just settles every destination to 0 -- no audible contour at all.
	 */
	function scheduleAuxModulationContour(
		sourceKind: AuxModulationSourceKind,
		destination: AcidModulationDestination,
		amount: number,
		time: number,
		riseSeconds: number,
		holdSeconds: number
	): void {
		const gains = auxModGainBank(sourceKind);
		for (const [dest, gainNode] of Object.entries(gains) as [
			AcidModulationDestination,
			GainNode
		][]) {
			gainNode.gain.cancelScheduledValues(time);
			if (dest !== destination || amount === 0) {
				gainNode.gain.setTargetAtTime(0, time, PARAM_SMOOTH_TIME_CONSTANT);
				continue;
			}
			gainNode.gain.setValueAtTime(0, time);
			gainNode.gain.linearRampToValueAtTime(amount, time + riseSeconds);
			gainNode.gain.setTargetAtTime(
				0,
				time + riseSeconds + holdSeconds,
				PARAM_SMOOTH_TIME_CONSTANT
			);
		}
	}

	function applyLfoRate(lfoSlot: 1 | 2, patch: AcidBassPatch): void {
		const lfoPatch = lfoSlot === 1 ? patch.lfo1 : patch.lfo2;
		const hz =
			lfoPatch.rateMode === 'sync'
				? lfoSyncFrequencyHz(currentBpm, lfoPatch.division)
				: lfoPatch.rateHz;
		(lfoSlot === 1 ? lfo1 : lfo2).setRateHz(hz);
	}

	/** Re-derives the delay's own time from the transport's current BPM and the patch's division -- called from both `setPatch()` and `setTempo()`, the same "no new clock" pattern `applyLfoRate` already established for the LFOs' sync mode. */
	function applyDelayTime(patch: AcidBassPatch): void {
		const seconds = Math.min(
			MAX_DELAY_SECONDS,
			delayDivisionToSeconds(currentBpm, patch.delay.division)
		);
		delayNode.delayTime.cancelScheduledValues(ctx.currentTime);
		delayNode.delayTime.setTargetAtTime(seconds, ctx.currentTime, PARAM_SMOOTH_TIME_CONSTANT);
	}

	function setFrequencyAtTime(frequencyHz: number, time: number, patch: AcidBassPatch): void {
		const ratio = tuneFineToRatio(patch.oscillator.tune, patch.oscillator.fine);
		const mainHz = frequencyHz * ratio;
		for (const param of mainFrequencyParams()) {
			setParamFrequencyAtTime(param, mainHz, time);
		}
		const subHz = mainHz * subOctaveToRatio(patch.oscillator.subOctave);
		setOscFrequencyAtTime(subOsc, subHz, time);
		// Osc 2 uses its own independent tune/fine ratio, not Main's --
		// that's what makes it useful for detune/unison stacking.
		const osc2Ratio = tuneFineToRatio(patch.oscillator.osc2Tune, patch.oscillator.osc2Fine);
		setOscFrequencyAtTime(osc2Osc, frequencyHz * osc2Ratio, time);
	}

	function rampParamFrequency(
		param: AudioParam,
		fromHz: number,
		toHz: number,
		atTime: number,
		glideSeconds: number,
		curve: AcidGlideCurve
	): void {
		param.cancelScheduledValues(atTime);
		param.setValueAtTime(Math.max(fromHz, MIN_SAFE_OSC_HZ), atTime);
		if (curve === 'exponential') {
			param.exponentialRampToValueAtTime(Math.max(toHz, MIN_SAFE_OSC_HZ), atTime + glideSeconds);
		} else {
			param.linearRampToValueAtTime(Math.max(toHz, MIN_SAFE_OSC_HZ), atTime + glideSeconds);
		}
	}

	function retriggerFilterEnvelope(
		time: number,
		frequencyHz: number,
		accent: boolean,
		decaySeconds: number,
		patch: AcidBassPatch,
		resolved: ResolvedStepLocks
	): void {
		const trackingMultiplier = keyTrackingMultiplier(
			patch.filter.keyTracking,
			frequencyToMidi(frequencyHz),
			BASS_REFERENCE_OCTAVE_MIDI
		);
		const baseCutoff = clampCutoffHz(
			cutoffToHz(resolved.cutoff) * trackingMultiplier,
			ctx.sampleRate
		);
		const envMultiplier = accentAmountToMultipliers(patch.envelope.accentAmount).env;
		const envRatio = envAmountToRatio(resolved.envAmount) * (accent ? envMultiplier : 1);
		const peakCutoff = clampCutoffHz(baseCutoff * envRatio, ctx.sampleRate);
		filter.Q.cancelScheduledValues(time);
		filter.Q.setValueAtTime(
			resonanceToModelParameter(biquadResonanceModel(patch.filter.model), resolved.resonance),
			time
		);
		filter.frequency.cancelScheduledValues(time);
		filter.frequency.setValueAtTime(peakCutoff, time);
		filter.frequency.exponentialRampToValueAtTime(
			Math.max(baseCutoff, MIN_SAFE_FILTER_HZ),
			time + decaySeconds
		);

		// Driven in parallel regardless of which model is currently audible
		// (see applyFilterModelRouting) -- harmless when gained to 0, and keeps
		// the worklet already caught up the moment a patch edit switches to it.
		if (acid24Node !== null) {
			const resonanceParam = acid24Node.parameters.get('resonance');
			resonanceParam?.cancelScheduledValues(time);
			resonanceParam?.setValueAtTime(resonanceToModelParameter('acid24', resolved.resonance), time);
			const cutoffParam = acid24Node.parameters.get('cutoff');
			cutoffParam?.cancelScheduledValues(time);
			cutoffParam?.setValueAtTime(peakCutoff, time);
			cutoffParam?.exponentialRampToValueAtTime(
				Math.max(baseCutoff, MIN_SAFE_FILTER_HZ),
				time + decaySeconds
			);
		}
	}

	return {
		setPatch(patch, atTime = ctx.currentTime) {
			currentPatch = patch;

			const mainLevel = patch.oscillator.mainLevel / 100;
			const sawTarget = patch.oscillator.mainWave === 'saw' ? mainLevel : 0;
			const squareTarget = patch.oscillator.mainWave === 'square' ? mainLevel : 0;
			const triangleTarget = patch.oscillator.mainWave === 'triangle' ? mainLevel : 0;
			const subTarget = patch.oscillator.subEnabled ? patch.oscillator.subLevel / 100 : 0;
			const osc2Target = patch.oscillator.osc2Enabled ? patch.oscillator.osc2Level / 100 : 0;

			sawGain.gain.cancelScheduledValues(atTime);
			sawGain.gain.setTargetAtTime(sawTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			squareGain.gain.cancelScheduledValues(atTime);
			squareGain.gain.setTargetAtTime(squareTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			triangleGain.gain.cancelScheduledValues(atTime);
			triangleGain.gain.setTargetAtTime(triangleTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			applyPulseOscillatorRouting(patch, atTime);
			subGain.gain.cancelScheduledValues(atTime);
			subGain.gain.setTargetAtTime(subTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			osc2Gain.gain.cancelScheduledValues(atTime);
			osc2Gain.gain.setTargetAtTime(osc2Target, atTime, WAVE_CROSSFADE_TIME_CONSTANT);

			mixCompensationGain.gain.cancelScheduledValues(atTime);
			mixCompensationGain.gain.setTargetAtTime(
				mixCompensation(
					patch.oscillator.mainLevel,
					patch.oscillator.osc2Level,
					patch.oscillator.subLevel
				),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			// The static PeriodicWave fallback isn't live-modulatable -- just
			// regenerate the waveform to match whatever the patch currently says
			// (the worklet path, once loaded, gets its pulseWidth AudioParam
			// updated just below instead, and *is* live-modulatable via LFO).
			pulseOsc.setPeriodicWave(createPulseWave(ctx, patch.oscillator.pulseWidth));
			if (pulseWorkletNode !== null) {
				const pulseWidthParam = pulseWorkletNode.parameters.get('pulseWidth');
				pulseWidthParam?.cancelScheduledValues(atTime);
				pulseWidthParam?.setTargetAtTime(
					pulseWidthClamp(patch.oscillator.pulseWidth) / 100,
					atTime,
					PARAM_SMOOTH_TIME_CONSTANT
				);
			}
			// Sub wave has no crossfade partner (only one sub oscillator) -- a
			// direct type switch is an infrequent patch edit, not a per-note
			// automation target, so a small discontinuity on change is acceptable.
			subOsc.type = patch.oscillator.subWave;
			// Osc 2 gets the same treatment -- always a direct type switch (or,
			// for Pulse, a regenerated static PeriodicWave), never a live-PWM
			// worklet path (that stays Main-only, see the file header).
			applyOsc2Wave(osc2Osc, ctx, patch.oscillator.osc2Wave, patch.oscillator.osc2PulseWidth);

			// Distortion character (M16): both shapers just point at whichever
			// already-built, cached curve the patch now names -- never a rebuild.
			const distortionCurve = getDistortionCurve(patch.distortion.character);
			saturationShaper.curve = distortionCurve;
			shaper.curve = distortionCurve;

			// Resonance/Drive/Volume/Saturation aren't enveloped per-note, so they
			// can apply to the currently-sounding note immediately -- Cutoff/
			// EnvMod/Decay/Key Tracking only shape each note's own envelope and
			// simply take effect on the next scheduled note (ramping a mid-flight
			// envelope would fight its own automation curve).
			saturationInput.gain.cancelScheduledValues(atTime);
			saturationInput.gain.setTargetAtTime(
				saturationToPregain(patch.filter.saturation),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			filter.Q.cancelScheduledValues(atTime);
			filter.Q.setTargetAtTime(
				resonanceToModelParameter(biquadResonanceModel(patch.filter.model), patch.filter.resonance),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			applyFilterModelRouting(patch, atTime);
			if (acid24Node !== null) {
				const cutoffParam = acid24Node.parameters.get('cutoff');
				cutoffParam?.cancelScheduledValues(atTime);
				cutoffParam?.setTargetAtTime(
					clampCutoffHz(cutoffToHz(patch.filter.cutoff), ctx.sampleRate),
					atTime,
					PARAM_SMOOTH_TIME_CONSTANT
				);
				const resonanceParam = acid24Node.parameters.get('resonance');
				resonanceParam?.cancelScheduledValues(atTime);
				resonanceParam?.setTargetAtTime(
					resonanceToModelParameter('acid24', patch.filter.resonance),
					atTime,
					PARAM_SMOOTH_TIME_CONSTANT
				);
				const driveParam = acid24Node.parameters.get('drive');
				driveParam?.cancelScheduledValues(atTime);
				driveParam?.setTargetAtTime(
					saturationToPregain(patch.filter.saturation),
					atTime,
					PARAM_SMOOTH_TIME_CONSTANT
				);
			}
			driveInput.gain.cancelScheduledValues(atTime);
			driveInput.gain.setTargetAtTime(
				driveToPregain(patch.output.drive),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			master.gain.cancelScheduledValues(atTime);
			master.gain.setTargetAtTime(
				volumeToGain(patch.output.volume),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			lfo1.setShape(patch.lfo1.shape);
			lfo2.setShape(patch.lfo2.shape);
			applyLfoRate(1, patch);
			applyLfoRate(2, patch);

			// Tempo-synced delay (M17) -- disabled or zero-mix both resolve the
			// send gain to exactly 0, reproducing dry output (spec's own
			// migration-default acceptance criterion).
			applyDelayTime(patch);
			delayFeedback.gain.cancelScheduledValues(atTime);
			delayFeedback.gain.setTargetAtTime(
				delayFeedbackToGain(patch.delay.feedback),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			delaySend.gain.cancelScheduledValues(atTime);
			delaySend.gain.setTargetAtTime(
				patch.delay.enabled ? delayMixToSendGain(patch.delay.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			for (const [lfoSlot, lfoPatch, allGains] of [
				[
					1,
					patch.lfo1,
					[cutoffLfo1Gain, pitchLfo1Gain, subLevelLfo1Gain, osc2LevelLfo1Gain, pulseWidthLfo1Gain]
				],
				[
					2,
					patch.lfo2,
					[cutoffLfo2Gain, pitchLfo2Gain, subLevelLfo2Gain, osc2LevelLfo2Gain, pulseWidthLfo2Gain]
				]
			] as const) {
				const activeGain = lfoTargetGain(lfoSlot, lfoPatch.destination);
				const amount = lfoPatch.enabled
					? lfoDepthAmount(
							lfoPatch.destination,
							lfoPatch.depth,
							patch.oscillator.subEnabled,
							patch.oscillator.osc2Enabled
						)
					: 0;
				for (const gainNode of allGains) {
					gainNode.gain.cancelScheduledValues(atTime);
					gainNode.gain.setTargetAtTime(
						gainNode === activeGain ? amount : 0,
						atTime,
						PARAM_SMOOTH_TIME_CONSTANT
					);
				}
			}
		},

		setTempo(bpm) {
			currentBpm = bpm;
			applyLfoRate(1, currentPatch);
			applyLfoRate(2, currentPatch);
			applyDelayTime(currentPatch);
		},

		schedule(trigger) {
			if (disposed) return;
			const {
				time,
				frequencyHz,
				stepDurationSeconds,
				accent,
				gatePercent,
				locks,
				slideToFrequencyHz,
				legato,
				randomModulationValue
			} = trigger;
			const patch = currentPatch;
			const decaySeconds = Math.min(decayToSeconds(patch.envelope.decay), stepDurationSeconds);
			const releaseSeconds = releaseToSeconds(patch.envelope.release);
			const attackSeconds = attackToSeconds(patch.envelope.attack);
			const gateRatio = Math.min(1, Math.max(0, gatePercent / 100));
			const gateSeconds = Math.min(
				stepDurationSeconds * gateRatio,
				Math.max(stepDurationSeconds - MIN_RELEASE_SECONDS, MIN_RELEASE_SECONDS)
			);
			const vcaMultiplier = accentAmountToMultipliers(patch.envelope.accentAmount).vca;
			const peakGain = Math.min(1, BASE_VCA_PEAK * (accent ? vcaMultiplier : 1));
			const resolved = resolveStepLocks(locks, {
				cutoff: patch.filter.cutoff,
				resonance: patch.filter.resonance,
				envAmount: patch.filter.envAmount,
				drive: patch.output.drive,
				// A `lfoDepth` lock applies to LFO 1 only -- see AcidStepLocks's own doc comment.
				lfoDepth: patch.lfo1.depth
			});

			if (!legato) {
				setFrequencyAtTime(frequencyHz, time, patch);
				retriggerFilterEnvelope(time, frequencyHz, accent, decaySeconds, patch, resolved);
				const sustainLevel = Math.max(MIN_GAIN, peakGain * sustainToRatio(patch.envelope.sustain));
				vca.gain.cancelScheduledValues(time);
				vca.gain.setValueAtTime(MIN_GAIN, time);
				vca.gain.exponentialRampToValueAtTime(peakGain, time + attackSeconds);
				// Sustain (100 -> sustainLevel === peakGain, a no-op ramp that
				// reproduces the pre-Sustain "hold at full peak" behavior exactly).
				vca.gain.exponentialRampToValueAtTime(sustainLevel, time + attackSeconds + decaySeconds);

				// Auxiliary modulation (M15) -- skipped on legato the same way the
				// filter envelope itself is, since there's no fresh attack to shape.
				const subEnabled = patch.oscillator.subEnabled;
				const osc2Enabled = patch.oscillator.osc2Enabled;

				// ENV: reuses the filter envelope's own rise/decay timing (spec:
				// "the existing note-envelope timing as a modulation contour").
				const envAmount = resolveAuxModulationAmount(
					patch.modulation.envelope,
					subEnabled,
					osc2Enabled
				);
				scheduleAuxModulationContour(
					'envelope',
					patch.modulation.envelope.destination,
					envAmount,
					time,
					attackSeconds,
					decaySeconds
				);

				// ACCENT: contributes only on accented triggers, held through the
				// gate the same way the VCA's own accent boost is.
				const accentAmount = resolveAccentModulationAmount(
					patch.modulation.accent,
					accent,
					subEnabled,
					osc2Enabled
				);
				scheduleAuxModulationContour(
					'accent',
					patch.modulation.accent.destination,
					accentAmount,
					time,
					attackSeconds,
					gateSeconds
				);

				// RANDOM: one deterministic held bipolar value per trigger --
				// `randomModulationValue` is already deterministic (Acid
				// Intelligence bridge, M14; always 0 for manual-mode triggers) --
				// never Math.random() in this file.
				const randomAmount = resolveRandomModulationAmount(
					patch.modulation.random,
					randomModulationValue,
					subEnabled,
					osc2Enabled
				);
				scheduleAuxModulationContour(
					'random',
					patch.modulation.random.destination,
					randomAmount,
					time,
					attackSeconds,
					gateSeconds
				);
			}

			if (locks?.drive !== undefined) {
				// Applied for this trigger's own duration only, then reverts to the
				// patch's own Drive -- the next trigger (locked or not) always
				// re-resolves from scratch, so no separate "clear the lock" bookkeeping
				// is needed beyond this one scheduled ramp back.
				driveInput.gain.cancelScheduledValues(time);
				driveInput.gain.setValueAtTime(driveToPregain(resolved.drive), time);
				driveInput.gain.setTargetAtTime(
					driveToPregain(patch.output.drive),
					time + stepDurationSeconds,
					PARAM_SMOOTH_TIME_CONSTANT
				);
			}

			if (locks?.lfoDepth !== undefined && patch.lfo1.enabled) {
				// Same one-trigger-then-revert treatment as `locks.drive` above --
				// only meaningful while LFO 1 is on and actually routed somewhere
				// (a `lfoDepth` lock applies to LFO 1 only, never LFO 2).
				const target = lfoTargetGain(1, patch.lfo1.destination);
				const lockedAmount = lfoDepthAmount(
					patch.lfo1.destination,
					resolved.lfoDepth,
					patch.oscillator.subEnabled,
					patch.oscillator.osc2Enabled
				);
				const baseAmount = lfoDepthAmount(
					patch.lfo1.destination,
					patch.lfo1.depth,
					patch.oscillator.subEnabled,
					patch.oscillator.osc2Enabled
				);
				target.gain.cancelScheduledValues(time);
				target.gain.setValueAtTime(lockedAmount, time);
				target.gain.setTargetAtTime(
					baseAmount,
					time + stepDurationSeconds,
					PARAM_SMOOTH_TIME_CONSTANT
				);
			}

			if (slideToFrequencyHz !== undefined) {
				// Glide near the end of this step instead of releasing -- the
				// destination step's own (legato) call continues from here.
				const glideSeconds = glideTimeToSeconds(patch.glide.time);
				const slideStart = Math.max(time + stepDurationSeconds - glideSeconds, time);
				const ratio = tuneFineToRatio(patch.oscillator.tune, patch.oscillator.fine);
				const fromMainHz = frequencyHz * ratio;
				const toMainHz = slideToFrequencyHz * ratio;
				for (const param of mainFrequencyParams()) {
					rampParamFrequency(
						param,
						fromMainHz,
						toMainHz,
						slideStart,
						glideSeconds,
						patch.glide.curve
					);
				}
				const subRatio = ratio * subOctaveToRatio(patch.oscillator.subOctave);
				rampParamFrequency(
					subOsc.frequency,
					frequencyHz * subRatio,
					slideToFrequencyHz * subRatio,
					slideStart,
					glideSeconds,
					patch.glide.curve
				);
				// Osc 2 slides using its own independent tune/fine ratio, not Main's.
				const osc2Ratio = tuneFineToRatio(patch.oscillator.osc2Tune, patch.oscillator.osc2Fine);
				rampParamFrequency(
					osc2Osc.frequency,
					frequencyHz * osc2Ratio,
					slideToFrequencyHz * osc2Ratio,
					slideStart,
					glideSeconds,
					patch.glide.curve
				);
			} else {
				// Releases from whatever the envelope actually is at gate-close --
				// not always peakGain now that Decay can settle to a lower Sustain
				// level first, and not always a value this same call scheduled
				// either (a legato-destination trigger releases from wherever the
				// continued envelope it inherited currently sits). cancelAndHoldAtTime
				// is exactly the Web Audio API built for this: it holds whatever
				// value the already-scheduled curve would have at that instant.
				vca.gain.cancelAndHoldAtTime(time + gateSeconds);
				vca.gain.exponentialRampToValueAtTime(MIN_GAIN, time + gateSeconds + releaseSeconds);
			}
		},

		silence(atTime = ctx.currentTime) {
			vca.gain.cancelScheduledValues(atTime);
			vca.gain.setValueAtTime(vca.gain.value, atTime);
			vca.gain.linearRampToValueAtTime(MIN_GAIN, atTime + SILENCE_RAMP_SECONDS);
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			const stopTime = ctx.currentTime + SILENCE_RAMP_SECONDS + 0.01;
			vca.gain.cancelScheduledValues(ctx.currentTime);
			vca.gain.setValueAtTime(vca.gain.value, ctx.currentTime);
			vca.gain.linearRampToValueAtTime(MIN_GAIN, stopTime);
			sawOsc.stop(stopTime);
			squareOsc.stop(stopTime);
			triangleOsc.stop(stopTime);
			pulseOsc.stop(stopTime);
			subOsc.stop(stopTime);
			osc2Osc.stop(stopTime);
			envModSource.stop(stopTime);
			accentModSource.stop(stopTime);
			randomModSource.stop(stopTime);
			lfo1.dispose();
			lfo2.dispose();
			acid24Node?.disconnect();
			pulseWorkletNode?.disconnect();
		},

		outputAnalyser,
		delayAnalyser,

		__test: {
			filter,
			vca,
			subGain,
			osc2Gain,
			driveInput,
			delayNode,
			representativeOscillatorDetune: sawOsc.detune,
			acid24Node: () => acid24Node,
			pulseWorkletNode: () => pulseWorkletNode,
			lfoGains: (slot) =>
				slot === 1
					? {
							cutoff: cutoffLfo1Gain,
							pitch: pitchLfo1Gain,
							subLevel: subLevelLfo1Gain,
							osc2Level: osc2LevelLfo1Gain,
							pulseWidth: pulseWidthLfo1Gain
						}
					: {
							cutoff: cutoffLfo2Gain,
							pitch: pitchLfo2Gain,
							subLevel: subLevelLfo2Gain,
							osc2Level: osc2LevelLfo2Gain,
							pulseWidth: pulseWidthLfo2Gain
						},
			auxModGains: (source) => auxModGainBank(source),
			waitForWorkletsReady: () =>
				Promise.all([acid24Ready, pulseWorkletReady]).then(() => undefined)
		}
	};
}
