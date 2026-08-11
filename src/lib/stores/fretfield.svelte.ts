import { getChordDefinition } from '$lib/music/chords';
import type { NoteConnection } from '$lib/music/connection-score';
import { createFretboard, type FretPosition } from '$lib/music/fretboard';
import {
	analyzeFretboard,
	analyzeInterval,
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
import {
	type ResolvedChord,
	buildProgression,
	getProgressionTemplate,
	resolvedChordSymbol
} from '$lib/music/progressions';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import { type ChordTransition, analyzeTransition, connectionFor } from '$lib/music/voice-leading';
import {
	type PathPreset,
	type VoiceLeadingPath,
	findVoiceLeadingPaths
} from '$lib/music/voice-leading-paths';
import type { URLState } from '$lib/utils/url-state';

export type { PathPreset };

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
	/** Voice-Leading Paths lens: this position's role in the selected path, if any. */
	pathRole: 'previous' | 'current' | 'next' | null;
}

/** A progression chord enriched with its display symbol, for the ProgressionStrip. */
export interface DisplayResolvedChord extends ResolvedChord {
	symbol: string;
}

/** A ranked voice-leading path with per-step note names, for PathSelector. */
export interface DisplayVoiceLeadingPath {
	noteNames: string[];
	score: VoiceLeadingPath['score'];
}

/** The inspected note's connection into the next progression chord, formatted for display. */
export interface DisplayNoteConnection {
	currentIntervalLabel: string;
	currentRoleLabel: string;
	commonTone: boolean;
	bestTargetNoteName: string;
	bestTargetIntervalLabel: string;
	bestTargetRoleLabel: string;
	semitoneMovement: number;
	nextChordSymbol: string;
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
	progressionTemplateId = $state<string | null>(null);
	activeChordIndex = $state(0);
	pathPreset = $state<PathPreset>('balanced');
	selectedPathIndex = $state<number | null>(null);

	readonly resolvedProgression = $derived.by<DisplayResolvedChord[]>(() => {
		const root = this.root;
		const templateId = this.progressionTemplateId;
		if (root === null || templateId === null) return [];
		return buildProgression(root, getProgressionTemplate(templateId)).map((chord) => ({
			...chord,
			symbol: resolvedChordSymbol(chord)
		}));
	});

	readonly activeProgressionChord = $derived.by<DisplayResolvedChord | null>(() => {
		return this.resolvedProgression[this.activeChordIndex] ?? null;
	});

	/** The current->next transition, wrapping to the first chord after the last (a practice loop). */
	readonly currentTransition = $derived.by<ChordTransition | null>(() => {
		const progression = this.resolvedProgression;
		if (this.mode !== 'progression' || progression.length < 2) return null;
		const current = progression[this.activeChordIndex];
		const next = progression[(this.activeChordIndex + 1) % progression.length];
		return analyzeTransition(current, next);
	});

	readonly rankedPaths = $derived.by<VoiceLeadingPath[]>(() => {
		if (this.mode !== 'paths') return [];
		const progression = this.resolvedProgression;
		if (progression.length < 2) return [];
		return findVoiceLeadingPaths(progression, this.tuning, this.fretCount, {
			preset: this.pathPreset,
			region: this.activeRegion ?? undefined,
			k: 3
		});
	});

	readonly displayRankedPaths = $derived.by<DisplayVoiceLeadingPath[]>(() => {
		const progression = this.resolvedProgression;
		return this.rankedPaths.map((path) => ({
			noteNames: path.positions.map((position, i) =>
				noteNameForPosition(progression[i].root, position.pitchClass)
			),
			score: path.score
		}));
	});

	readonly selectedPath = $derived.by<VoiceLeadingPath | null>(() => {
		const paths = this.rankedPaths;
		if (paths.length === 0) return null;
		const index = this.selectedPathIndex;
		return paths[index !== null && index < paths.length ? index : 0];
	});

