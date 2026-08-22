/**
 * Tempo-synced delay (Acid Bass Intelligence V4 §35/M17) -- one dedicated
 * delay, not a general effects rack (see `AcidDelayPatch`'s own doc
 * comment). Only the pure division/feedback/mix math lives here; the actual
 * `DelayNode`/feedback-loop/wet-send graph is built once in
 * `acid-bass-voice.ts`, inserted after Drive and before master Output (the
 * milestone's own explicit placement), reusing that file's *existing*
 * `setTempo()` hook rather than a second clock (spec: "no new clock").
 */

import type { AcidDelayDivision } from './types';

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// Expressed as a fraction of one quarter-note beat -- the same unit
// `acid-bass-voice.ts`'s LFO sync (`lfoSyncFrequencyHz`'s own
// `DIVISION_BEATS`) already uses. Dotted divisions (1.5x their straight
// counterpart) are new here -- the LFO's own division set has none.
const DELAY_DIVISION_BEATS: Record<AcidDelayDivision, number> = {
	'1/4': 1,
	'1/8': 0.5,
	'1/8D': 0.5 * 1.5,
	'1/8T': 0.5 * (2 / 3),
	'1/16': 0.25,
	'1/16D': 0.25 * 1.5,
	'1/16T': 0.25 * (2 / 3)
};

/** Derives the delay's own time from the Groove transport's current BPM and a musical division -- never an independent clock (spec: "Use current setTempo()", "no new clock"), the same pattern `lfoSyncFrequencyHz` already established for the LFOs. */
export function delayDivisionToSeconds(bpm: number, division: AcidDelayDivision): number {
	const beats = DELAY_DIVISION_BEATS[division];
	const secondsPerBeat = 60 / bpm;
	return beats * secondsPerBeat;
}

// Held well below unity (1.0) so the feedback loop can never sustain or
// grow indefinitely -- spec: "feedback safety" is one of this milestone's
// own required test categories.
const MAX_DELAY_FEEDBACK = 0.85;

/** 0-100 UI value -> the actual feedback gain applied inside the delay's own feedback loop, capped well below unity (spec's own `AcidDelayPatch.feedback` doc comment). */
export function delayFeedbackToGain(value: number): number {
	return (clamp(value, 0, 100) / 100) * MAX_DELAY_FEEDBACK;
}

/** 0-100 UI value -> the linear send gain feeding the delay line. A genuine send (the dry signal stays at full level always, see `acid-bass-voice.ts`'s own routing), not a dry/wet crossfade -- `mix: 0` sends nothing into the delay, reproducing dry output exactly. */
export function delayMixToSendGain(value: number): number {
	return clamp(value, 0, 100) / 100;
}
