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
 * from the post-filter output Drive). `filter.model` is read but not yet
 * fully honored: until the `acid24` AudioWorklet exists, both `svf12` and
 * `acid24` route through the same Biquad path as an `svf12`-flavored
 * approximation (see `resonanceToModelParameter` in `resolve.ts`) -- only
 * `legacy` gets its own distinct (V1-compatible) resonance curve for now.
 * Pulse Width is patch-driven only (regenerated on `setPatch()`) -- live
 * "LFO -> Pulse Width" modulation needs the worklet oscillator (a later
 * milestone) to stay sample-accurate.
 */

import { createDefaultAcidPatch } from '$lib/acid-bass/pattern';
import {
	accentAmountToMultipliers,
	attackToSeconds,
	BASS_REFERENCE_OCTAVE_MIDI,
	clampCutoffHz,
	cutoffToHz,
	decayToSeconds,
	driveToPregain,
	envAmountToRatio,
	glideTimeToSeconds,
	keyTrackingMultiplier,
	mixCompensation,
	pulseWidthClamp,
	releaseToSeconds,
	resonanceToModelParameter,
	saturationToPregain,
	subOctaveToRatio,
	tuneFineToRatio,
	volumeToGain
} from '$lib/acid-bass/resolve';
import type { AcidBassPatch, AcidFilterModel, AcidGlideCurve } from '$lib/acid-bass/types';

import { frequencyToMidi } from './note-mapping';

export type { AcidBassPatch } from '$lib/acid-bass/types';

export interface AcidBassTrigger {
	time: number;
	frequencyHz: number;
	stepDurationSeconds: number;
	accent: boolean;
	/** This note should glide into the given frequency instead of releasing -- the oscillator ramps near the end of this step; no release is scheduled here, since the destination step's own (legato) call continues the same envelope motion. */
	slideToFrequencyHz?: number;
	/** This note is the destination of an incoming slide from the previous step -- continue the already-open envelope rather than re-triggering a fresh attack/filter-sweep. */
	legato?: boolean;
}

