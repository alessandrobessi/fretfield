import type { ChordPadFxState } from './types';

/** Everything off, with sane knob defaults for the moment a player turns one on -- an existing or migrated groove must sound identical to today until then, matching every other new-modulation precedent in this app. */
export function createDefaultChordPadFxState(): ChordPadFxState {
	return {
		version: 2,
		reverb: { enabled: false, size: 40, damping: 40, mix: 30 },
		delay: { enabled: false, division: '1/8', feedback: 30, mix: 25 },
		chorus: { enabled: false, rate: 0.8, depth: 40, mix: 35 },
		phaser: { enabled: false, rate: 0.3, depth: 50, mix: 35 },
		flanger: { enabled: false, rate: 0.25, depth: 50, feedback: 40, mix: 35 },
		tremolo: { enabled: false, rate: 4, depth: 40 }
	};
}
