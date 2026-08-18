import { matchesTarget } from '$lib/audio/note-mapping';
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
import {
	type IntervalId,
	intervalCompoundLabel,
	intervalFromRoot,
	noteNameForPosition
} from '$lib/music/intervals';
import {
	DEFAULT_REGION_WIDTH,
	type FretboardRegion,
	type LocalFieldAnalysis,
	findUsefulLocalFields
} from '$lib/music/local-fields';
import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
import { liveInput } from '$lib/stores/live-input.svelte';
import {
	type ResolvedChord,
	buildProgression,
	getProgressionTemplate,
	resolvedChordSymbol
} from '$lib/music/progressions';
import { getScaleDefinition, scaleContainsPitchClass, suggestedScalesFor } from '$lib/music/scales';
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
 * The five user-facing questions FretField answers. Shared state (root,
 * display mode, region, progression selection) persists across mode
 * switches — each mode is a different lens on the same selection, not a
 * separate page with its own state. `scale-blocks` is the one exception:
 * it's a simultaneous, multi-chord view rather than a single-chord lens, so
 * it owns its own `chordBlocks` state instead of reusing root/chordId.
 */
export type FieldMode =
	| 'chord'
	| 'progression'
	| 'paths'
	| 'local'
	| 'scale-blocks'
	| 'scale-practice'
	| 'progression-scales'
	| 'scale';

/**
 * One independently-configured chord in Scale Blocks mode: its own root,
 * chord quality, and the scale being overlaid for it. `null` fields mean
 * "not yet chosen" — a block only contributes to the fretboard once all
 * three are set.
 */
export interface ChordBlock {
	id: string;
	root: PitchClass | null;
	chordId: string | null;
	scaleId: string | null;
}

export const MAX_CHORD_BLOCKS = 8;

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
	/** Live Input layer: this position produces the exact pitch currently sounding. Composes with role/region/path styling — never replaces it. */
	isLivePlayed: boolean;
	/** Live Input layer: this is the one candidate inferLivePosition() judged most likely, when the pitch is ambiguous. */
	isLiveLikely: boolean;
	/** Progression Field's Live Input layer (§13): this position is the best resolution target for the currently-played note. */
	isLiveNextTarget: boolean;
	/** Scale Blocks: indices into `chordBlocks` of every fully-configured block whose scale contains this pitch class. Always empty outside `scale-blocks` mode. */
	scaleBlockMembership: number[];
	/** Scale Blocks: this pitch class is in every configured block's scale (never true with fewer than 2 configured blocks). */
	isScaleBlockCommonNote: boolean;
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

/** The currently-playing note, spelled for display — independent of which Field mode is active. */
export interface DisplayLiveNote {
	noteName: string;
	frequencyHz: number;
	cents: number;
	octave: number;
}

/** Chord Field's reading of the live-played note (§12): reuses the exact same role/interval engine as the static fretboard. */
export interface DisplayLiveChordInterpretation {
	noteName: string;
	intervalLabel: string;
	roleLabel: string;
}

/** Progression Field's reading of the live-played note (§13): reuses the existing connection/resolution engine — no separate resolution rules. */
export interface DisplayLiveProgressionInterpretation {
	noteName: string;
	intervalLabel: string;
	roleLabel: string;
	commonTone: boolean;
	bestTargetNoteName: string | null;
	bestTargetIntervalLabel: string | null;
	semitoneMovement: number | null;
	nextChordSymbol: string;
}

/** Voice-Leading Paths' reading of the live-played note (§14): did it match the current step's expected pitch? */
export interface DisplayLivePathMatch {
	expectedNoteName: string;
	detectedNoteName: string;
	matched: boolean;
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
	chordBlocks = $state<ChordBlock[]>([]);
	/** Progression Scales lens: per-chord-index override, keyed by position in `resolvedProgression`. `undefined` (absent key) means "use the family-suggested default"; an explicit `null` means the user cleared it. */
	progressionScaleOverrides = $state<Record<number, string | null>>({});
	/** Explore -> Scale: a single freestanding root/scale, independent of any chord or progression — session-only, same precedent as Scale Blocks/Scale Practice. */
	exploreScaleRoot = $state<PitchClass | null>(null);
	exploreScaleId = $state<string | null>(null);

