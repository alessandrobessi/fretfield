/**
 * The Chord Pad's FX rack (`chord-pad-fx/types.ts`'s `ChordPadFxState`) --
 * one persistent node graph built once per playback session (mirroring
 * `acid-bass-voice.ts`'s own "build once, live for the whole session"
 * shape), sitting between every `triggerChordPad` hit (`chord-voices.ts`)
 * and `ctx.destination`. Signal order: Fuzz -> Chorus -> Phaser -> Flanger ->
 * Tremolo -> Delay -> Reverb -> destination -- Fuzz first (the standard
 * pedalboard convention: distortion ahead of modulation and time-based
 * effects, so everything downstream processes the already-fuzzed signal),
 * then the four modulation effects grouped ahead of the two time-based ones
 * (built in three stages, 2026-08: Reverb/Delay/Chorus first, then Phaser/
 * Flanger/Tremolo, then Fuzz). Every stage except Tremolo is a genuine
 * dry-signal-preserving insert (its own always-on dry path plus a single
 * mix-scaled send into that stage's own wet processing, summed back
 * together) -- disabled or `mix: 0` reproduces exactly dry output for that
 * stage, the same invariant Acid Bass's own tempo-synced delay already
 * established.
 *
 * Fuzz is a single fixed hard-clip `WaveShaperNode` curve (a steep `tanh`,
 * generated once, never regenerated per patch edit) -- Drive is only ever
 * the pre-gain feeding into that fixed curve, the same "one curve, a
 * pre-gain controls how hard it clips" idiom Acid Bass's own
 * `driveToPregain`/`saturationToPregain` already established, not a
 * per-character curve set (this rack has no character picker, unlike Acid
 * Bass's Soft/Diode/Hard distortion -- one fuzz character is proportionate
 * to what was asked).
 *
 * Reverb is a small algorithmic (Freeverb/Schroeder-style) comb+allpass
 * network, not a convolution reverb -- this app has no external
 * impulse-response asset anywhere (everything audio-adjacent is generated in
 * code or built from plain nodes, e.g. `chord-voices.ts`'s own
 * `warmthCurve()`), and a `ConvolverNode` reverb would need a generated noise
 * buffer rebuilt on every patch edit (not real-time-smooth) plus new fake
 * primitives in `fake-web-audio.ts`. Three parallel comb filters (`DelayNode`
 * + a feedback `GainNode` + a damping lowpass `BiquadFilterNode` in each
 * feedback loop, fixed/spread-apart delay times so the tail doesn't ring
 * metallically) are summed and passed through one native `type: 'allpass'`
 * `BiquadFilterNode` for diffusion. "Size" controls each comb's own feedback
 * gain (how long the tail rings, the same mapping real Freeverb-style
 * reverbs use -- delay times themselves are fixed tuning constants, not
 * patch-controlled); "Damping" controls each comb's feedback-loop lowpass
 * cutoff.
 *
 * Phaser is an LFO-swept series of native `type: 'allpass'`
 * `BiquadFilterNode`s (four in series, one shared LFO driving every stage's
 * own `.frequency` together via a scaling gain, the same "LFO into a gain
 * bank" idiom `acid-bass-voice.ts`/this file's own Chorus stage already use)
 * -- the classic phaser topology, and the cheapest correct one given the
 * allpass filter type Web Audio already provides natively, same reasoning
 * the Reverb allpass diffusion stage above already established.
 *
 * Flanger reuses Chorus's exact "one modulated `DelayNode`" primitive, plus
 * a feedback loop -- a shorter base delay (~3ms vs Chorus's 18ms) and that
 * feedback are what give it its own resonant "jet" character instead of
 * Chorus's smoother thickening.
 *
 * Tremolo is the one genuine exception to the dry/wet-insert shape every
 * other stage uses -- it doesn't add a wet signal on top of dry, it directly
 * modulates the amplitude of the one signal passing through: a single
 * `GainNode` in series, whose own `.gain` an LFO drives between `1` and
 * `1 - swing`. `enabled: false` or `depth: 0` both hold that gain at a
 * constant `1` (the LFO's own depth-scaling gain resolves to `0`), the same
 * "reproduces dry exactly" invariant every other stage keeps, just reached a
 * different way -- no separate `mix` field exists for it (see
 * `ChordPadTremoloPatch`'s own doc comment).
 */

