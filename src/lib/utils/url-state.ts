import { listChords } from '$lib/music/chords';
import { defaultNoteName, noteNameToPitchClass, type PitchClass } from '$lib/music/pitch';

/**
 * A plain-data snapshot of the store fields worth sharing via URL. Kept
 * independent of the store itself (AGENTS.md §4: this is presentation-
 * boundary plumbing, not music theory) — the store maps to/from this shape.
 */
export interface URLState {
	root: PitchClass | null;
	chordId: string;
	displayMode: string;
	analysisMode: string;
}

const DEFAULT_CHORD_ID = 'major';
const DEFAULT_DISPLAY_MODE = 'intervals';
const DEFAULT_ANALYSIS_MODE = 'field';

const VALID_DISPLAY_MODES = new Set(['intervals', 'notes', 'both']);
const VALID_ANALYSIS_MODES = new Set(['chord-tones', 'field']);
const VALID_CHORD_IDS = new Set(listChords().map((chord) => chord.id));

/** Only sets a param when it differs from the default — keeps shared URLs short and readable. */
export function encodeStateToSearchParams(state: URLState): URLSearchParams {
	const params = new URLSearchParams();

	if (state.root !== null) params.set('root', defaultNoteName(state.root));
	if (state.chordId !== DEFAULT_CHORD_ID) params.set('chord', state.chordId);
	if (state.displayMode !== DEFAULT_DISPLAY_MODE) params.set('display', state.displayMode);
	if (state.analysisMode !== DEFAULT_ANALYSIS_MODE) params.set('analysis', state.analysisMode);

	return params;
}

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

	const chordId = params.get('chord');
	if (chordId !== null && VALID_CHORD_IDS.has(chordId)) result.chordId = chordId;

	const displayMode = params.get('display');
	if (displayMode !== null && VALID_DISPLAY_MODES.has(displayMode))
		result.displayMode = displayMode;

	const analysisMode = params.get('analysis');
	if (analysisMode !== null && VALID_ANALYSIS_MODES.has(analysisMode)) {
		result.analysisMode = analysisMode;
	}

	return result;
}
