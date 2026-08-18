import { createMetronomeClick, type MetronomeClick } from '$lib/audio/metronome';
import type { FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';
import { getScaleDefinition, type ScaleDefinition } from '$lib/music/scales';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import { positionsForPitchClass, scalePositions } from '$lib/scale-practice/positions';
import type { PracticeZone } from '$lib/scale-practice/types';
import { liveInput } from '$lib/stores/live-input.svelte';

const DEFAULT_BPM = 80;
const MIN_BPM = 30;
const MAX_BPM = 240;

function msPerBeat(bpm: number): number {
	return 60_000 / bpm;
}

function clampBpm(bpm: number): number {
	return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/**
 * Owns Scale Practice's two independent pieces: which notes of the chosen
 * scale/zone are shown (`scalePositions`/`playedPositions`, always live,
 * regardless of the metronome), and the metronome itself (`running`/`bpm`,
 * a simple click — it no longer drives any target/evaluation logic). Kept
 * as its own store rather than a `PracticeMode` inside `$lib/practice` —
 * that engine's types and AGENTS.md §26 doctrine are both explicitly
 * chord/progression-shaped and timer-free; this store is scale/zone/tempo-
 * shaped and owns the app's only audio *output* scheduling.
 *
 * The scheduler is a self-correcting `setTimeout` loop so the click doesn't
 * drift over a long session, even though nothing else depends on its exact
 * timing anymore.
 */
export class ScalePracticeStore {
	root = $state<PitchClass | null>(null);
	scaleId = $state<string | null>(null);
	zone = $state<PracticeZone>({ minFret: 0, maxFret: 12 });
	bpm = $state(DEFAULT_BPM);
	running = $state(false);

	private readonly tuning: Tuning;
	private readonly fretCount: number;
	private click: MetronomeClick | null = null;
	private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
	private nextBeatAtMs: number | null = null;

	constructor(tuning: Tuning = STANDARD_4_STRING_TUNING, fretCount: number = DEFAULT_FRET_COUNT) {
		this.tuning = tuning;
		this.fretCount = fretCount;
	}

	readonly scale = $derived.by<ScaleDefinition | null>(() =>
		this.scaleId === null ? null : getScaleDefinition(this.scaleId)
	);

	/** Every position in the zone belonging to the scale — the whole scale, shown at once. */
	readonly scalePositions = $derived.by<FretPosition[]>(() => {
		if (this.root === null || this.scale === null) return [];
		return scalePositions(this.root, this.scale, this.zone, this.tuning, this.fretCount);
	});

	/** Whatever's currently sounding, live — clears itself the moment Live Input stops detecting a note. */
	readonly playedPositions = $derived.by<FretPosition[]>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return [];
		return positionsForPitchClass(note.pitchClass, this.zone, this.tuning, this.fretCount);
	});

	setRoot(root: PitchClass | null): void {
		this.root = root;
	}

	setScaleId(scaleId: string | null): void {
		this.scaleId = scaleId;
	}

	setZone(minFret: number, maxFret: number): void {
		this.zone = { minFret, maxFret };
	}

	setBpm(bpm: number): void {
		this.bpm = clampBpm(bpm);
	}

	/** Starts (or stops) only the metronome click — has no effect on which notes are highlighted. */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.click = createMetronomeClick();

		const now = Date.now();
		this.nextBeatAtMs = now + msPerBeat(this.bpm);
		this.timeoutHandle = setTimeout(() => this.tick(), this.nextBeatAtMs - now);
	}

	stop(): void {
		this.running = false;
		if (this.timeoutHandle !== null) {
			clearTimeout(this.timeoutHandle);
			this.timeoutHandle = null;
		}
		this.click?.dispose();
		this.click = null;
		this.nextBeatAtMs = null;
	}

	private tick(): void {
		if (!this.running || this.nextBeatAtMs === null) return;
		this.click?.playClick();
		// Reschedules from the fixed beat grid, not from `Date.now()` at fire
		// time — this is what keeps long-run drift from accumulating even
		// though `setTimeout` itself is never perfectly precise.
		this.nextBeatAtMs += msPerBeat(this.bpm);
		const delay = Math.max(0, this.nextBeatAtMs - Date.now());
		this.timeoutHandle = setTimeout(() => this.tick(), delay);
	}
}

export const scalePractice = new ScalePracticeStore();
