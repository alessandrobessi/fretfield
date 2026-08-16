import { createMetronomeClick, type MetronomeClick } from '$lib/audio/metronome';
import type { DetectedNote } from '$lib/audio/types';
import type { FretPosition } from '$lib/music/fretboard';
import type { PitchClass } from '$lib/music/pitch';
import { getScaleDefinition, type ScaleDefinition } from '$lib/music/scales';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import { evaluateBeat } from '$lib/scale-practice/evaluation';
import { buildScaleSequence, positionsForPitchClass } from '$lib/scale-practice/sequence';
import type { BeatResult, PracticeZone } from '$lib/scale-practice/types';

const DEFAULT_BPM = 80;
const MIN_BPM = 30;
const MAX_BPM = 240;
const TOLERANCE_MS = 120;

function msPerBeat(bpm: number): number {
	return 60_000 / bpm;
}

function clampBpm(bpm: number): number {
	return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/**
 * Owns the metronome-driven Scale Practice session: root/scale/zone/tempo
 * selection, the beat scheduler, and per-beat evaluation. Deliberately its
 * own store rather than a `PracticeMode` inside `$lib/practice` — that
 * engine's types and AGENTS.md §26 doctrine are both explicitly chord/
 * progression-shaped and timer-free; this store is scale/zone/tempo-shaped
 * and owns the app's only audio *output* scheduling.
 *
 * The scheduler is a self-correcting `setTimeout` loop driven by `Date.now()`
 * (not `AudioContext.currentTime`) specifically so beat timestamps are
 * directly comparable to `DetectedNote.timestampMs`, which is also
 * `Date.now()`-based — no clock correlation is needed.
 */
export class ScalePracticeStore {
	root = $state<PitchClass | null>(null);
	scaleId = $state<string | null>(null);
	zone = $state<PracticeZone>({ minFret: 0, maxFret: 12 });
	bpm = $state(DEFAULT_BPM);
	running = $state(false);
	stepIndex = $state(0);
	lastBeatResult = $state<BeatResult | null>(null);

	private readonly tuning: Tuning;
	private readonly fretCount: number;
	private click: MetronomeClick | null = null;
	private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
	private nextBeatAtMs: number | null = null;
	/** The first note played since the last beat wins — one attempt per click, matching a real metronome drill. */
	private pendingNote: DetectedNote | null = null;

	constructor(tuning: Tuning = STANDARD_4_STRING_TUNING, fretCount: number = DEFAULT_FRET_COUNT) {
		this.tuning = tuning;
		this.fretCount = fretCount;
	}

	readonly scale = $derived.by<ScaleDefinition | null>(() =>
		this.scaleId === null ? null : getScaleDefinition(this.scaleId)
	);

	readonly sequence = $derived.by<PitchClass[]>(() => {
		if (this.root === null || this.scale === null) return [];
		return buildScaleSequence(this.root, this.scale, this.zone, this.tuning, this.fretCount);
	});

	readonly currentTarget = $derived.by<PitchClass | null>(() => {
		const sequence = this.sequence;
		return sequence.length === 0 ? null : sequence[this.stepIndex % sequence.length];
	});

	readonly currentTargetPositions = $derived.by<FretPosition[]>(() => {
		const target = this.currentTarget;
		return target === null
			? []
			: positionsForPitchClass(target, this.zone, this.tuning, this.fretCount);
	});

	setRoot(root: PitchClass | null): void {
		this.root = root;
		this.stepIndex = 0;
		this.lastBeatResult = null;
	}

	setScaleId(scaleId: string | null): void {
		this.scaleId = scaleId;
		this.stepIndex = 0;
		this.lastBeatResult = null;
	}

	setZone(minFret: number, maxFret: number): void {
		this.zone = { minFret, maxFret };
		this.stepIndex = 0;
	}

	setBpm(bpm: number): void {
		this.bpm = clampBpm(bpm);
	}

	/** No-op if already running or there's nothing to practice (empty sequence — e.g. the zone excludes every degree of the chosen scale). */
	start(): void {
		if (this.running || this.sequence.length === 0) return;
		this.running = true;
		this.stepIndex = 0;
		this.lastBeatResult = null;
		this.pendingNote = null;
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
		this.pendingNote = null;
		this.lastBeatResult = null;
	}

	/** Called by the UI layer whenever Live Input confirms a genuinely new note — same onset-gated wiring Guided Practice already uses. */
	handleDetectedNote(note: DetectedNote): void {
		if (!this.running || this.pendingNote !== null) return;
		this.pendingNote = note;
	}

	private tick(): void {
		if (!this.running || this.nextBeatAtMs === null) return;
		const beatAtMs = this.nextBeatAtMs;
		this.advanceBeat(beatAtMs);
		this.click?.playClick();
		// Reschedules from the fixed beat grid, not from `Date.now()` at fire
		// time — this is what keeps long-run drift from accumulating even
		// though `setTimeout` itself is never perfectly precise.
		this.nextBeatAtMs = beatAtMs + msPerBeat(this.bpm);
		const delay = Math.max(0, this.nextBeatAtMs - Date.now());
		this.timeoutHandle = setTimeout(() => this.tick(), delay);
	}

	private advanceBeat(beatAtMs: number): void {
		const target = this.currentTarget;
		if (target !== null) {
			this.lastBeatResult = evaluateBeat({
				target,
				zonePositions: this.currentTargetPositions,
				played: this.pendingNote,
				beatAtMs,
				toleranceMs: TOLERANCE_MS
			});
		}
		this.pendingNote = null;
		const length = this.sequence.length;
		this.stepIndex = length === 0 ? 0 : (this.stepIndex + 1) % length;
	}

	/**
	 * Test-only seam (see `scale-practice-test-hooks.ts`): cancels the real
	 * scheduler's pending tick without touching `running` or any other
	 * session state, so a test can `start()` then immediately silence the
	 * real timer and drive every beat by hand via `advanceBeatForTesting()`
	 * — otherwise the real `setTimeout` loop keeps firing in the background
	 * and races whatever the test is doing.
	 */
	stopSchedulerForTesting(): void {
		if (this.timeoutHandle !== null) {
			clearTimeout(this.timeoutHandle);
			this.timeoutHandle = null;
		}
	}

	/** Test-only seam (see `scale-practice-test-hooks.ts`): advances one beat synchronously against `Date.now()`, bypassing the real scheduler so Playwright never depends on real BPM timing. */
	advanceBeatForTesting(): void {
		this.advanceBeat(Date.now());
	}
}

export const scalePractice = new ScalePracticeStore();
