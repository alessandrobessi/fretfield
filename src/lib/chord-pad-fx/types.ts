/**
 * The Chord Pad's FX rack -- plain data, no functions, no class instances,
 * round-trips through JSON unchanged (nested inside `Groove`, see
 * `groove/types.ts`). A separate domain from `$lib/acid-bass/` even though
 * both are Groove Engine accompaniment layers -- the chord pad has no
 * arrangement/pattern/step concept of its own (it just sustains whichever
 * chord the progression names, see `audio/chord-voices.ts`), so this is
 * FX-only state, not a full instrument patch.
 *
 * Stage 1 of 2 (user-requested, 2026-08): Reverb, Delay, Chorus. Phaser,
 * Flanger, and Tremolo are a deliberate, explicitly out-of-scope follow-up --
 * see ROADMAP.md.
 */

export type ChordPadDelayDivision = '1/4' | '1/8' | '1/8D' | '1/8T' | '1/16' | '1/16D' | '1/16T';

/** A small algorithmic (comb+allpass) reverb, not a convolution reverb -- see `audio/chord-pad-fx.ts`'s own doc comment for why. `enabled: false` or `mix: 0` must reproduce dry output exactly. */
export interface ChordPadReverbPatch {
	enabled: boolean;
	/** 0-100: each comb filter's own feedback gain -- higher reads as a bigger room with a longer-ringing tail (see `resolve.ts`'s `reverbSizeToFeedbackGain`). */
	size: number;
	/** 0-100: how quickly the tail darkens -- higher damping means a duller, less bright-sounding tail (see `resolve.ts`'s `reverbDampingToLowpassHz`). */
	damping: number;
	/** 0-100 wet mix. */
	mix: number;
}

/** One dedicated tempo-synced delay -- the same shape as `AcidDelayPatch` (`acid-bass/types.ts`), duplicated rather than shared since that type is explicitly scoped to Acid Bass only. `enabled: false` or `mix: 0` must reproduce dry output exactly. */
export interface ChordPadDelayPatch {
	enabled: boolean;
	division: ChordPadDelayDivision;
	/** 0-100 UI value; internally capped well below unity feedback (see `resolve.ts`'s `delayFeedbackToGain`). */
	feedback: number;
	/** 0-100 wet mix -- a send amount, not a dry/wet crossfade: the dry signal always stays at full level. */
	mix: number;
}

/** A single modulated short delay -- no feedback (feedback plus a short base delay is what turns this into a flanger instead, deliberately out of scope for this stage). `enabled: false` or `mix: 0` must reproduce dry output exactly. */
export interface ChordPadChorusPatch {
	enabled: boolean;
	/** Real Hz, not a 0-100 macro -- same convention as `AcidLfoPatch.rateHz` (`acid-bass/types.ts`); see `resolve.ts`'s `chorusRateHzClamp` for the valid range. */
	rate: number;
	/** 0-100: how far the delay time swings around its own fixed base value (see `resolve.ts`'s `chorusDepthToSeconds`). */
	depth: number;
	/** 0-100 wet mix. */
	mix: number;
}

export interface ChordPadFxState {
	/** The runtime discriminant `migrate.ts` uses -- `1` for as long as this is the only shape that has ever existed. */
	version: 1;
	reverb: ChordPadReverbPatch;
	delay: ChordPadDelayPatch;
	chorus: ChordPadChorusPatch;
}
