import { getChordDefinition } from '$lib/music/chords';
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
import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
import { liveInput } from '$lib/stores/live-input.svelte';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import type { URLState } from '$lib/utils/url-state';

export type DisplayMode = 'intervals' | 'notes' | 'both';

/**
 * The two remaining lenses on the fretboard: Chord Field ("what can I play
 * now?") and Scale Practice ("can you play this scale in time?"). `mode` has
 * no user-facing switcher anymore — Explore only ever shows Chord Field, and
 * Practice only ever shows Scale Practice — but `FretCell.svelte` and
 * `NoteInspector.svelte` both key their rendering off it, so it stays as an
 * internal "which layer is currently mounted" flag. `ScalePracticeSession.svelte`
 * sets it on mount and reverts it on unmount; it does not persist (no
 * localStorage, no URL round-trip) since which one is active is fully
 * determined by which tab you're on, not a user choice to remember.
 */
export type FieldMode = 'chord' | 'scale-practice';

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
	/** Live Input layer: this position produces the exact pitch currently sounding. Composes with role styling — never replaces it. */
	isLivePlayed: boolean;
	/** Live Input layer: this is the one candidate inferLivePosition() judged most likely, when the pitch is ambiguous. */
	isLiveLikely: boolean;
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

	readonly positions = $derived.by<DisplayFretPosition[]>(() => {
		const analyzed = this.analyzed;

		const liveCandidates = liveInput.candidatePositions;
		const liveLikely = liveInput.likelyPosition;
		const isLivePlayedPosition = (position: FretPosition): boolean =>
			liveCandidates.some(
				(c) => c.stringIndex === position.stringIndex && c.fret === position.fret
			);
		const isLiveLikelyPosition = (position: FretPosition): boolean =>
			liveLikely !== null &&
			liveLikely.stringIndex === position.stringIndex &&
			liveLikely.fret === position.fret;

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
				isLivePlayed: isLivePlayedPosition(position),
				isLiveLikely: isLiveLikelyPosition(position)
			}));
		}

		const root = this.root;
		const selected = this.selectedRootPosition;
		const analysisMode = this.analysisMode;

		return analyzed.map((position) => ({
			...position,
			intervalLabel: intervalCompoundLabel(position.interval),
			noteName:
				root === null
					? defaultNoteName(position.pitchClass)
					: noteNameForPosition(root, position.pitchClass),
			roleDescription: roleCharacter(position.role),
			typicalResolutionLabels: position.typicalResolutions.map((interval) =>
				intervalCompoundLabel(interval)
			),
			isRootPitchClass: root !== null && position.pitchClass === root,
			isSelectedRootPosition:
				selected !== null &&
				selected.stringIndex === position.stringIndex &&
				selected.fret === position.fret,
			isVisibleInMode: analysisMode === 'field' || CHORD_TONE_ROLES.has(position.role),
			isLivePlayed: isLivePlayedPosition(position),
			isLiveLikely: isLiveLikelyPosition(position)
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

	/** The currently-playing note, spelled against the selected root. Independent of mode. */
	readonly liveNote = $derived.by<DisplayLiveNote | null>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return null;
		const root = this.root;
		return {
			noteName:
				root === null
					? defaultNoteName(note.pitchClass)
					: noteNameForPosition(root, note.pitchClass),
			frequencyHz: note.frequencyHz,
			cents: note.cents,
			octave: note.octave
		};
	});

	/** Chord Field's interpretation of the live-played note (§12) — reuses `analyzeInterval`, never a parallel role table. */
	readonly liveChordInterpretation = $derived.by<DisplayLiveChordInterpretation | null>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return null;
		const root = this.root;
		if (root === null) return null;

		const interval = intervalFromRoot(root, note.pitchClass);
		const role = analyzeInterval(getChordDefinition(this.chordId), interval);
		return {
			noteName: noteNameForPosition(root, note.pitchClass),
			intervalLabel: intervalCompoundLabel(interval),
			roleLabel: roleCharacter(role)
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

	/** Sets the root by pitch class alone, with no specific fret in mind — same pattern `restoreFromURLState` already uses. */
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

	/** A plain-data snapshot of the shareable fields, for URL serialization (src/lib/utils/url-state.ts). */
	toURLState(): URLState {
		return {
			root: this.root,
			chordId: this.chordId,
			displayMode: this.displayMode,
			analysisMode: this.analysisMode
		};
	}

	/** Applies whichever fields are present in a decoded URL state — see decodeStateFromSearchParams. */
	restoreFromURLState(state: Partial<URLState>): void {
		if (state.root !== undefined) this.root = state.root;
		if (state.chordId !== undefined) this.chordId = state.chordId;
		if (state.displayMode !== undefined) this.displayMode = state.displayMode as DisplayMode;
		if (state.analysisMode !== undefined) this.analysisMode = state.analysisMode as AnalysisMode;
	}
}

export const fretfield = new FretFieldStore();