export interface AcidBassVoice {
	setPatch(patch: AcidBassPatch, atTime?: number): void;
	schedule(trigger: AcidBassTrigger): void;
	silence(atTime?: number): void;
	dispose(): void;
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

/** Until the `acid24` AudioWorklet exists (a later V2 milestone), both `svf12` and `acid24` share the same Biquad-based approximation -- `acid24`'s own ladder-filter resonance semantics don't apply to a `BiquadFilterNode` at all, and falling back to the cleaner `svf12` curve is closer to the intended character than the V1-compatibility-oriented `legacy` curve would be. */
function biquadResonanceModel(model: AcidFilterModel): 'legacy' | 'svf12' {
	return model === 'legacy' ? 'legacy' : 'svf12';
}

/** A fixed tanh-like soft-clip curve -- the *pregain* before this node (driven by Drive) is what actually varies per patch, not the curve itself (spec: "avoid rebuilding distortion curves on every step"). At pregain 1 (Drive 0), input samples stay small enough that tanh(x) ≈ x -- effectively clean; at higher pregain the same fixed curve saturates harder. */
function createDriveCurve(): Float32Array<ArrayBuffer> {
	const samples = 256;
	const curve = new Float32Array(samples);
	for (let i = 0; i < samples; i++) {
		const x = (i / (samples - 1)) * 2 - 1;
		curve[i] = Math.tanh(x * 1.5);
	}
	return curve;
}

const DRIVE_CURVE = createDriveCurve();

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
): AcidBassVoice {
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
	const subGain = ctx.createGain();
	subGain.gain.setValueAtTime(
		currentPatch.oscillator.subEnabled ? currentPatch.oscillator.subLevel / 100 : 0,
		ctx.currentTime
	);
	// Applied once, after the main+sub gains are summed -- unity when only
	// the main oscillator is driven, pulled down only once combined energy
	// would exceed unity (see `mixCompensation`).
	const mixCompensationGain = ctx.createGain();
	mixCompensationGain.gain.setValueAtTime(
		mixCompensation(currentPatch.oscillator.mainLevel, currentPatch.oscillator.subLevel),
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
	saturationShaper.curve = DRIVE_CURVE;
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

	const vca = ctx.createGain();
	vca.gain.setValueAtTime(MIN_GAIN, ctx.currentTime);

	const driveInput = ctx.createGain();
	driveInput.gain.setValueAtTime(driveToPregain(currentPatch.output.drive), ctx.currentTime);
	const shaper = ctx.createWaveShaper();
	shaper.curve = DRIVE_CURVE;
	shaper.oversample = '2x';
	const outputTrim = ctx.createGain();
	outputTrim.gain.setValueAtTime(DRIVE_OUTPUT_TRIM, ctx.currentTime);
	const master = ctx.createGain();
	master.gain.setValueAtTime(volumeToGain(currentPatch.output.volume), ctx.currentTime);

	sawOsc.connect(sawGain);
	squareOsc.connect(squareGain);
	triangleOsc.connect(triangleGain);
	pulseOsc.connect(pulseGain);
	subOsc.connect(subGain);
	sawGain.connect(mixCompensationGain);
	squareGain.connect(mixCompensationGain);
	triangleGain.connect(mixCompensationGain);
	pulseGain.connect(mixCompensationGain);
	subGain.connect(mixCompensationGain);
	mixCompensationGain.connect(saturationInput);
	saturationInput.connect(saturationShaper);
	saturationShaper.connect(filter);
	filter.connect(vca);
	vca.connect(driveInput);
	driveInput.connect(shaper);
	shaper.connect(outputTrim);
	outputTrim.connect(master);
	master.connect(destination);

	sawOsc.start(ctx.currentTime);
	squareOsc.start(ctx.currentTime);
	triangleOsc.start(ctx.currentTime);
	pulseOsc.start(ctx.currentTime);
	subOsc.start(ctx.currentTime);
	let disposed = false;

	const mainOscillators = [sawOsc, squareOsc, triangleOsc, pulseOsc];

	function setOscFrequencyAtTime(osc: OscillatorNode, hz: number, time: number): void {
		osc.frequency.cancelScheduledValues(time);
		osc.frequency.setValueAtTime(Math.max(hz, MIN_SAFE_OSC_HZ), time);
	}

	function setFrequencyAtTime(frequencyHz: number, time: number, patch: AcidBassPatch): void {
		const ratio = tuneFineToRatio(patch.oscillator.tune, patch.oscillator.fine);
		const mainHz = frequencyHz * ratio;
		for (const osc of mainOscillators) {
			setOscFrequencyAtTime(osc, mainHz, time);
		}
		const subHz = mainHz * subOctaveToRatio(patch.oscillator.subOctave);
		setOscFrequencyAtTime(subOsc, subHz, time);
	}

	function rampOscFrequency(
		osc: OscillatorNode,
		fromHz: number,
		toHz: number,
		atTime: number,
		glideSeconds: number,
		curve: AcidGlideCurve
	): void {
		osc.frequency.cancelScheduledValues(atTime);
		osc.frequency.setValueAtTime(Math.max(fromHz, MIN_SAFE_OSC_HZ), atTime);
		if (curve === 'exponential') {
			osc.frequency.exponentialRampToValueAtTime(
				Math.max(toHz, MIN_SAFE_OSC_HZ),
				atTime + glideSeconds
			);
		} else {
			osc.frequency.linearRampToValueAtTime(Math.max(toHz, MIN_SAFE_OSC_HZ), atTime + glideSeconds);
		}
	}

	function retriggerFilterEnvelope(
		time: number,
		frequencyHz: number,
		accent: boolean,
		decaySeconds: number,
		patch: AcidBassPatch
	): void {
		const trackingMultiplier = keyTrackingMultiplier(
			patch.filter.keyTracking,
			frequencyToMidi(frequencyHz),
			BASS_REFERENCE_OCTAVE_MIDI
		);
		const baseCutoff = clampCutoffHz(
			cutoffToHz(patch.filter.cutoff) * trackingMultiplier,
			ctx.sampleRate
		);
		const envMultiplier = accentAmountToMultipliers(patch.envelope.accentAmount).env;
		const envRatio = envAmountToRatio(patch.filter.envAmount) * (accent ? envMultiplier : 1);
		const peakCutoff = clampCutoffHz(baseCutoff * envRatio, ctx.sampleRate);
		filter.Q.cancelScheduledValues(time);
		filter.Q.setValueAtTime(
			resonanceToModelParameter(biquadResonanceModel(patch.filter.model), patch.filter.resonance),
			time
		);
		filter.frequency.cancelScheduledValues(time);
		filter.frequency.setValueAtTime(peakCutoff, time);
		filter.frequency.exponentialRampToValueAtTime(
			Math.max(baseCutoff, MIN_SAFE_FILTER_HZ),
			time + decaySeconds
		);
	}

	return {
		setPatch(patch, atTime = ctx.currentTime) {
			currentPatch = patch;

			const mainLevel = patch.oscillator.mainLevel / 100;
			const sawTarget = patch.oscillator.mainWave === 'saw' ? mainLevel : 0;
			const squareTarget = patch.oscillator.mainWave === 'square' ? mainLevel : 0;
			const triangleTarget = patch.oscillator.mainWave === 'triangle' ? mainLevel : 0;
			const pulseTarget = patch.oscillator.mainWave === 'pulse' ? mainLevel : 0;
			const subTarget = patch.oscillator.subEnabled ? patch.oscillator.subLevel / 100 : 0;

			sawGain.gain.cancelScheduledValues(atTime);
			sawGain.gain.setTargetAtTime(sawTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			squareGain.gain.cancelScheduledValues(atTime);
			squareGain.gain.setTargetAtTime(squareTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			triangleGain.gain.cancelScheduledValues(atTime);
			triangleGain.gain.setTargetAtTime(triangleTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			pulseGain.gain.cancelScheduledValues(atTime);
			pulseGain.gain.setTargetAtTime(pulseTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			subGain.gain.cancelScheduledValues(atTime);
			subGain.gain.setTargetAtTime(subTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);

			mixCompensationGain.gain.cancelScheduledValues(atTime);
			mixCompensationGain.gain.setTargetAtTime(
				mixCompensation(patch.oscillator.mainLevel, patch.oscillator.subLevel),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			// Pulse Width isn't live-modulatable yet (see file header) -- just
			// regenerate the waveform to match whatever the patch currently says.
			pulseOsc.setPeriodicWave(createPulseWave(ctx, patch.oscillator.pulseWidth));
			// Sub wave has no crossfade partner (only one sub oscillator) -- a
			// direct type switch is an infrequent patch edit, not a per-note
			// automation target, so a small discontinuity on change is acceptable.
			subOsc.type = patch.oscillator.subWave;

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
		},

		schedule(trigger) {
			if (disposed) return;
			const { time, frequencyHz, stepDurationSeconds, accent, slideToFrequencyHz, legato } =
				trigger;
			const patch = currentPatch;
			const decaySeconds = Math.min(decayToSeconds(patch.envelope.decay), stepDurationSeconds);
			const releaseSeconds = releaseToSeconds(patch.envelope.release);
			const attackSeconds = attackToSeconds(patch.envelope.attack);
			const gateSeconds = Math.min(
				stepDurationSeconds * 0.82,
				Math.max(stepDurationSeconds - MIN_RELEASE_SECONDS, MIN_RELEASE_SECONDS)
			);
			const vcaMultiplier = accentAmountToMultipliers(patch.envelope.accentAmount).vca;
			const peakGain = Math.min(1, BASE_VCA_PEAK * (accent ? vcaMultiplier : 1));

			if (!legato) {
				setFrequencyAtTime(frequencyHz, time, patch);
				retriggerFilterEnvelope(time, frequencyHz, accent, decaySeconds, patch);
				vca.gain.cancelScheduledValues(time);
				vca.gain.setValueAtTime(MIN_GAIN, time);
				vca.gain.exponentialRampToValueAtTime(peakGain, time + attackSeconds);
			}

			if (slideToFrequencyHz !== undefined) {
				// Glide near the end of this step instead of releasing -- the
				// destination step's own (legato) call continues from here.
				const glideSeconds = glideTimeToSeconds(patch.glide.time);
				const slideStart = Math.max(time + stepDurationSeconds - glideSeconds, time);
				const ratio = tuneFineToRatio(patch.oscillator.tune, patch.oscillator.fine);
				const fromMainHz = frequencyHz * ratio;
				const toMainHz = slideToFrequencyHz * ratio;
				for (const osc of mainOscillators) {
					rampOscFrequency(osc, fromMainHz, toMainHz, slideStart, glideSeconds, patch.glide.curve);
				}
				const subRatio = ratio * subOctaveToRatio(patch.oscillator.subOctave);
				rampOscFrequency(
					subOsc,
					frequencyHz * subRatio,
					slideToFrequencyHz * subRatio,
					slideStart,
					glideSeconds,
					patch.glide.curve
				);
			} else {
				vca.gain.setValueAtTime(peakGain, time + gateSeconds);
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
		}
	};
}