	/** The one call into the engine per relevant state change (AGENTS.md §19); everything else derives from this. */
	readonly analyzed = $derived.by<AnalyzedFretPosition[] | null>(() => {
		if (this.mode === 'progression' || this.mode === 'paths') {
			const chord = this.activeProgressionChord;
			if (chord === null) return null;
			return analyzeFretboard({
				tuning: this.tuning,
				fretCount: this.fretCount,
				root: chord.root,
				chord: getChordDefinition(chord.chordId)
			});
		}
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
		const analyzed = this.analyzed;
		const region = this.activeRegion;

		if (analyzed === null) {
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
				isInActiveRegion: null,
				pathRole: null
			}));
		}

		const usesProgressionRoot = this.mode === 'progression' || this.mode === 'paths';
		// The "root" for display-spelling/highlight purposes: the progression's
		// active chord root in Progression Field/Paths, otherwise the selected root.
		const displayRoot = usesProgressionRoot
			? (this.activeProgressionChord?.root ?? null)
			: this.root;
		const selected = this.selectedRootPosition;
		const analysisMode = this.analysisMode;

		const path = this.mode === 'paths' ? this.selectedPath : null;
		const pathLength = path?.positions.length ?? 0;
		const pathPositionAt = (offset: number): FretPosition | null => {
			if (path === null || pathLength === 0) return null;
			const index = (((this.activeChordIndex + offset) % pathLength) + pathLength) % pathLength;
			return path.positions[index];
		};
		const currentPathPosition = pathPositionAt(0);
		const previousPathPosition = pathPositionAt(-1);
		const nextPathPosition = pathPositionAt(1);
		const matchesPosition = (target: FretPosition | null, position: FretPosition): boolean =>
			target !== null &&
			target.stringIndex === position.stringIndex &&
			target.fret === position.fret;

		return analyzed.map((position) => ({
			...position,
			intervalLabel: intervalCompoundLabel(position.interval),
			noteName:
				displayRoot === null
					? defaultNoteName(position.pitchClass)
					: noteNameForPosition(displayRoot, position.pitchClass),
			roleDescription: roleCharacter(position.role),
			typicalResolutionLabels: position.typicalResolutions.map((interval) =>
				intervalCompoundLabel(interval)
			),
			isRootPitchClass: displayRoot !== null && position.pitchClass === displayRoot,
			isSelectedRootPosition:
				!usesProgressionRoot &&
				selected !== null &&
				selected.stringIndex === position.stringIndex &&
				selected.fret === position.fret,
			isVisibleInMode: analysisMode === 'field' || CHORD_TONE_ROLES.has(position.role),
			isInActiveRegion:
				region === null ? null : position.fret >= region.minFret && position.fret <= region.maxFret,
			pathRole: matchesPosition(currentPathPosition, position)
				? 'current'
				: matchesPosition(previousPathPosition, position)
					? 'previous'
					: matchesPosition(nextPathPosition, position)
						? 'next'
						: null
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

	/** The inspected note's connection into the next progression chord, when applicable. */
	readonly inspectedConnection = $derived.by<NoteConnection | null>(() => {
		const transition = this.currentTransition;
		const inspected = this.inspected;
		if (transition === null || inspected === null) return null;
		return connectionFor(transition, inspected.pitchClass);
	});

	readonly inspectedConnectionDisplay = $derived.by<DisplayNoteConnection | null>(() => {
		const connection = this.inspectedConnection;
		const progression = this.resolvedProgression;
		if (connection === null || connection.targets.length === 0 || progression.length < 2) {
			return null;
		}
		const nextChord = progression[(this.activeChordIndex + 1) % progression.length];
		const nextChordDef = getChordDefinition(nextChord.chordId);
		const best = connection.targets[0];

		return {
			currentIntervalLabel: intervalCompoundLabel(connection.currentInterval),
			currentRoleLabel: roleCharacter(connection.currentRole),
			commonTone: connection.commonTone,
			bestTargetNoteName: noteNameForPosition(nextChord.root, best.targetPitchClass),
			bestTargetIntervalLabel: intervalCompoundLabel(best.targetInterval),
			bestTargetRoleLabel: roleCharacter(analyzeInterval(nextChordDef, best.targetInterval)),
			semitoneMovement: best.semitoneMovement,
			nextChordSymbol: nextChord.symbol
		};
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

	setProgressionTemplate(templateId: string | null): void {
		this.progressionTemplateId = templateId;
		this.activeChordIndex = 0;
	}

	setActiveChordIndex(index: number): void {
		const length = this.resolvedProgression.length;
		if (length === 0) return;
		this.activeChordIndex = ((index % length) + length) % length;
	}

	nextChord(): void {
		this.setActiveChordIndex(this.activeChordIndex + 1);
	}

	previousChord(): void {
		this.setActiveChordIndex(this.activeChordIndex - 1);
	}

	setPathPreset(preset: PathPreset): void {
		this.pathPreset = preset;
		this.selectedPathIndex = null;
	}

	selectPath(index: number): void {
		this.selectedPathIndex = index;
	}

	/** A plain-data snapshot of the shareable fields, for URL serialization (src/lib/utils/url-state.ts). */
	toURLState(): URLState {
		return {
			root: this.root,
			mode: this.mode,
			chordId: this.chordId,
			displayMode: this.displayMode,
			analysisMode: this.analysisMode,
			progressionTemplateId: this.progressionTemplateId,
			activeChordIndex: this.activeChordIndex,
			pathPreset: this.pathPreset,
			region: this.activeRegion
				? { minFret: this.activeRegion.minFret, maxFret: this.activeRegion.maxFret }
				: null
		};
	}

	/** Applies whichever fields are present in a decoded URL state — see decodeStateFromSearchParams. */
	restoreFromURLState(state: Partial<URLState>): void {
		if (state.root !== undefined) this.root = state.root;
		if (state.mode !== undefined) this.mode = state.mode as FieldMode;
		if (state.chordId !== undefined) this.chordId = state.chordId;
		if (state.displayMode !== undefined) this.displayMode = state.displayMode as DisplayMode;
		if (state.analysisMode !== undefined) this.analysisMode = state.analysisMode as AnalysisMode;
		if (state.progressionTemplateId !== undefined) {
			this.progressionTemplateId = state.progressionTemplateId;
		}
		if (state.activeChordIndex !== undefined) this.activeChordIndex = state.activeChordIndex;
		if (state.pathPreset !== undefined) this.pathPreset = state.pathPreset as PathPreset;
		if (state.region !== undefined) {
			const region = state.region;
			this.activeRegion = region && {
				id: `region-${region.minFret}-${region.maxFret}`,
				minFret: region.minFret,
				maxFret: region.maxFret
			};
		}
	}
}

export const fretfield = new FretFieldStore();
