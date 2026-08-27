/**
 * Radio Mode's "director" (user-requested, 2026-08 -- an autonomous 24/7
 * stream to promote FretField on YouTube): periodically rolls a brand-new
 * root/progression/groove/bass-style/tempo combo and applies it to a
 * running `ScalePracticeStore`, so the app keeps sounding different for
 * hours with nobody at the controls.
 *
 * Deliberately decoupled from the concrete store: `createRadioDirector`
 * takes a small `RadioDirectorDeps` interface (five setters) rather than
 * `ScalePracticeStore` itself, and `pickNextCombo` is a pure function of
 * "what was picked last" plus an injected `random` source -- both testable
 * without a real `AudioContext` or even a real store instance. `start()`
 * itself is just a thin `setInterval` wrapper around that pure logic.
 */

import type { BasslineStyleId } from '$lib/music/bassline/types';
import { normalizePitchClass, type PitchClass } from '$lib/music/pitch';
import { listProgressionTemplates } from '$lib/music/progressions';
import { listGroovePresets } from '$lib/groove/presets';
import type { Groove } from '$lib/groove/types';

export interface RadioDirectorDeps {
	setRoot(root: PitchClass): void;
	setProgressionTemplate(id: string): void;
	setGroove(groove: Groove): void;
	setAcidBassGenerationStyle(style: BasslineStyleId): void;
	setBpm(bpm: number): void;
}

export interface RadioCombo {
	root: PitchClass;
	progressionId: string;
	groovePresetId: string;
	bassStyle: BasslineStyleId;
	bpm: number;
}

const BASSLINE_STYLES: readonly BasslineStyleId[] = [
	'rooted',
	'funk',
	'acid',
	'chromatic',
	'melodic',
	'walking'
];

// Every groove preset except 'click' -- that's the bare-metronome preset,
// not a real genre, and has no business showing up on an autonomous stream.
const GROOVE_PRESET_IDS: readonly string[] = listGroovePresets()
	.map((preset) => preset.id)
	.filter((id) => id !== 'click');

const PROGRESSION_TEMPLATE_IDS: readonly string[] = listProgressionTemplates().map((t) => t.id);

const ROOT_POOL: readonly PitchClass[] = Array.from({ length: 12 }, (_, semitone) =>
	normalizePitchClass(semitone)
);

/**
 * Genre-appropriate BPM range per groove preset -- a flat global range
 * (say 70-140) would put bossa nova at drum-and-bass speed just as often as
 * the reverse. Deliberately a plain lookup table local to this file, not a
 * new field on `GroovePreset` itself -- this is a Radio-only concern, not
 * a property of the groove preset data model.
 */
const TEMPO_RANGE_BY_GROOVE_PRESET: Readonly<Record<string, readonly [number, number]>> = {
	'straight-rock': [90, 120],
	'blues-shuffle': [80, 110],
	'jazz-swing': [100, 140],
	funk: [95, 115],
	'chicago-shuffle': [80, 100],
	house: [118, 128],
	techno: [125, 145],
	'drum-and-bass': [160, 175],
	trance: [130, 145],
	rnb: [70, 95],
	'bossa-nova': [110, 130]
};
const DEFAULT_TEMPO_RANGE: readonly [number, number] = [90, 130];

function tempoRangeForGroovePreset(id: string): readonly [number, number] {
	return TEMPO_RANGE_BY_GROOVE_PRESET[id] ?? DEFAULT_TEMPO_RANGE;
}

function pickRandom<T>(pool: readonly T[], random: () => number): T {
	return pool[Math.floor(random() * pool.length) % pool.length];
}

/** Rerolls until the pick differs from `previous` -- a no-op guardrail whenever the pool has only one option. */
function pickDifferent<T>(pool: readonly T[], previous: T | null, random: () => number): T {
	if (pool.length <= 1) return pool[0];
	let pick = pickRandom(pool, random);
	while (pick === previous) pick = pickRandom(pool, random);
	return pick;
}

function randomInRange([min, max]: readonly [number, number], random: () => number): number {
	return Math.round(min + random() * (max - min));
}

/**
 * Pure: picks the next combo given whatever was picked last (`null` for the
 * very first pick, which skips every no-repeat guardrail). `random` defaults
 * to `Math.random` but is always overridable, for deterministic tests.
 */
export function pickNextCombo(
	previous: RadioCombo | null,
	random: () => number = Math.random
): RadioCombo {
	const root = pickDifferent(ROOT_POOL, previous?.root ?? null, random);
	const progressionId = pickDifferent(
		PROGRESSION_TEMPLATE_IDS,
		previous?.progressionId ?? null,
		random
	);
	const groovePresetId = pickDifferent(GROOVE_PRESET_IDS, previous?.groovePresetId ?? null, random);
	const bassStyle = pickDifferent(BASSLINE_STYLES, previous?.bassStyle ?? null, random);
	const bpm = randomInRange(tempoRangeForGroovePreset(groovePresetId), random);

	return { root, progressionId, groovePresetId, bassStyle, bpm };
}

// How long one combo stays on air before the next roll -- long enough to
// actually settle into a groove, short enough that a stream viewer sees
// real variety within a few minutes of tuning in.
const MIN_SEGMENT_SECONDS = 90;
const MAX_SEGMENT_SECONDS = 180;
const POLL_INTERVAL_MS = 5000;

function randomSegmentMs(random: () => number): number {
	return randomInRange([MIN_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS], random) * 1000;
}

export interface RadioDirectorOptions {
	random?: () => number;
	/** Called right after every rotation (including the immediate one on `start()`) -- the page's own hook for reactively updating its "now playing" text, since this plain module has no Svelte reactivity of its own. */
	onRotate?: (combo: RadioCombo) => void;
}

export interface RadioDirector {
	start(): void;
	stop(): void;
	/** Whatever combo is currently on air, or `null` before the first `start()`. Read by the visualizer's "now playing" overlay. */
	readonly current: RadioCombo | null;
}

export function createRadioDirector(
	deps: RadioDirectorDeps,
	options: RadioDirectorOptions = {}
): RadioDirector {
	const { random = Math.random, onRotate } = options;
	let current: RadioCombo | null = null;
	let nextRotationAt = 0;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function applyCombo(combo: RadioCombo): void {
		const groovePreset = listGroovePresets().find((preset) => preset.id === combo.groovePresetId);
		if (groovePreset === undefined) return;

		deps.setRoot(combo.root);
		deps.setProgressionTemplate(combo.progressionId);
		deps.setGroove(groovePreset.groove);
		deps.setAcidBassGenerationStyle(combo.bassStyle);
		deps.setBpm(combo.bpm);
	}

	function rotate(): void {
		current = pickNextCombo(current, random);
		nextRotationAt = Date.now() + randomSegmentMs(random);
		applyCombo(current);
		onRotate?.(current);
	}

	function poll(): void {
		if (Date.now() >= nextRotationAt) rotate();
	}

	return {
		start() {
			if (intervalId !== null) return;
			rotate();
			intervalId = setInterval(poll, POLL_INTERVAL_MS);
		},
		stop() {
			if (intervalId !== null) clearInterval(intervalId);
			intervalId = null;
		},
		get current() {
			return current;
		}
	};
}