import {
	chorusDepthToSeconds,
	chorusMixToGain,
	chorusRateHzClamp,
	delayDivisionToSeconds,
	delayFeedbackToGain,
	delayMixToSendGain,
	flangerDepthToSeconds,
	flangerFeedbackToGain,
	flangerMixToGain,
	flangerRateHzClamp,
	fuzzDriveToPregain,
	fuzzMixToGain,
	phaserDepthToHzRange,
	phaserMixToGain,
	phaserRateHzClamp,
	reverbDampingToLowpassHz,
	reverbMixToGain,
	reverbSizeToFeedbackGain,
	tremoloDepthToGainSwing,
	tremoloRateHzClamp
} from '$lib/chord-pad-fx/resolve';
import { createDefaultChordPadFxState } from '$lib/chord-pad-fx/pattern';
import type { ChordPadFxState } from '$lib/chord-pad-fx/types';

const PARAM_SMOOTH_TIME_CONSTANT = 0.02;

// Generous enough for the slowest supported division at a slow tempo (1/4
// note at 30bpm = 2s) -- the same ceiling Acid Bass's own delay uses.
const MAX_DELAY_SECONDS = 2.5;

const CHORUS_BASE_DELAY_SECONDS = 0.018;
// Comfortably above base + the maximum depth swing (chorusDepthToSeconds's
// own ceiling) so the modulated delay time never clips against the node's
// own max.
const CHORUS_MAX_DELAY_SECONDS = 0.05;

// Spread apart (no simple integer ratios) so the summed tail doesn't ring
// metallically -- the same heuristic real Freeverb-style comb networks use.
// Fixed tuning constants, not patch-controlled (see file header).
const REVERB_COMB_DELAY_SECONDS: readonly number[] = [0.023, 0.029, 0.034];
const REVERB_COMB_MAX_DELAY_SECONDS = 0.05;
const REVERB_ALLPASS_HZ = 700;

// Four stages is the classic phaser count -- fewer sounds thin, more is
// diminishing returns for a pad effect that isn't the star of the app.
const PHASER_STAGE_COUNT = 4;
// Fixed center frequency each stage's own sweep moves around -- not
// patch-controlled (only the sweep's own rate/range are, via Rate/Depth).
const PHASER_CENTER_HZ = 800;

const FLANGER_BASE_DELAY_SECONDS = 0.003;
// Comfortably above base + the maximum depth swing (flangerDepthToSeconds's
// own ceiling) so the modulated delay time never clips against the node's
// own max.
const FLANGER_MAX_DELAY_SECONDS = 0.02;

// Steeper than chord-voices.ts's own WARMTH_CURVE (a gentle `x - x^3/3`) --
// this is meant to clip hard, not just round off peaks. Drive's own pre-gain
// (fuzzDriveToPregain) is what actually pushes a loud signal past this
// curve's own domain into a fully hard-clipped, squared-off "fuzz" tone.
const FUZZ_CURVE_SAMPLES = 256;
const FUZZ_CURVE_STEEPNESS = 6;

function createFuzzCurve(): Float32Array<ArrayBuffer> {
	const curve = new Float32Array(FUZZ_CURVE_SAMPLES);
	for (let i = 0; i < FUZZ_CURVE_SAMPLES; i++) {
		const x = (i / (FUZZ_CURVE_SAMPLES - 1)) * 2 - 1;
		curve[i] = Math.tanh(x * FUZZ_CURVE_STEEPNESS);
	}
	return curve;
}

const FUZZ_CURVE = createFuzzCurve();