	constructor() {
		// Live Input needs Voice-Leading Path/Local Field context to disambiguate
		// a detected pitch, but must stay ignorant of this store to avoid a
		// circular dependency — so it pulls context through an injected getter
		// instead of importing fretfield.svelte.ts itself.
		liveInput.setContextProvider(() => ({
			voiceLeadingPathPosition:
				this.mode === 'paths'
					? (this.selectedPath?.positions[this.activeChordIndex] ?? null)
					: null,
			localFieldRegion: this.activeRegion
		}));
	}

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

	/** Progression Scales lens (§5 of the 1.0 restructure): one block per progression chord, defaulting to that chord family's top suggested scale, overridable per chord. Reuses the exact ChordBlock shape Scale Blocks already renders. */
	readonly progressionScaleBlocks = $derived.by<ChordBlock[]>(() => {
		return this.resolvedProgression.map((chord, index) => {
			const override = this.progressionScaleOverrides[index];
			const scaleId =
				override !== undefined ? override : (suggestedScalesFor(chord.chordId)[0]?.id ?? null);
			return {
				id: `progression-scale-${index}`,
				root: chord.root,
				chordId: chord.chordId,
				scaleId
			};
		});
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
		// Scale Blocks and Progression Scales have no single shared chord to
		// analyze roles against — each block/chord has its own. Scale Practice
		// and the standalone Scale explorer have no chord at all, just a
		// scale/key(/zone). All four want the fallback branch below (plain
		// note names, no role) rather than a special case.
		if (
			this.mode === 'scale-blocks' ||
			this.mode === 'scale-practice' ||
			this.mode === 'progression-scales' ||
			this.mode === 'scale'
		) {
			return null;
		}
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

	/**
	 * The set of root+scale overlays currently active on the fretboard, from
	 * whichever of the three sources is live: Scale Blocks' manually-built
	 * blocks, Progression Scales' auto-suggested-per-chord blocks, or Explore
	 * -> Scale's single freestanding root+scale. Consolidated here so
	 * `positions` below has one membership/common-note computation instead of
	 * three near-identical copies.
	 */
	readonly activeScaleOverlays = $derived.by<{ root: PitchClass; scaleId: string }[]>(() => {
		if (this.mode === 'scale-blocks') {
			return this.chordBlocks
				.filter(
					(block): block is ChordBlock & { root: PitchClass; scaleId: string } =>
						block.root !== null && block.chordId !== null && block.scaleId !== null
				)
				.map((block) => ({ root: block.root, scaleId: block.scaleId }));
		}
		if (this.mode === 'progression-scales') {
			return this.progressionScaleBlocks
				.filter(
					(block): block is ChordBlock & { root: PitchClass; scaleId: string } =>
						block.root !== null && block.scaleId !== null
				)
				.map((block) => ({ root: block.root, scaleId: block.scaleId }));
		}
		if (this.mode === 'scale' && this.exploreScaleRoot !== null && this.exploreScaleId !== null) {
			return [{ root: this.exploreScaleRoot, scaleId: this.exploreScaleId }];
		}
		return [];
	});

	readonly positions = $derived.by<DisplayFretPosition[]>(() => {
		const analyzed = this.analyzed;
		const region = this.activeRegion;

		const liveCandidates = liveInput.candidatePositions;
		const liveLikely = liveInput.likelyPosition;
		const liveNextTarget = this.liveNextTargetPitchClass;
		const isLivePlayedPosition = (position: FretPosition): boolean =>
			liveCandidates.some(
				(c) => c.stringIndex === position.stringIndex && c.fret === position.fret
			);
		const isLiveLikelyPosition = (position: FretPosition): boolean =>
			liveLikely !== null &&
			liveLikely.stringIndex === position.stringIndex &&
			liveLikely.fret === position.fret;
		const isLiveNextTargetPosition = (position: FretPosition): boolean =>
			liveNextTarget !== null && position.pitchClass === liveNextTarget;

		const activeOverlays = this.activeScaleOverlays;
		const scaleBlockMembershipFor = (position: FretPosition): number[] =>
			activeOverlays
				.map((overlay, index) => ({ overlay, index }))
				.filter(({ overlay }) =>
					scaleContainsPitchClass(
						overlay.root,
						getScaleDefinition(overlay.scaleId),
						position.pitchClass
					)
				)
				.map(({ index }) => index);
		const isScaleBlockCommonNoteFor = (position: FretPosition): boolean =>
			activeOverlays.length >= 2 &&
			scaleBlockMembershipFor(position).length === activeOverlays.length;

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
				pathRole: null,
				isLivePlayed: isLivePlayedPosition(position),
				isLiveLikely: isLiveLikelyPosition(position),
				isLiveNextTarget: isLiveNextTargetPosition(position),
				scaleBlockMembership: scaleBlockMembershipFor(position),
				isScaleBlockCommonNote: isScaleBlockCommonNoteFor(position)
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
						: null,
			isLivePlayed: isLivePlayedPosition(position),
			isLiveLikely: isLiveLikelyPosition(position),
			isLiveNextTarget: isLiveNextTargetPosition(position),
			scaleBlockMembership: scaleBlockMembershipFor(position),
			isScaleBlockCommonNote: isScaleBlockCommonNoteFor(position)
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

	/** Progression Field (§13): the played note's best resolution target, by pitch class — used to emphasize that fret on the board, not just describe it in text. */
	readonly liveNextTargetPitchClass = $derived.by<PitchClass | null>(() => {
		const note = liveInput.detectedNote;
		const transition = this.currentTransition;
		if (note === null || transition === null) return null;
		const connection = connectionFor(transition, note.pitchClass);
		return connection.targets[0]?.targetPitchClass ?? null;
	});

	/** The currently-playing note, spelled against whatever root is on screen right now. Independent of mode. */
	readonly liveNote = $derived.by<DisplayLiveNote | null>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return null;
		const usesProgressionRoot = this.mode === 'progression' || this.mode === 'paths';
		const displayRoot = usesProgressionRoot
			? (this.activeProgressionChord?.root ?? null)
			: this.root;
		return {
			noteName:
				displayRoot === null
					? defaultNoteName(note.pitchClass)
					: noteNameForPosition(displayRoot, note.pitchClass),
			frequencyHz: note.frequencyHz,
			cents: note.cents,
			octave: note.octave
		};
	});

	/** Chord Field's interpretation of the live-played note (§12) — reuses `analyzeInterval`, never a parallel role table. */
	readonly liveChordInterpretation = $derived.by<DisplayLiveChordInterpretation | null>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return null;
		const usesProgressionRoot = this.mode === 'progression' || this.mode === 'paths';
		const root = usesProgressionRoot ? (this.activeProgressionChord?.root ?? null) : this.root;
		const chordId = usesProgressionRoot ? this.activeProgressionChord?.chordId : this.chordId;
		if (root === null || chordId === undefined) return null;

		const interval = intervalFromRoot(root, note.pitchClass);
		const role = analyzeInterval(getChordDefinition(chordId), interval);
		return {
			noteName: noteNameForPosition(root, note.pitchClass),
			intervalLabel: intervalCompoundLabel(interval),
			roleLabel: roleCharacter(role)
		};
	});

