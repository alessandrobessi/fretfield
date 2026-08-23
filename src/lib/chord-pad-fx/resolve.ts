/**
 * Pure macro -> DSP math for the Chord Pad's FX rack -- no `AudioContext`, no
 * Svelte, the same "pure conversion functions live in resolve.ts, the actual
 * node graph lives in audio/chord-pad-fx.ts" split `acid-bass/resolve.ts`
 * already established.
 */

import type { ChordPadDelayDivision } from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Reverb -- a small comb+allpass network (see audio/chord-pad-fx.ts's own doc
// comment for why this is algorithmic, not convolution). Each comb filter's
// own delay time is a fixed tuning constant (audio/chord-pad-fx.ts), spread
// apart to avoid metallic ringing -- "Size" instead controls feedback gain
// (how long the tail rings), the same mapping real Freeverb-style reverbs use.
// ---------------------------------------------------------------------------

// Held below unity so the comb filters' feedback loops can never sustain or
// grow indefinitely -- same "feedback safety" doctrine as Acid Bass's own
// delay (`acid-bass/delay.ts`'s `MAX_DELAY_FEEDBACK`). The floor keeps even
// the smallest room audibly reverberant rather than reading as "off" (that's
// `enabled`/`mix`'s own job).
const MIN_REVERB_FEEDBACK = 0.6;
const MAX_REVERB_FEEDBACK = 0.9;

/** 0-100 Size -> each comb filter's own feedback gain. */
export function reverbSizeToFeedbackGain(size: number): number {
	const t = clamp(size, 0, 100) / 100;
	return MIN_REVERB_FEEDBACK + t * (MAX_REVERB_FEEDBACK - MIN_REVERB_FEEDBACK);
}

const MIN_REVERB_DAMPING_HZ = 1000;
const MAX_REVERB_DAMPING_HZ = 18000;

/** 0-100 Damping -> each comb filter's feedback-loop lowpass cutoff -- higher damping reads as a darker, duller tail. */
export function reverbDampingToLowpassHz(damping: number): number {
	const t = clamp(damping, 0, 100) / 100;
	return MAX_REVERB_DAMPING_HZ - t * (MAX_REVERB_DAMPING_HZ - MIN_REVERB_DAMPING_HZ);
}

/** 0-100 wet mix -> linear gain, the same shape the delay/chorus mixes below share. */
export function reverbMixToGain(mix: number): number {
	return clamp(mix, 0, 100) / 100;
}

// ---------------------------------------------------------------------------
// Delay -- identical shape to acid-bass/delay.ts, duplicated rather than
// imported (that file is explicitly scoped to Acid Bass only).
// ---------------------------------------------------------------------------

const DELAY_DIVISION_BEATS: Record<ChordPadDelayDivision, number> = {
	'1/4': 1,
	'1/8': 0.5,
	'1/8D': 0.5 * 1.5,
	'1/8T': 0.5 * (2 / 3),
	'1/16': 0.25,
	'1/16D': 0.25 * 1.5,
	'1/16T': 0.25 * (2 / 3)
};

/** Derives the delay's own time from the Groove transport's current BPM and a musical division -- never an independent clock, the same pattern Acid Bass's own `delayDivisionToSeconds` established. */
export function delayDivisionToSeconds(bpm: number, division: ChordPadDelayDivision): number {
	const beats = DELAY_DIVISION_BEATS[division];
	const secondsPerBeat = 60 / bpm;
	return beats * secondsPerBeat;
}

const MAX_DELAY_FEEDBACK = 0.85;

/** 0-100 UI value -> the actual feedback gain applied inside the delay's own feedback loop, capped well below unity. */
export function delayFeedbackToGain(value: number): number {
	return (clamp(value, 0, 100) / 100) * MAX_DELAY_FEEDBACK;
}

/** 0-100 UI value -> the linear send gain feeding the delay line. A genuine send, not a dry/wet crossfade -- `mix: 0` sends nothing into the delay, reproducing dry output exactly. */
export function delayMixToSendGain(value: number): number {
	return clamp(value, 0, 100) / 100;
}

// ---------------------------------------------------------------------------
// Chorus -- one modulated short delay, no feedback (see
// `ChordPadChorusPatch`'s own doc comment for why).
// ---------------------------------------------------------------------------

const MIN_CHORUS_RATE_HZ = 0.1;
const MAX_CHORUS_RATE_HZ = 5;

/** Same "clamp an already-Hz value" shape as `acid-bass/resolve.ts`'s own `lfoRateHzClamp` -- the patch stores real Hz directly, not a 0-100 macro. */
export function chorusRateHzClamp(value: number): number {
	return clamp(value, MIN_CHORUS_RATE_HZ, MAX_CHORUS_RATE_HZ);
}

const MAX_CHORUS_DEPTH_SECONDS = 0.008;

/** 0-100 Depth -> how far the delay time swings around its own fixed base value (audio/chord-pad-fx.ts). */
export function chorusDepthToSeconds(depth: number): number {
	return (clamp(depth, 0, 100) / 100) * MAX_CHORUS_DEPTH_SECONDS;
}

/** 0-100 wet mix -> linear gain. */
export function chorusMixToGain(mix: number): number {
	return clamp(mix, 0, 100) / 100;
}