export interface ChordPadFxBus {
	/** Where a chord-pad hit (`chord-voices.ts`'s `triggerChordPad`) should connect instead of `ctx.destination` directly. */
	readonly input: GainNode;
	setPatch(state: ChordPadFxState, atTime?: number): void;
	/** Re-derives the delay's own time from the transport's current BPM -- the only tempo-related thing this bus ever needs to know, the same "no new clock" pattern `acid-bass-voice.ts`'s own `setTempo` established. */
	setTempo(bpm: number): void;
	/**
	 * A deliberate, narrow testability seam -- this file has no other unit
	 * coverage otherwise (DSP wiring is normally verified live), exposing
	 * otherwise-unreachable closure-local nodes as read-only references,
	 * exactly the same pattern/rationale as `acid-bass-voice.ts`'s own
	 * `__test` hook.
	 */
	readonly __test: {
		readonly fuzzSend: GainNode;
		readonly fuzzPregain: GainNode;
		readonly chorusSend: GainNode;
		readonly delaySend: GainNode;
		readonly delayNode: DelayNode;
		readonly reverbSend: GainNode;
		/** One representative comb filter's feedback/damping nodes -- every comb gets the identical treatment in `setPatch` (see `REVERB_COMB_DELAY_SECONDS`), so checking one confirms the pattern without exposing all three. */
		readonly representativeCombFeedback: GainNode;
		readonly representativeCombDamping: BiquadFilterNode;
		readonly phaserSend: GainNode;
		/** One representative allpass stage -- every stage gets the identical shared-LFO frequency sweep, so checking one confirms the pattern without exposing all four. */
		readonly representativePhaserStage: BiquadFilterNode;
		readonly flangerSend: GainNode;
		readonly flangerDelay: DelayNode;
		readonly flangerFeedback: GainNode;
		readonly tremoloGain: GainNode;
	};
}

interface CombStage {
	delay: DelayNode;
	damping: BiquadFilterNode;
	feedback: GainNode;
}

/** Builds one comb filter (delay -> damping lowpass -> feedback gain -> back into the delay), tapping the damped signal into `sum` -- the parallel unit `REVERB_COMB_DELAY_SECONDS` describes three of. */
function createCombStage(ctx: AudioContext, delaySeconds: number, sum: GainNode): CombStage {
	const delay = ctx.createDelay(REVERB_COMB_MAX_DELAY_SECONDS);
	delay.delayTime.setValueAtTime(delaySeconds, ctx.currentTime);
	const damping = ctx.createBiquadFilter();
	damping.type = 'lowpass';
	damping.Q.setValueAtTime(0.5, ctx.currentTime);
	const feedback = ctx.createGain();

	delay.connect(damping);
	damping.connect(feedback);
	feedback.connect(delay);
	damping.connect(sum);

	return { delay, damping, feedback };
}

