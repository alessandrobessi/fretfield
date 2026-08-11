import { getChordDefinition } from '$lib/music/chords';
import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import { analyzeFretboard, type HarmonicRole, roleCharacter } from '$lib/music/harmony';
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
 * Chord Field has two views over the same analysis: 'chord-tones' shows only
 * root/structural/stable for beginners and fast reference; 'field' shows the
 * full nine-role Harmonic Field. Both read the same `positions` — this is a
 * display filter, not a different computation.
 */
export type AnalysisMode = 'chord-tones' | 'field';

const CHORD_TONE_ROLES: ReadonlySet<HarmonicRole> = new Set(['root', 'structural', 'stable']);

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
	roleDescription: string | null;
	stability: number | null;
	tension: number | null;
	typicalResolutionLabels: string[];
	isRootPitchClass: boolean;
	isSelectedRootPosition: boolean;
	/** Whether this role is visible in the current AnalysisMode (chord-tones vs. field). */
	isVisibleInMode: boolean;
}

class FretFieldStore {
	readonly tuning: Tuning = STANDARD_4_STRING_TUNING;
	readonly fretCount: number = DEFAULT_FRET_COUNT;

	mode = $state<FieldMode>('chord');
	analysisMode = $state<AnalysisMode>('field');
	root = $state<PitchClass | null>(null);
	selectedRootPosition = $state<FretPosition | null>(null);
	inspectedPosition = $state<FretPosition | null>(null);
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
				roleDescription: null,
				stability: null,
				tension: null,
				typicalResolutionLabels: [],
				isRootPitchClass: false,
				isSelectedRootPosition: false,
				isVisibleInMode: false
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
		const analysisMode = this.analysisMode;

		return analyzed.map((position) => ({
			...position,
			intervalLabel: intervalCompoundLabel(position.interval),
			noteName: noteNameForPosition(root, position.pitchClass),
			roleDescription: roleCharacter(position.role),
			typicalResolutionLabels: position.typicalResolutions.map((interval) =>
				intervalCompoundLabel(interval)
			),
			isRootPitchClass: position.pitchClass === root,
			isSelectedRootPosition:
				selected !== null &&
				selected.stringIndex === position.stringIndex &&
				selected.fret === position.fret,
			isVisibleInMode: analysisMode === 'field' || CHORD_TONE_ROLES.has(position.role)
		}));
	});

	readonly positionsByString = $derived.by<DisplayFretPosition[][]>(() => {
		const groups: DisplayFretPosition[][] = Array.from({ length: this.tuning.length }, () => []);
		for (const position of this.positions) {
			groups[position.stringIndex].push(position);
		}
		return groups;
	});

	readonly inspected = $derived.by<DisplayFretPosition | null>(() => {
		const inspected = this.inspectedPosition;
		if (inspected === null) return null;
		return (
			this.positions.find(
				(p) => p.stringIndex === inspected.stringIndex && p.fret === inspected.fret
			) ?? null
		);
	});

	setMode(mode: FieldMode): void {
		this.mode = mode;
	}

	setAnalysisMode(mode: AnalysisMode): void {
		this.analysisMode = mode;
	}

	selectRoot(position: FretPosition): void {
		this.root = position.pitchClass;
		this.selectedRootPosition = position;
	}

	inspect(position: FretPosition): void {
		this.inspectedPosition = position;
	}

	setChord(chordId: string): void {
		this.chordId = chordId;
	}

	setDisplayMode(mode: DisplayMode): void {
		this.displayMode = mode;
	}
}

export const fretfield = new FretFieldStore();
