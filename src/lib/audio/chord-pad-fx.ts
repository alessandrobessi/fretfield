/**
 * The Chord Pad's FX rack (`chord-pad-fx/types.ts`'s `ChordPadFxState`) --
 * one persistent node graph built once per playback session (mirroring
 * `acid-bass-voice.ts`'s own "build once, live for the whole session"
 * shape), sitting between every `triggerChordPad` hit (`chord-voices.ts`)
 * and `ctx.destination`. Signal order: Chorus -> Delay -> Reverb ->
 * destination. Each stage is a genuine dry-signal-preserving insert (its own
 * always-on dry path plus a single mix-scaled send into that stage's own wet
 * processing, summed back together) -- disabled or `mix: 0` reproduces
 * exactly dry output for that stage, the same invariant Acid Bass's own
 * tempo-synced delay already established.
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
 */

import {
	chorusDepthToSeconds,
	chorusMixToGain,
	chorusRateHzClamp,
	delayDivisionToSeconds,
	delayFeedbackToGain,
	delayMixToSendGain,
	reverbDampingToLowpassHz,
	reverbMixToGain,
	reverbSizeToFeedbackGain
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
		readonly chorusSend: GainNode;
		readonly delaySend: GainNode;
		readonly delayNode: DelayNode;
		readonly reverbSend: GainNode;
		/** One representative comb filter's feedback/damping nodes -- every comb gets the identical treatment in `setPatch` (see `REVERB_COMB_DELAY_SECONDS`), so checking one confirms the pattern without exposing all three. */
		readonly representativeCombFeedback: GainNode;
		readonly representativeCombDamping: BiquadFilterNode;
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

	input.connect(chorusDry);
	input.connect(chorusSend);
	chorusSend.connect(chorusDelay);
	chorusLfo.connect(chorusLfoDepth);
	chorusLfoDepth.connect(chorusDelay.delayTime);
	chorusLfo.start(ctx.currentTime);
	chorusDry.connect(chorusOutput);
	chorusDelay.connect(chorusOutput);

	// --- Delay: one tempo-synced delay with feedback -----------------------
	const delayDry = ctx.createGain();
	const delaySend = ctx.createGain();
	delaySend.gain.setValueAtTime(0, ctx.currentTime);
	const delayNode = ctx.createDelay(MAX_DELAY_SECONDS);
	delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
	const delayFeedback = ctx.createGain();
	delayFeedback.gain.setValueAtTime(0, ctx.currentTime);
	const delayOutput = ctx.createGain();

	chorusOutput.connect(delayDry);
	chorusOutput.connect(delaySend);
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
			chorusSend,
			delaySend,
			delayNode,
			reverbSend,
			representativeCombFeedback: combStages[0].feedback,
			representativeCombDamping: combStages[0].damping
		}
	};
}
