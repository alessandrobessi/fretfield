import { getChordDefinition } from '$lib/music/chords';
import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import {
	analyzeFretboard,
	type AnalyzedFretPosition,
	type HarmonicRole,
	roleCharacter
} from '$lib/music/harmony';
import { type IntervalId, intervalCompoundLabel, noteNameForPosition } from '$lib/music/intervals';
import {
	DEFAULT_REGION_WIDTH,
	type FretboardRegion,
	type LocalFieldAnalysis,
	findUsefulLocalFields
} from '$lib/music/local-fields';
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
	/** Local Field lens: null when no region is active (no dimming applied at all). */
	isInActiveRegion: boolean | null;
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
	regionWidth = $state<number>(DEFAULT_REGION_WIDTH);
	activeRegion = $state<FretboardRegion | null>(null);

	/** The one call into the engine per relevant state change (AGENTS.md §19); everything else derives from this. */
	readonly analyzed = $derived.by<AnalyzedFretPosition[] | null>(() => {
		const root = this.root;
		if (root === null) return null;
		return analyzeFretboard({
			tuning: this.tuning,
			fretCount: this.fretCount,
			root,
			chord: getChordDefinition(this.chordId)
		});
	});

	readonly rankedRegions = $derived.by<LocalFieldAnalysis[]>(() => {
		const analyzed = this.analyzed;
		if (analyzed === null) return [];
		return findUsefulLocalFields(analyzed, this.fretCount, this.regionWidth);
	});

	readonly positions = $derived.by<DisplayFretPosition[]>(() => {
		const root = this.root;
		const analyzed = this.analyzed;
		const region = this.activeRegion;

		if (root === null || analyzed === null) {
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
				isVisibleInMode: false,
				isInActiveRegion: null
			}));
		}

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
			isVisibleInMode: analysisMode === 'field' || CHORD_TONE_ROLES.has(position.role),
			isInActiveRegion:
				region === null ? null : position.fret >= region.minFret && position.fret <= region.maxFret
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

	setRegion(region: FretboardRegion | null): void {
		this.activeRegion = region;
	}

	/** Anchors a region on the exact fret the user clicked, per AGENTS.md §9's root-position distinction. */
	anchorRegionToSelectedRoot(): void {
		const selected = this.selectedRootPosition;
		if (selected === null) return;
		const match = this.rankedRegions.find(
			(r) => selected.fret >= r.region.minFret && selected.fret <= r.region.maxFret
		);
		this.activeRegion = match?.region ?? null;
	}

	nextRegion(): void {
		const regions = this.rankedRegions;
		if (regions.length === 0) return;
		const currentIndex = regions.findIndex((r) => r.region.id === this.activeRegion?.id);
		const next = regions[(currentIndex + 1) % regions.length];
		this.activeRegion = next.region;
	}

	previousRegion(): void {
		const regions = this.rankedRegions;
		if (regions.length === 0) return;
		const currentIndex = regions.findIndex((r) => r.region.id === this.activeRegion?.id);
		const previous = regions[(currentIndex - 1 + regions.length) % regions.length];
		this.activeRegion = previous.region;
	}

	clearRegion(): void {
		this.activeRegion = null;
	}
}

export const fretfield = new FretFieldStore();