	/** Progression Field's interpretation of the live-played note (§13) — reuses the existing connection/resolution engine. */
	readonly liveProgressionInterpretation = $derived.by<DisplayLiveProgressionInterpretation | null>(
		() => {
			const note = liveInput.detectedNote;
			const transition = this.currentTransition;
			const progression = this.resolvedProgression;
			if (note === null || transition === null || progression.length < 2) return null;

			const connection = connectionFor(transition, note.pitchClass);
			const currentChord = progression[this.activeChordIndex];
			const nextChord = progression[(this.activeChordIndex + 1) % progression.length];
			const best = connection.targets[0] ?? null;

			return {
				noteName: noteNameForPosition(currentChord.root, note.pitchClass),
				intervalLabel: intervalCompoundLabel(connection.currentInterval),
				roleLabel: roleCharacter(connection.currentRole),
				commonTone: connection.commonTone,
				bestTargetNoteName: best
					? noteNameForPosition(nextChord.root, best.targetPitchClass)
					: null,
				bestTargetIntervalLabel: best ? intervalCompoundLabel(best.targetInterval) : null,
				semitoneMovement: best ? best.semitoneMovement : null,
				nextChordSymbol: nextChord.symbol
			};
		}
	);

	/** Voice-Leading Paths' interpretation of the live-played note (§14): matches the current step's expected pitch, no auto-advance. */
	readonly livePathMatch = $derived.by<DisplayLivePathMatch | null>(() => {
		const note = liveInput.detectedNote;
		const path = this.selectedPath;
		if (note === null || path === null || this.mode !== 'paths') return null;

		const progression = this.resolvedProgression;
		const expectedPosition = path.positions[this.activeChordIndex];
		if (!expectedPosition) return null;
		const expectedRoot = progression[this.activeChordIndex]?.root ?? null;
		const spell = (pitchClass: PitchClass): string =>
			expectedRoot === null
				? defaultNoteName(pitchClass)
				: noteNameForPosition(expectedRoot, pitchClass);

		return {
			expectedNoteName: spell(expectedPosition.pitchClass),
			detectedNoteName: spell(note.pitchClass),
			matched: matchesTarget(note, expectedPosition.pitchClass)
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

	/** Sets the root by pitch class alone, with no specific fret in mind — same pattern `restoreFromURLState` already uses. For callers (Practice Presets) that care which note is the root, not which string/fret represents it. */
	setRootPitchClass(root: PitchClass | null): void {
		this.root = root;
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

	/** Scale Blocks state is intentionally session-only (no URL persistence), same precedent as Guided Practice — resets on reload. */
	addChordBlock(): void {
		if (this.chordBlocks.length >= MAX_CHORD_BLOCKS) return;
		this.chordBlocks = [
			...this.chordBlocks,
			{ id: crypto.randomUUID(), root: null, chordId: null, scaleId: null }
		];
	}

	removeChordBlock(id: string): void {
		this.chordBlocks = this.chordBlocks.filter((block) => block.id !== id);
	}

	setChordBlockRoot(id: string, root: PitchClass | null): void {
		this.chordBlocks = this.chordBlocks.map((block) =>
			block.id === id ? { ...block, root } : block
		);
	}

	setChordBlockChord(id: string, chordId: string | null): void {
		this.chordBlocks = this.chordBlocks.map((block) =>
			block.id === id ? { ...block, chordId } : block
		);
	}

	setChordBlockScale(id: string, scaleId: string | null): void {
		this.chordBlocks = this.chordBlocks.map((block) =>
			block.id === id ? { ...block, scaleId } : block
		);
	}

	/** Progression Scales state is intentionally session-only too, same precedent as Scale Blocks — resets on reload. */
	setProgressionScaleOverride(chordIndex: number, scaleId: string | null): void {
		this.progressionScaleOverrides = { ...this.progressionScaleOverrides, [chordIndex]: scaleId };
	}

	clearProgressionScaleOverride(chordIndex: number): void {
		const next = { ...this.progressionScaleOverrides };
		delete next[chordIndex];
		this.progressionScaleOverrides = next;
	}

	setExploreScaleRoot(root: PitchClass | null): void {
		this.exploreScaleRoot = root;
	}

	setExploreScaleId(scaleId: string | null): void {
		this.exploreScaleId = scaleId;
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
