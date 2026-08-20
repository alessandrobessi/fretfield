import { triggerChordPad } from '$lib/audio/chord-voices';
import {
	resolveAudioContextConstructor,
	triggerClosedHat,
	triggerKick,
	triggerOpenHat,
	triggerSnare
} from '$lib/audio/drum-voices';
import { listGroovePresets } from '$lib/audio/groove-presets';
import {
	DRUM_VOICES,
	STEPS_PER_BAR,
	stepOffsetMs,
	setSwing as setGrooveSwing,
	toggleStep as toggleGrooveStep,
	type DrumVoice,
	type GroovePattern
} from '$lib/audio/groove';
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

// Standard Web Audio "lookahead scheduler" constants: the JS timer only
// needs to wake up often enough to keep scheduling steps within the lookahead
// window -- the actual playback timing comes from AudioContext.currentTime,
// not from setInterval's own accuracy, so drift/jitter in the JS timer never
// reaches the audio.
const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

// The chord pad's fixed voicing octave -- C4, comfortably above the bass's
// own range (the standard 4-string tuning tops out at G3, MIDI 43+fretCount)
// so the pad backs the instrument being practiced rather than masking it.
const CHORD_PAD_ROOT_MIDI = 60;
const CHORD_PAD_GAIN = 0.5;

const DEFAULT_PATTERN =
	listGroovePresets().find((preset) => preset.id === 'straight-rock')?.pattern ??
	listGroovePresets()[0].pattern;

const VOICE_TRIGGERS: Record<DrumVoice, (ctx: AudioContext, time: number) => void> = {
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
	pattern: GroovePattern;
	/** null = no chord backing (the feature is purely additive/off by default). */
	progressionTemplateId: string | null;
	barsPerChord: number;
}

const DEFAULT_CONFIG: PersistedScalePracticeConfig = {
	root: null,
	zone: { minFret: 0, maxFret: 12 },
	bpm: DEFAULT_BPM,
	pattern: DEFAULT_PATTERN,
	progressionTemplateId: null,
	barsPerChord: DEFAULT_BARS_PER_CHORD
};

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
 * drum machine itself (`running`/`bpm`/`pattern` — a synthesized
 * multi-voice groove, replacing the single quarter-note click by earlier
 * explicit product direction). Kept as its own store rather than a
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
	private readonly persisted = readJSON(STORAGE_KEY, DEFAULT_CONFIG);

	root = $state<PitchClass | null>(this.persisted.root);
	zone = $state<PracticeZone>(this.persisted.zone);
	bpm = $state(this.persisted.bpm);
	pattern = $state<GroovePattern>(this.persisted.pattern);
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

	private readonly tuning: Tuning;
	private readonly fretCount: number;
	private audioContext: AudioContext | null = null;
	private schedulerHandle: ReturnType<typeof setInterval> | null = null;
	private currentStep = 0;
	private currentBar = 0;
	private nextStepTime = 0;
	// Visual-only timers: audio timing always comes from AudioContext.currentTime
	// (see the scheduler doc comment below), but the *highlight* has to flip at
	// the same wall-clock moment the chord actually starts sounding, which a
	// setTimeout keyed off (gridTime - ctx.currentTime) approximates closely
	// enough for a UI cue. Tracked so stop()/a progression change can cancel
	// any still-pending ones instead of leaving a stale highlight to fire late.
	private chordHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];
	/** Same visual-timer approach as `chordHighlightTimeouts`, one per grid step, driving `activeStepIndex`. */
	private stepHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];

	constructor(tuning: Tuning = STANDARD_4_STRING_TUNING, fretCount: number = DEFAULT_FRET_COUNT) {
		this.tuning = tuning;
		this.fretCount = fretCount;
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
		this.persist();
	}

	/** Bulk-replaces the whole pattern — used by genre-preset selection and loading a saved groove. */
	setPattern(pattern: GroovePattern): void {
		this.pattern = pattern;
		this.persist();
	}

	toggleStep(voice: DrumVoice, index: number): void {
		this.pattern = toggleGrooveStep(this.pattern, voice, index);
		this.persist();
	}

	setSwing(swing: number): void {
		this.pattern = setGrooveSwing(this.pattern, swing);
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
			pattern: this.pattern,
			progressionTemplateId: this.progressionTemplateId,
			barsPerChord: this.barsPerChord
		});
	}

	/** Starts (or stops) only the drum machine — has no effect on which notes are highlighted. */
	start(): void {
		if (this.running) return;
		const AudioContextCtor = resolveAudioContextConstructor();
		if (AudioContextCtor === null) return;

		this.audioContext = new AudioContextCtor();
		this.running = true;
		this.currentStep = 0;
		this.currentBar = 0;
		this.nextStepTime = this.audioContext.currentTime + 0.05;
		this.schedulerHandle = setInterval(() => this.scheduler(), SCHEDULER_INTERVAL_MS);
	}

	stop(): void {
		this.running = false;
		if (this.schedulerHandle !== null) {
			clearInterval(this.schedulerHandle);
			this.schedulerHandle = null;
		}
		void this.audioContext?.close();
		this.audioContext = null;
		this.cancelPendingChordHighlights();
		this.cancelPendingStepHighlights();
		this.activeStepIndex = null;
	}

	/** Schedules every step whose (unswung) grid time falls within the lookahead window. */
	private scheduler(): void {
		const ctx = this.audioContext;
		if (!this.running || ctx === null) return;

		while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
			if (this.currentStep === 0) {
				this.scheduleBarChord(this.currentBar, this.nextStepTime);
				this.currentBar += 1;
			}
			this.scheduleStep(this.currentStep, this.nextStepTime);
			const stepDurationSeconds = 60 / this.bpm / 4; // 4 sixteenth notes per beat
			this.currentStep = (this.currentStep + 1) % STEPS_PER_BAR;
			this.nextStepTime += stepDurationSeconds;
		}
	}

	private scheduleStep(stepIndex: number, gridTime: number): void {
		const ctx = this.audioContext;
		if (ctx === null) return;
		const swungTime = gridTime + stepOffsetMs(stepIndex, this.bpm, this.pattern.swing) / 1000;
		for (const voice of DRUM_VOICES) {
			if (this.pattern.steps[voice][stepIndex]) {
				VOICE_TRIGGERS[voice](ctx, swungTime);
			}
		}

		const delayMs = Math.max(0, (gridTime - ctx.currentTime) * 1000);
		const timeoutId = setTimeout(() => {
			this.activeStepIndex = stepIndex;
			this.stepHighlightTimeouts = this.stepHighlightTimeouts.filter((id) => id !== timeoutId);
		}, delayMs);
		this.stepHighlightTimeouts = [...this.stepHighlightTimeouts, timeoutId];
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
