import { getChordDefinition } from '$lib/music/chords';
import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import { analyzeFretboard, type HarmonicRole } from '$lib/music/harmony';
import { type IntervalId, intervalCompoundLabel, noteNameForPosition } from '$lib/music/intervals';
import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';

export type DisplayMode = 'intervals' | 'notes' | 'both';

/**
 * The four user-facing questions FretField answers. Shared state (root,
 * display mode, region, progression selection) persists across mode
 * switches — each mode is a different lens on the same selection, not a
 * separate page with its own state.
 */
export type FieldMode = 'chord' | 'progression' | 'paths' | 'local';

/**
 * A fret position enriched with everything a component needs to render it —
 * the store is the only place that calls into `$lib/music`, per AGENTS.md §4.
 */
export interface DisplayFretPosition extends FretPosition {
	interval: IntervalId | null;
	intervalLabel: string | null;
	noteName: string;
	chordTone: boolean;
	role: HarmonicRole | null;
	isRootPitchClass: boolean;
	isSelectedRootPosition: boolean;
}

class FretFieldStore {
	readonly tuning: Tuning = STANDARD_4_STRING_TUNING;
	readonly fretCount: number = DEFAULT_FRET_COUNT;

	mode = $state<FieldMode>('chord');
	root = $state<PitchClass | null>(null);
	selectedRootPosition = $state<FretPosition | null>(null);
	chordId = $state('major');
	displayMode = $state<DisplayMode>('intervals');

	readonly positions = $derived.by<DisplayFretPosition[]>(() => {
		const root = this.root;

		if (root === null) {
			return createFretboard(this.tuning, this.fretCount).map((position) => ({
				...position,
				interval: null,
				intervalLabel: null,
				noteName: defaultNoteName(position.pitchClass),
				chordTone: false,
				role: null,
				isRootPitchClass: false,
				isSelectedRootPosition: false
			}));
		}

		const chord = getChordDefinition(this.chordId);
		const analyzed = analyzeFretboard({
			tuning: this.tuning,
			fretCount: this.fretCount,
			root,
			chord
		});
		const selected = this.selectedRootPosition;

		return analyzed.map((position) => ({
			...position,
			intervalLabel: intervalCompoundLabel(position.interval),
			noteName: noteNameForPosition(root, position.pitchClass),
			isRootPitchClass: position.pitchClass === root,
			isSelectedRootPosition:
				selected !== null &&
				selected.stringIndex === position.stringIndex &&
				selected.fret === position.fret
		}));
	});

	readonly positionsByString = $derived.by<DisplayFretPosition[][]>(() => {
		const groups: DisplayFretPosition[][] = Array.from({ length: this.tuning.length }, () => []);
		for (const position of this.positions) {
			groups[position.stringIndex].push(position);
		}
		return groups;
	});

	setMode(mode: FieldMode): void {
		this.mode = mode;
	}

	selectRoot(position: FretPosition): void {
		this.root = position.pitchClass;
		this.selectedRootPosition = position;
	}

	setChord(chordId: string): void {
		this.chordId = chordId;
	}

	setDisplayMode(mode: DisplayMode): void {
		this.displayMode = mode;
	}
}

export const fretfield = new FretFieldStore();
