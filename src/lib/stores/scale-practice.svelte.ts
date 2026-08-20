import { triggerChordPad } from '$lib/audio/chord-voices';
import {
	resolveAudioContextConstructor,
	triggerClosedHat,
	triggerKick,
	triggerOpenHat,
	triggerSnare
} from '$lib/audio/drum-voices';
import { coerceGroove } from '$lib/groove/migrate';
import {
	setPatternForRole,
	setSwing as setGrooveSwing,
	stepOffsetMs,
	toggleStep as toggleGrooveStep
} from '$lib/groove/pattern';
import { listGroovePresets } from '$lib/groove/presets';
import { GrooveTransport, type CountIn } from '$lib/groove/transport';
import {
	DRUM_VOICES,
	STEPS_PER_BAR,
	type DrumVoice,
	type Groove,
	type GroovePattern
} from '$lib/groove/types';
import { midiToFrequency } from '$lib/audio/note-mapping';
import { getChordDefinition } from '$lib/music/chords';
import type { FretPosition } from '$lib/music/fretboard';
import { intervalSemitones } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';
import {
	buildProgression,
	getProgressionTemplate,
	type ResolvedChord
} from '$lib/music/progressions';
import { getScaleDefinition, suggestedScalesFor } from '$lib/music/scales';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import { positionsForPitchClass, scalePositions } from '$lib/scale-practice/positions';
import type { PracticeZone } from '$lib/scale-practice/types';
import { liveInput } from '$lib/stores/live-input.svelte';
import { readJSON, writeJSON } from '$lib/utils/local-storage';

/** Looks up one of the curated progression templates, never a user-saved custom one (that feature no longer exists) — null for an unrecognized id, e.g. a stale persisted id from a deleted custom progression, rather than throwing. */
function resolveProgressionTemplate(id: string) {
	try {
		return getProgressionTemplate(id);
	} catch {
		return null;
	}
}

const DEFAULT_BPM = 80;
const MIN_BPM = 30;
const MAX_BPM = 240;

const DEFAULT_BARS_PER_CHORD = 2;
const MIN_BARS_PER_CHORD = 1;
const MAX_BARS_PER_CHORD = 8;

// The chord pad's fixed voicing octave -- C4, comfortably above the bass's
// own range (the standard 4-string tuning tops out at G3, MIDI 43+fretCount)
// so the pad backs the instrument being practiced rather than masking it.
const CHORD_PAD_ROOT_MIDI = 60;
const CHORD_PAD_GAIN = 0.5;

const DEFAULT_GROOVE =
	listGroovePresets().find((preset) => preset.id === 'straight-rock')?.groove ??
	listGroovePresets()[0].groove;

const VOICE_TRIGGERS: Record<DrumVoice, (ctx: AudioContext, time: number, gain?: number) => void> =
	{
		kick: triggerKick,
		snare: triggerSnare,
		closedHat: triggerClosedHat,
		openHat: triggerOpenHat
	};

export const STORAGE_KEY = 'fretfield-scale-practice';

interface PersistedScalePracticeConfig {
	root: PitchClass | null;
	zone: PracticeZone;
	bpm: number;
	groove: Groove;
	/** null = no chord backing (the feature is purely additive/off by default). */
	progressionTemplateId: string | null;
	barsPerChord: number;
	countIn: CountIn;
}

const DEFAULT_CONFIG: PersistedScalePracticeConfig = {
	root: null,
	zone: { minFret: 0, maxFret: 12 },
	bpm: DEFAULT_BPM,
	groove: DEFAULT_GROOVE,
	progressionTemplateId: null,
	barsPerChord: DEFAULT_BARS_PER_CHORD,
	countIn: '1-bar'
};

/**
 * Reads defensively rather than trusting a stored blob to match today's
 * shape exactly -- the Groove Engine's data model keeps growing new fields
 * across milestones (see AGENTS.md), so every field falls back to its
 * default individually instead of the whole config being discarded, and
 * `groove` (still `pattern` in anything saved before the Groove Engine)
 * goes through `coerceGroove` to migrate the pre-arrangement single-pattern
 * shape.
 */
