import { listChords } from '$lib/music/chords';
import { defaultNoteName, noteNameToPitchClass, type PitchClass } from '$lib/music/pitch';
import { listProgressionTemplates } from '$lib/music/progressions';

/**
 * A plain-data snapshot of the store fields worth sharing via URL. Kept
 * independent of the store itself (AGENTS.md §4: this is presentation-
 * boundary plumbing, not music theory) — the store maps to/from this shape.
 */
export interface URLState {
	root: PitchClass | null;
	mode: string;
	chordId: string;
	displayMode: string;
	analysisMode: string;
	progressionTemplateId: string | null;
	activeChordIndex: number;
	pathPreset: string;
	region: { minFret: number; maxFret: number } | null;
}

const DEFAULT_MODE = 'chord';
const DEFAULT_CHORD_ID = 'major';
const DEFAULT_DISPLAY_MODE = 'intervals';
const DEFAULT_ANALYSIS_MODE = 'field';
const DEFAULT_ACTIVE_CHORD_INDEX = 0;
const DEFAULT_PATH_PRESET = 'balanced';

const VALID_MODES = new Set(['chord', 'progression', 'paths', 'local']);
const VALID_DISPLAY_MODES = new Set(['intervals', 'notes', 'both']);
const VALID_ANALYSIS_MODES = new Set(['chord-tones', 'field']);
const VALID_PATH_PRESETS = new Set(['balanced', 'minimal-movement', 'guide-tones']);
const VALID_CHORD_IDS = new Set(listChords().map((chord) => chord.id));
const VALID_PROGRESSION_IDS = new Set(listProgressionTemplates().map((template) => template.id));

/** Only sets a param when it differs from the default — keeps shared URLs short and readable. */
export function encodeStateToSearchParams(state: URLState): URLSearchParams {
	const params = new URLSearchParams();

	if (state.root !== null) params.set('root', defaultNoteName(state.root));
	if (state.mode !== DEFAULT_MODE) params.set('mode', state.mode);
	if (state.chordId !== DEFAULT_CHORD_ID) params.set('chord', state.chordId);
	if (state.displayMode !== DEFAULT_DISPLAY_MODE) params.set('display', state.displayMode);
	if (state.analysisMode !== DEFAULT_ANALYSIS_MODE) params.set('analysis', state.analysisMode);
	if (state.progressionTemplateId !== null) {
		params.set('progression', state.progressionTemplateId);
	}
	if (state.activeChordIndex !== DEFAULT_ACTIVE_CHORD_INDEX) {
		params.set('chordIndex', String(state.activeChordIndex));
	}
	if (state.pathPreset !== DEFAULT_PATH_PRESET) params.set('pathPreset', state.pathPreset);
	if (state.region !== null) {
		params.set('region', `${state.region.minFret}-${state.region.maxFret}`);
	}

	return params;
}

const REGION_PATTERN = /^(\d+)-(\d+)$/;

/**
 * Decodes only the fields present and valid in `params`. Never throws on a
 * malformed/unknown URL — invalid or missing fields are simply omitted, so
 * the caller falls back to its own defaults rather than the app breaking on
 * a hand-edited or stale link.
 */
export function decodeStateFromSearchParams(params: URLSearchParams): Partial<URLState> {
	const result: Partial<URLState> = {};

	const rootParam = params.get('root');
	if (rootParam !== null) {
		try {
			result.root = noteNameToPitchClass(rootParam);
		} catch {
			// invalid note name — omit
		}
	}

	const mode = params.get('mode');
	if (mode !== null && VALID_MODES.has(mode)) result.mode = mode;

	const chordId = params.get('chord');
	if (chordId !== null && VALID_CHORD_IDS.has(chordId)) result.chordId = chordId;

	const displayMode = params.get('display');
	if (displayMode !== null && VALID_DISPLAY_MODES.has(displayMode))
		result.displayMode = displayMode;

	const analysisMode = params.get('analysis');
	if (analysisMode !== null && VALID_ANALYSIS_MODES.has(analysisMode)) {
		result.analysisMode = analysisMode;
	}

	const progressionTemplateId = params.get('progression');
	if (progressionTemplateId !== null && VALID_PROGRESSION_IDS.has(progressionTemplateId)) {
		result.progressionTemplateId = progressionTemplateId;
	}

	const activeChordIndex = params.get('chordIndex');
	if (activeChordIndex !== null) {
		const parsed = Number(activeChordIndex);
		if (Number.isInteger(parsed) && parsed >= 0) result.activeChordIndex = parsed;
	}

	const pathPreset = params.get('pathPreset');
	if (pathPreset !== null && VALID_PATH_PRESETS.has(pathPreset)) result.pathPreset = pathPreset;

	const region = params.get('region');
	if (region !== null) {
		const match = REGION_PATTERN.exec(region);
		if (match) {
			const minFret = Number(match[1]);
			const maxFret = Number(match[2]);
			if (minFret <= maxFret) result.region = { minFret, maxFret };
		}
	}

	return result;
}
