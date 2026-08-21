/**
 * Scale Practice's Acid Bass voice — a monophonic synth bass living
 * alongside `drum-voices.ts`/`chord-voices.ts` in the Groove Engine's
 * output. Unlike those two (a fresh node graph built per hit/chord, fire and
 * forget), this voice is deliberately persistent: one oscillator pair, one
 * filter, one amplitude envelope, built once and reused for every note, so
 * slides can glide the oscillator's own frequency instead of crossfading
 * between two discrete notes. Must not know about chords, progressions,
 * scales, interval labels, fret positions, `PatternRole` semantics, or
 * Svelte stores — it receives plain frequencies, timing, and accent/slide
 * booleans; harmonic resolution happens in `scale-practice.svelte.ts` before
 * calling in, the same boundary `chord-voices.ts`'s `triggerChordPad` keeps.
 *
 * V2 (~/Downloads/ACID-BASS-ENGINE-V2.md): this file currently wires the
 * *existing* saw+square oscillator pair and single `BiquadFilterNode` up to
 * the new nested patch shape (Cutoff/EnvMod/Attack/Release/Accent/Glide/
 * Volume all patch-driven now, where V1 hardcoded several of them) --
 * genuinely new signal-path capability (sub oscillator, tune/fine, pre-
 * filter saturation, key tracking, the `acid24` AudioWorklet filter, LFO)
 * lands in later milestones as additive changes to this same file, not a
 * rewrite. `filter.model` is read but not yet fully honored: until the
 * `acid24` AudioWorklet exists, both `svf12` and `acid24` route through the
 * same Biquad path as an `svf12`-flavored approximation (see
 * `resonanceToModelParameter` in `resolve.ts`) -- only `legacy` gets its own
 * distinct (V1-compatible) resonance curve for now.
 */

import { createDefaultAcidPatch } from '$lib/acid-bass/pattern';
import {
	accentAmountToMultipliers,
	attackToSeconds,
	clampCutoffHz,
	cutoffToHz,
	decayToSeconds,
	driveToPregain,
	envAmountToRatio,
	glideTimeToSeconds,
	releaseToSeconds,
	resonanceToModelParameter,
	volumeToGain
} from '$lib/acid-bass/resolve';
import type { AcidBassPatch, AcidFilterModel } from '$lib/acid-bass/types';

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
// Multiplied onto `volumeToGain(patch.output.volume)` -- keeps max Volume
// (100) from landing at a bare 1.0 once combined with drive's own headroom.
const MAX_OUTPUT_GAIN = 0.9;

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

/**
 * Builds one persistent monophonic voice on `ctx`. The oscillator pair
 * starts running immediately (silent, via the VCA sitting at 0) and keeps
 * running until `dispose()` -- cheap to leave both waveforms live with the
 * inactive one gained to zero, and it's what makes slide/legato behavior
 * possible: there's only ever one oscillator pair to glide.
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

	const sawGain = ctx.createGain();
	sawGain.gain.setValueAtTime(currentPatch.oscillator.mainWave === 'saw' ? 1 : 0, ctx.currentTime);
	const squareGain = ctx.createGain();
	squareGain.gain.setValueAtTime(
		currentPatch.oscillator.mainWave === 'square' ? 1 : 0,
		ctx.currentTime
	);

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
	master.gain.setValueAtTime(
		volumeToGain(currentPatch.output.volume) * MAX_OUTPUT_GAIN,
		ctx.currentTime
	);

	sawOsc.connect(sawGain);
	squareOsc.connect(squareGain);
	sawGain.connect(filter);
	squareGain.connect(filter);
	filter.connect(vca);
	vca.connect(driveInput);
	driveInput.connect(shaper);
	shaper.connect(outputTrim);
	outputTrim.connect(master);
	master.connect(destination);

	sawOsc.start(ctx.currentTime);
	squareOsc.start(ctx.currentTime);
	let disposed = false;

	function setFrequencyAtTime(frequencyHz: number, time: number): void {
		const hz = Math.max(frequencyHz, MIN_SAFE_OSC_HZ);
		sawOsc.frequency.cancelScheduledValues(time);
		sawOsc.frequency.setValueAtTime(hz, time);
		squareOsc.frequency.cancelScheduledValues(time);
		squareOsc.frequency.setValueAtTime(hz, time);
	}

	function retriggerFilterEnvelope(
		time: number,
		accent: boolean,
		decaySeconds: number,
		patch: AcidBassPatch
	): void {
		const baseCutoff = clampCutoffHz(cutoffToHz(patch.filter.cutoff), ctx.sampleRate);
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

			const sawTarget = patch.oscillator.mainWave === 'saw' ? 1 : 0;
			const squareTarget = patch.oscillator.mainWave === 'square' ? 1 : 0;
			sawGain.gain.cancelScheduledValues(atTime);
			sawGain.gain.setTargetAtTime(sawTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);
			squareGain.gain.cancelScheduledValues(atTime);
			squareGain.gain.setTargetAtTime(squareTarget, atTime, WAVE_CROSSFADE_TIME_CONSTANT);

			// Resonance/Drive/Volume aren't enveloped per-note, so they can apply
			// to the currently-sounding note immediately -- Cutoff/EnvMod/Decay
			// only shape each note's own envelope and simply take effect on the
			// next scheduled note (ramping a mid-flight envelope would fight its
			// own automation curve).
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
				volumeToGain(patch.output.volume) * MAX_OUTPUT_GAIN,
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
				setFrequencyAtTime(frequencyHz, time);
				retriggerFilterEnvelope(time, accent, decaySeconds, patch);
				vca.gain.cancelScheduledValues(time);
				vca.gain.setValueAtTime(MIN_GAIN, time);
				vca.gain.exponentialRampToValueAtTime(peakGain, time + attackSeconds);
			}

			if (slideToFrequencyHz !== undefined) {
				// Glide near the end of this step instead of releasing -- the
				// destination step's own (legato) call continues from here.
				const glideSeconds = glideTimeToSeconds(patch.glide.time);
				const slideStart = Math.max(time + stepDurationSeconds - glideSeconds, time);
				const targetHz = Math.max(slideToFrequencyHz, MIN_SAFE_OSC_HZ);
				const rampToTarget =
					patch.glide.curve === 'exponential'
						? (param: AudioParam) =>
								param.exponentialRampToValueAtTime(
									Math.max(targetHz, MIN_SAFE_OSC_HZ),
									slideStart + glideSeconds
								)
						: (param: AudioParam) =>
								param.linearRampToValueAtTime(targetHz, slideStart + glideSeconds);
				sawOsc.frequency.cancelScheduledValues(slideStart);
				sawOsc.frequency.setValueAtTime(Math.max(frequencyHz, MIN_SAFE_OSC_HZ), slideStart);
				rampToTarget(sawOsc.frequency);
				squareOsc.frequency.cancelScheduledValues(slideStart);
				squareOsc.frequency.setValueAtTime(Math.max(frequencyHz, MIN_SAFE_OSC_HZ), slideStart);
				rampToTarget(squareOsc.frequency);
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
		}
	};
}