function loadPersistedConfig(): PersistedScalePracticeConfig {
	const raw = readJSON<Record<string, unknown> | null>(STORAGE_KEY, null);
	if (raw === null) return DEFAULT_CONFIG;
	return {
		root: (raw.root as PersistedScalePracticeConfig['root'] | undefined) ?? DEFAULT_CONFIG.root,
		zone: (raw.zone as PracticeZone | undefined) ?? DEFAULT_CONFIG.zone,
		bpm: (raw.bpm as number | undefined) ?? DEFAULT_CONFIG.bpm,
		groove: coerceGroove(raw.groove ?? raw.pattern ?? DEFAULT_CONFIG.groove),
		progressionTemplateId:
			(raw.progressionTemplateId as string | null | undefined) ??
			DEFAULT_CONFIG.progressionTemplateId,
		barsPerChord: (raw.barsPerChord as number | undefined) ?? DEFAULT_CONFIG.barsPerChord,
		countIn: (raw.countIn as CountIn | undefined) ?? DEFAULT_CONFIG.countIn
	};
}

function clampBpm(bpm: number): number {
	return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

function clampBarsPerChord(bars: number): number {
	return Math.min(MAX_BARS_PER_CHORD, Math.max(MIN_BARS_PER_CHORD, Math.round(bars)));
}

/**
 * Owns Scale Practice's two independent pieces: which notes of the active
 * progression chord's scale are shown within `zone` (`scalePositions`/
 * `playedPositions`, always live, regardless of the drum machine — there is
 * no standalone manual scale anymore, only the ones a picked progression's
 * chords carry, per explicit product direction; see AGENTS.md), and the
 * Groove Engine itself (`running`/`bpm`/`groove` — a synthesized multi-voice
 * groove, replacing the single quarter-note click by earlier explicit
 * product direction). Kept as its own store rather than a
 * `PracticeMode` inside `$lib/practice` — that engine's types and
 * AGENTS.md doctrine are both explicitly chord/progression-shaped and
 * timer-free; this store is scale/zone/tempo-shaped and owns the app's
 * only audio *output* scheduling.
 *
 * The scheduler is a standard lookahead scheduler (a coarse setInterval
 * "checker" that schedules upcoming steps at precise AudioContext times) so
 * timing stays sample-accurate regardless of JS timer jitter, and so swing
 * (sub-step timing offsets) is actually audible rather than lost to
 * setTimeout's own imprecision.
 */
export class ScalePracticeStore {
	private readonly persisted = loadPersistedConfig();

	root = $state<PitchClass | null>(this.persisted.root);
	zone = $state<PracticeZone>(this.persisted.zone);
	bpm = $state(this.persisted.bpm);
	groove = $state<Groove>(this.persisted.groove);
	progressionTemplateId = $state<string | null>(this.persisted.progressionTemplateId);
	barsPerChord = $state(this.persisted.barsPerChord);
	// Never restored true — the drum machine, like Live Input's mic, always
	// requires an explicit restart rather than resuming audio on load.
	running = $state(false);
	/**
	 * Index into `resolvedProgression` — both "the chord currently sounding"
	 * (while playing) and "the chord being previewed" (while stopped), same
	 * dual role `fretfield.svelte.ts`'s own `activeChordIndex` plays for
	 * Explore's Progression lens. Always a valid index, never null -- clicking
	 * a chord (or picking a progression) sets it even with the drum machine
	 * stopped, and stopping playback freezes it rather than clearing it.
	 */
	activeChordIndex = $state(0);
	/** Per-chord-index scale override for the progression backing, keyed like `fretfield.svelte.ts`'s `progressionScaleOverrides` -- session-only, same "advanced escape hatch" precedent (see AGENTS.md). `undefined` = use the family-suggested default; explicit `null` = user cleared it. */
	progressionChordScaleOverrides = $state<Record<number, string | null>>({});
	/** Which of the 16 grid steps is currently sounding -- drives the step-grid's playhead pulse. `null` whenever the drum machine isn't running. */
	activeStepIndex = $state<number | null>(null);
	countIn = $state<CountIn>(this.persisted.countIn);
	/** True for the count-in bar(s) after `start()`, before real playback (and `activeStepIndex`/`activeChordIndex` updates) begins. */
	isCountingIn = $state(false);

	private readonly tuning: Tuning;
	private readonly fretCount: number;
	private readonly transport: GrooveTransport;
	private audioContext: AudioContext | null = null;
	/** Whichever pattern the current bar's arrangement slot points at -- resolved once per bar (not per step) in `handleBarStart`. */
	private currentBarPattern: GroovePattern = this.groove.patterns.A;
	// Visual-only timers: audio timing always comes from AudioContext.currentTime
	// (the transport's own clock), but the *highlight* has to flip at the same
	// wall-clock moment the chord/step actually starts sounding, which a
	// setTimeout keyed off (gridTime - ctx.currentTime) approximates closely
	// enough for a UI cue. Tracked so stop()/a progression change can cancel
	// any still-pending ones instead of leaving a stale highlight to fire late.
	private chordHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];
	/** Same visual-timer approach as `chordHighlightTimeouts`, one per grid step, driving `activeStepIndex`. */
	private stepHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];

	constructor(tuning: Tuning = STANDARD_4_STRING_TUNING, fretCount: number = DEFAULT_FRET_COUNT) {
		this.tuning = tuning;
		this.fretCount = fretCount;
		this.transport = new GrooveTransport({
			onBarStart: (bar, gridTime) => this.handleBarStart(bar, gridTime),
			onStep: (_bar, stepIndex, gridTime) => this.handleStep(stepIndex, gridTime),
			onCountInStep: (stepIndex, gridTime) => this.handleCountInStep(stepIndex, gridTime),
			onCountInEnd: () => {
				this.isCountingIn = false;
			}
		});
	}

	/**
	 * The optional chord backing, built on `root` — not an independent tonic.
	 * Empty whenever no progression is selected or there's no root yet; the
	 * scheduler treats an empty array as "chord playback off".
	 */
	readonly resolvedProgression = $derived.by<ResolvedChord[]>(() => {
		if (this.root === null || this.progressionTemplateId === null) return [];
		const template = resolveProgressionTemplate(this.progressionTemplateId);
		if (template === null) return [];
		return buildProgression(this.root, template);
	});

	/** Index-aligned with `resolvedProgression`: each chord's assigned scale, defaulting to its chord family's top suggestion (see `suggestedScalesFor`) unless overridden. Same formula as `fretfield.svelte.ts`'s `progressionScaleBlocks`. */
	readonly progressionChordScales = $derived.by<(string | null)[]>(() => {
		return this.resolvedProgression.map((chord, index) => {
			const override = this.progressionChordScaleOverrides[index];
			return override !== undefined ? override : (suggestedScalesFor(chord.chordId)[0]?.id ?? null);
		});
	});

	/** The chord (and its assigned scale) at `activeChordIndex` -- null whenever there's no progression or that chord's scale was explicitly cleared to "—". */
	readonly activeChordScale = $derived.by<{ root: PitchClass; scaleId: string } | null>(() => {
		const chord = this.resolvedProgression[this.activeChordIndex];
		const scaleId = this.progressionChordScales[this.activeChordIndex];
		if (chord === undefined || scaleId === null || scaleId === undefined) return null;
		return { root: chord.root, scaleId };
	});

	/** What fretboard labels (root marker, interval numbers) are keyed against -- the active chord's own root while a progression chord-scale is showing, otherwise the practice root itself. */
	readonly displayRoot = $derived.by<PitchClass | null>(
		() => this.activeChordScale?.root ?? this.root
	);

	/**
	 * Every position in the zone belonging to the currently-shown scale — the
	 * active progression chord's assigned scale. Empty whenever no progression
	 * chord-scale is active (no progression selected, or that chord's scale
	 * was explicitly cleared to "—") — there's no standalone manual scale to
	 * fall back to; a scale only ever comes from a progression chord now.
	 * Shown all at once, not one note at a time.
	 */
	readonly scalePositions = $derived.by<FretPosition[]>(() => {
		const activeScale = this.activeChordScale;
		if (activeScale === null) return [];
		return scalePositions(
			activeScale.root,
			getScaleDefinition(activeScale.scaleId),
			this.zone,
			this.tuning,
			this.fretCount
		);
	});

	/** Whatever's currently sounding, live — clears itself the moment Live Input stops detecting a note. */
	readonly playedPositions = $derived.by<FretPosition[]>(() => {
		const note = liveInput.detectedNote;
		if (note === null) return [];
		return positionsForPitchClass(note.pitchClass, this.zone, this.tuning, this.fretCount);
	});

	setRoot(root: PitchClass | null): void {
		this.root = root;
		this.persist();
	}

	setZone(minFret: number, maxFret: number): void {
		this.zone = { minFret, maxFret };
		this.persist();
	}

	setBpm(bpm: number): void {
		this.bpm = clampBpm(bpm);
		// Live tempo changes take effect immediately, mid-playback -- the
		// transport keeps its own copy since it can't read `this.bpm` directly.
		this.transport.setBpm(this.bpm);
		this.persist();
	}

	setCountIn(countIn: CountIn): void {
		this.countIn = countIn;
		this.persist();
	}

	/** Bulk-replaces the whole groove — used by genre-preset selection and loading a saved groove. */
	setGroove(groove: Groove): void {
		this.groove = groove;
		this.persist();
	}

	/** Edits pattern role `A` -- the only role reachable through today's UI (multi-role editing is a later milestone). */
	toggleStep(voice: DrumVoice, index: number): void {
		const patternA = toggleGrooveStep(this.groove.patterns.A, voice, index);
		this.groove = setPatternForRole(this.groove, 'A', patternA);
		this.persist();
	}

	setSwing(swing: number): void {
		this.groove = setGrooveSwing(this.groove, swing);
		this.persist();
	}

	setProgressionTemplate(id: string | null): void {
		this.progressionTemplateId = id;
		this.activeChordIndex = 0;
		this.cancelPendingChordHighlights();
		this.persist();
	}

	setBarsPerChord(bars: number): void {
		this.barsPerChord = clampBarsPerChord(bars);
		this.cancelPendingChordHighlights();
		this.persist();
	}

	/** Click-to-preview (or scheduler-driven) selection of which chord's scale is showing -- wraps like `fretfield.svelte.ts`'s own `setActiveChordIndex`. */
	setActiveChordIndex(index: number): void {
		const length = this.resolvedProgression.length;
		if (length === 0) return;
		this.activeChordIndex = ((index % length) + length) % length;
	}

	/** Session-only, same precedent as `progressionChordScaleOverrides` itself. */
	setProgressionChordScale(index: number, scaleId: string | null): void {
		this.progressionChordScaleOverrides = {
			...this.progressionChordScaleOverrides,
			[index]: scaleId
		};
	}

	/** Cancels any not-yet-fired scheduler highlight updates -- so a stale one (targeting a bar/progression that no longer applies) never lands late and overwrites a manual preview. */
	private cancelPendingChordHighlights(): void {
		for (const timeoutId of this.chordHighlightTimeouts) clearTimeout(timeoutId);
		this.chordHighlightTimeouts = [];
	}

	/** Cancels any not-yet-fired step-playhead updates -- same reasoning as `cancelPendingChordHighlights`, called on stop() so a late timeout never resurrects the playhead after playback ends. */
	private cancelPendingStepHighlights(): void {
		for (const timeoutId of this.stepHighlightTimeouts) clearTimeout(timeoutId);
		this.stepHighlightTimeouts = [];
	}

	private persist(): void {
		writeJSON<PersistedScalePracticeConfig>(STORAGE_KEY, {
			root: this.root,
			zone: this.zone,
			bpm: this.bpm,
			groove: this.groove,
			progressionTemplateId: this.progressionTemplateId,
			barsPerChord: this.barsPerChord,
			countIn: this.countIn
		});
	}

	/** Whichever pattern `bar`'s slot in the arrangement points at. */
	private activePatternForBar(bar: number): GroovePattern {
		const role = this.groove.arrangement[bar % this.groove.arrangement.length];
		return this.groove.patterns[role];
	}

	/** Starts (or stops) only the drum machine — has no effect on which notes are highlighted. */
	start(): void {
		if (this.running) return;
		const AudioContextCtor = resolveAudioContextConstructor();
		if (AudioContextCtor === null) return;

		this.audioContext = new AudioContextCtor();
		this.running = true;
		this.isCountingIn = this.countIn !== 'off';
		this.transport.start(this.audioContext, this.bpm, this.countIn);
	}

	stop(): void {
		this.running = false;
		this.isCountingIn = false;
		this.transport.stop();
		void this.audioContext?.close();
		this.audioContext = null;
		this.cancelPendingChordHighlights();
		this.cancelPendingStepHighlights();
		this.activeStepIndex = null;
	}

	/** Fires once per bar of real playback (never during count-in) -- resolves which pattern the bar plays and triggers the chord pad. */
	private handleBarStart(bar: number, gridTime: number): void {
		this.scheduleBarChord(bar, gridTime);
		this.currentBarPattern = this.activePatternForBar(bar);
	}

	private handleStep(stepIndex: number, gridTime: number): void {
		const ctx = this.audioContext;
		if (ctx === null) return;
		const swungTime = gridTime + stepOffsetMs(stepIndex, this.bpm, this.groove.swing) / 1000;
		for (const voice of DRUM_VOICES) {
			const step = this.currentBarPattern.steps[voice][stepIndex];
			if (step.velocity > 0) {
				VOICE_TRIGGERS[voice](ctx, swungTime, step.velocity);
			}
		}

		const delayMs = Math.max(0, (gridTime - ctx.currentTime) * 1000);
		const timeoutId = setTimeout(() => {
			this.activeStepIndex = stepIndex;
			this.stepHighlightTimeouts = this.stepHighlightTimeouts.filter((id) => id !== timeoutId);
		}, delayMs);
		this.stepHighlightTimeouts = [...this.stepHighlightTimeouts, timeoutId];
	}

	/** A simple percussive click on every beat (not every 16th-note step) of a count-in bar -- "a simple percussive cue," per AGENTS.md. */
	private handleCountInStep(stepIndex: number, gridTime: number): void {
		const ctx = this.audioContext;
		if (ctx === null || stepIndex % 4 !== 0) return;
		triggerClosedHat(ctx, gridTime, 1);
	}

	/**
	 * Triggers the pad for the chord starting at `bar`, held for
	 * `barsPerChord` bars -- a no-op on every bar that isn't the start of a
	 * new chord's span, and entirely a no-op when no progression is selected.
	 */
	private scheduleBarChord(bar: number, gridTime: number): void {
		const ctx = this.audioContext;
		const progression = this.resolvedProgression;
		if (ctx === null || progression.length === 0) return;
		if (bar % this.barsPerChord !== 0) return;

		const chordIndex = Math.floor(bar / this.barsPerChord) % progression.length;
		const chord = progression[chordIndex];
		const { required } = getChordDefinition(chord.chordId);
		const frequenciesHz = required.map((interval) =>
			midiToFrequency(CHORD_PAD_ROOT_MIDI + chord.root + intervalSemitones(interval))
		);

		const barDurationSeconds = (60 / this.bpm / 4) * STEPS_PER_BAR;
		const durationSeconds = barDurationSeconds * this.barsPerChord;
		triggerChordPad(ctx, gridTime, frequenciesHz, durationSeconds, CHORD_PAD_GAIN);

		const delayMs = Math.max(0, (gridTime - ctx.currentTime) * 1000);
		const timeoutId = setTimeout(() => {
			this.activeChordIndex = chordIndex;
			this.chordHighlightTimeouts = this.chordHighlightTimeouts.filter((id) => id !== timeoutId);
		}, delayMs);
		this.chordHighlightTimeouts = [...this.chordHighlightTimeouts, timeoutId];
	}
}

export const scalePractice = new ScalePracticeStore();
