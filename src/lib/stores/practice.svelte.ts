import type { DetectedNote } from '$lib/audio/types';
import {
	STANDARD_4_STRING_ABSOLUTE_TUNING,
	findFretPositionsForMidi
} from '$lib/music/absolute-pitch';
import type { FretPosition } from '$lib/music/fretboard';
import type { IntervalId } from '$lib/music/intervals';
import {
	advanceToNextExercise,
	isContextCompatible,
	recordAttempt,
	startSession,
	stopSession,
	updateSettings
} from '$lib/practice/practice-engine';
import {
	computePracticeStats,
	createIdleSession,
	type HintLevel,
	type PracticeContext,
	type PracticeResult,
	type PracticeSession,
	type PracticeMode,
	type PracticeStats
} from '$lib/practice/types';
import { fretfield } from '$lib/stores/fretfield.svelte';
import { readJSON, writeJSON } from '$lib/utils/local-storage';

const STORAGE_KEY = 'fretfield-practice-session';

/**
 * Guided Practice's orchestration layer: the only place that reads
 * `fretfield`'s and `liveInput`'s current state to build a `PracticeContext`
 * and drive the pure session engine in `$lib/practice`. Owns no harmonic or
 * audio logic itself — it decides *when* to call the engine, never *how* to
 * evaluate a note or generate an exercise.
 *
 * Deliberately effect-free: this store exposes state + imperative methods
 * only (matching `fretfield.svelte.ts`/`live-input.svelte.ts`'s existing
 * pattern of no `$effect` inside a module-level singleton). The UI layer
 * (`GuidedPracticeControls.svelte`) owns the `$effect`s that call
 * `handleDetectedNote`/`refreshIfStale` in response to `liveInput`/`fretfield`
 * changes.
 */
class PracticeStore {
	session = $state<PracticeSession>(readJSON(STORAGE_KEY, createIdleSession()));

	constructor() {
		// Restored from a previous visit: fretfield.mode (URL-persisted) may
		// not agree with which lens this exercise actually needs, since the
		// two are restored independently. `start()` already guarantees this
		// alignment for a fresh session — give a restored one the same
		// guarantee once, up front.
		if (this.session.status === 'active' && this.session.currentExercise !== null) {
			this.syncFieldMode(this.session.mode);
			this.syncActiveChordIndex();
		}
	}

	readonly stats = $derived.by<PracticeStats>(() => computePracticeStats(this.session.attempts));

	/** Every fret that satisfies the current exercise's primary target(s) — only populated at the 'positions' hint level (§11); the fretboard's own hint gate. */
	readonly targetPositions = $derived.by<FretPosition[]>(() => {
		if (this.session.settings.hintLevel !== 'positions') return [];
		const exercise = this.session.currentExercise;
		if (exercise === null) return [];
		return exercise.targets.flatMap((target) => target.positions);
	});

	/** Every fret that could have produced the last-played note, while feedback for it is actually showing — reuses the same MIDI→fret mapping Live Input uses, not a new one. */
	readonly lastPlayedPositions = $derived.by<FretPosition[]>(() => {
		if (this.session.exerciseStatus !== 'feedback') return [];
		const evaluation = this.session.lastEvaluation;
		if (evaluation === null) return [];
		return findFretPositionsForMidi(
			STANDARD_4_STRING_ABSOLUTE_TUNING,
			fretfield.fretCount,
			evaluation.played.midi
		);
	});

	readonly lastResult = $derived.by<PracticeResult | null>(() => {
		if (this.session.exerciseStatus !== 'feedback') return null;
		return this.session.lastEvaluation?.result ?? null;
	});

	/** `interval` pins the generated exercise's target instead of picking one — see `StartSessionOptions`. */
	start(mode: PracticeMode, options: { interval?: IntervalId } = {}): void {
		const context = this.buildContext();
		this.session = startSession(mode, context, this.session.settings, {
			path: fretfield.selectedPath,
			interval: options.interval
		});
		this.syncFieldMode(mode);
		this.syncActiveChordIndex();
		this.persist();
	}

	stop(): void {
		this.session = stopSession(this.session.settings);
		this.persist();
	}

	next(): void {
		const context = this.buildContext();
		this.session = advanceToNextExercise(this.session, context, { path: fretfield.selectedPath });
		this.syncActiveChordIndex();
		this.persist();
	}

	setHintLevel(level: HintLevel): void {
		this.session = updateSettings(this.session, { hintLevel: level });
		this.persist();
	}

	setLocalFieldOnly(value: boolean): void {
		this.session = updateSettings(this.session, { localFieldOnly: value });
		this.persist();
	}

	/** Called by the UI layer whenever Live Input confirms a genuinely new note — never on raw audio frames (see `liveInput.noteOnsetId`). */
	handleDetectedNote(note: DetectedNote): void {
		this.session = recordAttempt(this.session, note);
		this.persist();
	}

	/** Called by the UI layer when the harmonic context Guided Practice is watching (root/progression) might have changed underneath the current exercise. Regenerates rather than silently evaluating against a stale target (product spec §13). */
	refreshIfStale(): void {
		const exercise = this.session.currentExercise;
		if (exercise === null || this.session.status !== 'active') return;

		const context = this.buildContext();
		if (!isContextCompatible(exercise, context)) {
			this.session = startSession(this.session.mode, context, this.session.settings, {
				path: fretfield.selectedPath
			});
			this.syncActiveChordIndex();
			this.persist();
		}
	}

	private persist(): void {
		writeJSON(STORAGE_KEY, this.session);
	}

	private buildContext(): PracticeContext {
		return {
			tuning: fretfield.tuning,
			fretCount: fretfield.fretCount,
			root: fretfield.root,
			chordId: fretfield.chordId,
			progression: fretfield.resolvedProgression.map(({ root, chordId }) => ({ root, chordId })),
			activeChordIndex: fretfield.activeChordIndex,
			selectedPath: fretfield.selectedPath,
			region: fretfield.activeRegion,
			localFieldOnly: this.session.settings.localFieldOnly
		};
	}

	/** Guided Practice reuses whichever Field mode already renders the right lens for each exercise type, rather than a second fretboard (product spec §10). */
	private syncFieldMode(mode: PracticeMode): void {
		switch (mode) {
			case 'find-interval':
			case 'find-chord-tone':
				fretfield.setMode('chord');
				break;
			case 'resolve-note':
				fretfield.setMode('progression');
				break;
			case 'follow-path':
				fretfield.setMode('paths');
				break;
		}
	}

	/** Follow Path advances its own step index; keeping the main store's active chord in sync means the existing ProgressionStrip/pathRole visuals (and Live Input's path-aware position inference) track the exercise for free. */
	private syncActiveChordIndex(): void {
		const exercise = this.session.currentExercise;
		if (exercise !== null && exercise.prompt.kind === 'follow-path') {
			fretfield.setActiveChordIndex(exercise.prompt.stepIndex);
		}
	}
}

export const practice = new PracticeStore();