export function createChordPadFxBus(ctx: AudioContext): ChordPadFxBus {
	let currentState: ChordPadFxState = createDefaultChordPadFxState();
	let currentBpm = 120;

	const input = ctx.createGain();

	// --- Fuzz: a fixed hard-clip curve, Drive is only ever the pre-gain
	// feeding into it (see file header) --------------------------------------
	const fuzzDry = ctx.createGain();
	const fuzzSend = ctx.createGain();
	fuzzSend.gain.setValueAtTime(0, ctx.currentTime);
	const fuzzPregain = ctx.createGain();
	fuzzPregain.gain.setValueAtTime(1, ctx.currentTime);
	const fuzzShaper = ctx.createWaveShaper();
	fuzzShaper.curve = FUZZ_CURVE;
	fuzzShaper.oversample = '4x';
	const fuzzOutput = ctx.createGain();

	input.connect(fuzzDry);
	input.connect(fuzzSend);
	fuzzSend.connect(fuzzPregain);
	fuzzPregain.connect(fuzzShaper);
	fuzzDry.connect(fuzzOutput);
	fuzzShaper.connect(fuzzOutput);

	// --- Chorus: one modulated short delay, no feedback -------------------
	const chorusDry = ctx.createGain();
	const chorusSend = ctx.createGain();
	chorusSend.gain.setValueAtTime(0, ctx.currentTime);
	const chorusDelay = ctx.createDelay(CHORUS_MAX_DELAY_SECONDS);
	chorusDelay.delayTime.setValueAtTime(CHORUS_BASE_DELAY_SECONDS, ctx.currentTime);
	const chorusLfo = ctx.createOscillator();
	chorusLfo.type = 'sine';
	chorusLfo.frequency.setValueAtTime(currentState.chorus.rate, ctx.currentTime);
	const chorusLfoDepth = ctx.createGain();
	chorusLfoDepth.gain.setValueAtTime(0, ctx.currentTime);
	const chorusOutput = ctx.createGain();

	fuzzOutput.connect(chorusDry);
	fuzzOutput.connect(chorusSend);
	chorusSend.connect(chorusDelay);
	chorusLfo.connect(chorusLfoDepth);
	chorusLfoDepth.connect(chorusDelay.delayTime);
	chorusLfo.start(ctx.currentTime);
	chorusDry.connect(chorusOutput);
	chorusDelay.connect(chorusOutput);

	// --- Phaser: an LFO-swept series of allpass filters --------------------
	const phaserDry = ctx.createGain();
	const phaserSend = ctx.createGain();
	phaserSend.gain.setValueAtTime(0, ctx.currentTime);
	const phaserStages: BiquadFilterNode[] = Array.from({ length: PHASER_STAGE_COUNT }, () => {
		const stage = ctx.createBiquadFilter();
		stage.type = 'allpass';
		stage.frequency.setValueAtTime(PHASER_CENTER_HZ, ctx.currentTime);
		return stage;
	});
	let phaserChainNode: AudioNode = phaserSend;
	for (const stage of phaserStages) {
		phaserChainNode.connect(stage);
		phaserChainNode = stage;
	}
	const phaserLfo = ctx.createOscillator();
	phaserLfo.type = 'sine';
	phaserLfo.frequency.setValueAtTime(currentState.phaser.rate, ctx.currentTime);
	const phaserLfoDepth = ctx.createGain();
	phaserLfoDepth.gain.setValueAtTime(0, ctx.currentTime);
	phaserLfo.connect(phaserLfoDepth);
	for (const stage of phaserStages) phaserLfoDepth.connect(stage.frequency);
	phaserLfo.start(ctx.currentTime);
	const phaserOutput = ctx.createGain();

	chorusOutput.connect(phaserDry);
	chorusOutput.connect(phaserSend);
	phaserDry.connect(phaserOutput);
	phaserChainNode.connect(phaserOutput);

	// --- Flanger: Chorus's own modulated delay, plus a feedback loop -------
	const flangerDry = ctx.createGain();
	const flangerSend = ctx.createGain();
	flangerSend.gain.setValueAtTime(0, ctx.currentTime);
	const flangerDelay = ctx.createDelay(FLANGER_MAX_DELAY_SECONDS);
	flangerDelay.delayTime.setValueAtTime(FLANGER_BASE_DELAY_SECONDS, ctx.currentTime);
	const flangerLfo = ctx.createOscillator();
	flangerLfo.type = 'sine';
	flangerLfo.frequency.setValueAtTime(currentState.flanger.rate, ctx.currentTime);
	const flangerLfoDepth = ctx.createGain();
	flangerLfoDepth.gain.setValueAtTime(0, ctx.currentTime);
	flangerLfo.connect(flangerLfoDepth);
	flangerLfoDepth.connect(flangerDelay.delayTime);
	flangerLfo.start(ctx.currentTime);
	const flangerFeedback = ctx.createGain();
	flangerFeedback.gain.setValueAtTime(0, ctx.currentTime);
	const flangerOutput = ctx.createGain();

	phaserOutput.connect(flangerDry);
	phaserOutput.connect(flangerSend);
	flangerSend.connect(flangerDelay);
	flangerDelay.connect(flangerFeedback);
	flangerFeedback.connect(flangerDelay);
	flangerDry.connect(flangerOutput);
	flangerDelay.connect(flangerOutput);

	// --- Tremolo: a single in-series amplitude-modulating gain, no dry/wet
	// split (see file header) ------------------------------------------------
	const tremoloGain = ctx.createGain();
	tremoloGain.gain.setValueAtTime(1, ctx.currentTime);
	const tremoloLfo = ctx.createOscillator();
	tremoloLfo.type = 'sine';
	tremoloLfo.frequency.setValueAtTime(currentState.tremolo.rate, ctx.currentTime);
	const tremoloLfoDepth = ctx.createGain();
	tremoloLfoDepth.gain.setValueAtTime(0, ctx.currentTime);
	tremoloLfo.connect(tremoloLfoDepth);
	tremoloLfoDepth.connect(tremoloGain.gain);
	tremoloLfo.start(ctx.currentTime);

	flangerOutput.connect(tremoloGain);

	// --- Delay: one tempo-synced delay with feedback -----------------------
	const delayDry = ctx.createGain();
	const delaySend = ctx.createGain();
	delaySend.gain.setValueAtTime(0, ctx.currentTime);
	const delayNode = ctx.createDelay(MAX_DELAY_SECONDS);
	delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
	const delayFeedback = ctx.createGain();
	delayFeedback.gain.setValueAtTime(0, ctx.currentTime);
	const delayOutput = ctx.createGain();

	tremoloGain.connect(delayDry);
	tremoloGain.connect(delaySend);
	delaySend.connect(delayNode);
	delayNode.connect(delayFeedback);
	delayFeedback.connect(delayNode);
	delayDry.connect(delayOutput);
	delayNode.connect(delayOutput);

	// --- Reverb: 3 parallel comb filters + 1 series allpass -----------------
	const reverbDry = ctx.createGain();
	const reverbSend = ctx.createGain();
	reverbSend.gain.setValueAtTime(0, ctx.currentTime);
	const combSum = ctx.createGain();
	const combStages = REVERB_COMB_DELAY_SECONDS.map((seconds) =>
		createCombStage(ctx, seconds, combSum)
	);
	const allpass = ctx.createBiquadFilter();
	allpass.type = 'allpass';
	allpass.frequency.setValueAtTime(REVERB_ALLPASS_HZ, ctx.currentTime);
	const output = ctx.createGain();

	delayOutput.connect(reverbDry);
	delayOutput.connect(reverbSend);
	for (const stage of combStages) reverbSend.connect(stage.delay);
	combSum.connect(allpass);
	reverbDry.connect(output);
	allpass.connect(output);

	output.connect(ctx.destination);

	function applyDelayTime(atTime: number): void {
		const seconds = delayDivisionToSeconds(currentBpm, currentState.delay.division);
		delayNode.delayTime.cancelScheduledValues(atTime);
		delayNode.delayTime.setTargetAtTime(seconds, atTime, PARAM_SMOOTH_TIME_CONSTANT);
	}

	return {
		input,

		setPatch(state, atTime = ctx.currentTime) {
			currentState = state;

			fuzzPregain.gain.cancelScheduledValues(atTime);
			fuzzPregain.gain.setTargetAtTime(
				fuzzDriveToPregain(state.fuzz.drive),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			fuzzSend.gain.cancelScheduledValues(atTime);
			fuzzSend.gain.setTargetAtTime(
				state.fuzz.enabled ? fuzzMixToGain(state.fuzz.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			chorusLfo.frequency.cancelScheduledValues(atTime);
			chorusLfo.frequency.setTargetAtTime(
				chorusRateHzClamp(state.chorus.rate),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			chorusLfoDepth.gain.cancelScheduledValues(atTime);
			chorusLfoDepth.gain.setTargetAtTime(
				chorusDepthToSeconds(state.chorus.depth),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			chorusSend.gain.cancelScheduledValues(atTime);
			chorusSend.gain.setTargetAtTime(
				state.chorus.enabled ? chorusMixToGain(state.chorus.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			phaserLfo.frequency.cancelScheduledValues(atTime);
			phaserLfo.frequency.setTargetAtTime(
				phaserRateHzClamp(state.phaser.rate),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			phaserLfoDepth.gain.cancelScheduledValues(atTime);
			phaserLfoDepth.gain.setTargetAtTime(
				phaserDepthToHzRange(state.phaser.depth),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			phaserSend.gain.cancelScheduledValues(atTime);
			phaserSend.gain.setTargetAtTime(
				state.phaser.enabled ? phaserMixToGain(state.phaser.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			flangerLfo.frequency.cancelScheduledValues(atTime);
			flangerLfo.frequency.setTargetAtTime(
				flangerRateHzClamp(state.flanger.rate),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			flangerLfoDepth.gain.cancelScheduledValues(atTime);
			flangerLfoDepth.gain.setTargetAtTime(
				flangerDepthToSeconds(state.flanger.depth),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			flangerFeedback.gain.cancelScheduledValues(atTime);
			flangerFeedback.gain.setTargetAtTime(
				flangerFeedbackToGain(state.flanger.feedback),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			flangerSend.gain.cancelScheduledValues(atTime);
			flangerSend.gain.setTargetAtTime(
				state.flanger.enabled ? flangerMixToGain(state.flanger.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			tremoloLfo.frequency.cancelScheduledValues(atTime);
			tremoloLfo.frequency.setTargetAtTime(
				tremoloRateHzClamp(state.tremolo.rate),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			// See file header: the LFO's own depth-scaling gain swings ±half the
			// total range around a base value that's also half the range below
			// unity, so the sum ranges over exactly [1 - swing, 1] -- at swing 0
			// (disabled/depth 0) both resolve to a constant 1, exactly dry.
			const tremoloSwing = state.tremolo.enabled ? tremoloDepthToGainSwing(state.tremolo.depth) : 0;
			tremoloLfoDepth.gain.cancelScheduledValues(atTime);
			tremoloLfoDepth.gain.setTargetAtTime(tremoloSwing / 2, atTime, PARAM_SMOOTH_TIME_CONSTANT);
			tremoloGain.gain.cancelScheduledValues(atTime);
			tremoloGain.gain.setTargetAtTime(1 - tremoloSwing / 2, atTime, PARAM_SMOOTH_TIME_CONSTANT);

			applyDelayTime(atTime);
			delayFeedback.gain.cancelScheduledValues(atTime);
			delayFeedback.gain.setTargetAtTime(
				delayFeedbackToGain(state.delay.feedback),
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
			delaySend.gain.cancelScheduledValues(atTime);
			delaySend.gain.setTargetAtTime(
				state.delay.enabled ? delayMixToSendGain(state.delay.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);

			const feedbackGain = reverbSizeToFeedbackGain(state.reverb.size);
			const dampingHz = reverbDampingToLowpassHz(state.reverb.damping);
			for (const stage of combStages) {
				stage.feedback.gain.cancelScheduledValues(atTime);
				stage.feedback.gain.setTargetAtTime(feedbackGain, atTime, PARAM_SMOOTH_TIME_CONSTANT);
				stage.damping.frequency.cancelScheduledValues(atTime);
				stage.damping.frequency.setTargetAtTime(dampingHz, atTime, PARAM_SMOOTH_TIME_CONSTANT);
			}
			reverbSend.gain.cancelScheduledValues(atTime);
			reverbSend.gain.setTargetAtTime(
				state.reverb.enabled ? reverbMixToGain(state.reverb.mix) : 0,
				atTime,
				PARAM_SMOOTH_TIME_CONSTANT
			);
		},

		setTempo(bpm) {
			currentBpm = bpm;
			applyDelayTime(ctx.currentTime);
		},

		__test: {
			fuzzSend,
			fuzzPregain,
			chorusSend,
			delaySend,
			delayNode,
			reverbSend,
			representativeCombFeedback: combStages[0].feedback,
			representativeCombDamping: combStages[0].damping,
			phaserSend,
			representativePhaserStage: phaserStages[0],
			flangerSend,
			flangerDelay,
			flangerFeedback,
			tremoloGain
		}
	};
}
