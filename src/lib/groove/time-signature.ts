/**
 * Every time signature a groove can be set to. One per groove, applied to
 * every pattern (A/B/F/T) uniformly -- there is no per-bar/mixed-meter
 * concept (see AGENTS.md).
 *
 * A "step" is always a 16th note at the groove's own BPM, in every meter,
 * including the compound ones -- BPM always means the quarter-note pulse,
 * so switching time signature never silently redefines what the Tempo
 * field means. What changes per meter is only how many steps make one bar,
 * and how those steps group into felt beats (`stepsPerBeatGroup`, used for
 * both the step grid's visual beat markers and swing placement).
 */
export type TimeSignature = '3/4' | '4/4' | '5/4' | '6/8' | '9/8' | '12/8';

export interface TimeSignatureInfo {
	label: string;
	/** Total 16th-note steps in one bar of this meter. */
	stepsPerBar: number;
	/** How many steps make one felt beat -- 4 (a 16th-note-subdivided quarter note) for simple meters, 6 (three 16th-note-pairs = three eighth notes = a dotted quarter) for compound ones. */
	stepsPerBeatGroup: number;
	/** Compound meters (the /8 ones) already carry their own triplet-like 3-against-2 feel -- swing/Feel-Amount are inert on top of that (see AGENTS.md). */
	isCompound: boolean;
}

export const TIME_SIGNATURES: Record<TimeSignature, TimeSignatureInfo> = {
	'3/4': { label: '3/4', stepsPerBar: 12, stepsPerBeatGroup: 4, isCompound: false },
	'4/4': { label: '4/4', stepsPerBar: 16, stepsPerBeatGroup: 4, isCompound: false },
	'5/4': { label: '5/4', stepsPerBar: 20, stepsPerBeatGroup: 4, isCompound: false },
	'6/8': { label: '6/8', stepsPerBar: 12, stepsPerBeatGroup: 6, isCompound: true },
	'9/8': { label: '9/8', stepsPerBar: 18, stepsPerBeatGroup: 6, isCompound: true },
	'12/8': { label: '12/8', stepsPerBar: 24, stepsPerBeatGroup: 6, isCompound: true }
};

const TIME_SIGNATURE_ORDER: readonly TimeSignature[] = ['3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];

export function listTimeSignatures(): readonly TimeSignature[] {
	return TIME_SIGNATURE_ORDER;
}
