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
import { buildProgression, type ResolvedChord } from '$lib/music/progressions';
import { getScaleDefinition, type ScaleDefinition } from '$lib/music/scales';
import { DEFAULT_FRET_COUNT, STANDARD_4_STRING_TUNING, type Tuning } from '$lib/music/tuning';
import { positionsForPitchClass, scalePositions } from '$lib/scale-practice/positions';
import type { PracticeZone } from '$lib/scale-practice/types';
import { liveInput } from '$lib/stores/live-input.svelte';
import {
	resolveProgressionTemplate,
	savedProgressions
} from '$lib/stores/saved-progressions.svelte';
import { readJSON, writeJSON } from '$lib/utils/local-storage';

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
	scaleId: string | null;
	zone: PracticeZone;
	bpm: number;
	pattern: GroovePattern;
	/** null = no chord backing (the feature is purely additive/off by default). */
	progressionTemplateId: string | null;
	barsPerChord: number;
}

const DEFAULT_CONFIG: PersistedScalePracticeConfig = {
	root: null,
	scaleId: null,
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
 * Owns Scale Practice's two independent pieces: which notes of the chosen
 * scale/zone are shown (`scalePositions`/`playedPositions`, always live,
 * regardless of the drum machine), and the drum machine itself (`running`/
 * `bpm`/`pattern` — a synthesized multi-voice groove, replacing the single
 * quarter-note click by explicit product direction; see AGENTS.md). Kept
 * as its own store rather than a `PracticeMode` inside `$lib/practice` —
 * that engine's types and AGENTS.md doctrine are both explicitly
 * chord/progression-shaped and timer-free; this store is scale/zone/tempo-
 * shaped and owns the app's only audio *output* scheduling.
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
	scaleId = $state<string | null>(this.persisted.scaleId);
	zone = $state<PracticeZone>(this.persisted.zone);
	bpm = $state(this.persisted.bpm);
	pattern = $state<GroovePattern>(this.persisted.pattern);
	progressionTemplateId = $state<string | null>(this.persisted.progressionTemplateId);
	barsPerChord = $state(this.persisted.barsPerChord);
	// Never restored true — the drum machine, like Live Input's mic, always
	// requires an explicit restart rather than resuming audio on load.
	running = $state(false);
	/** Index into `resolvedProgression` currently sounding — null while stopped or no progression is selected. */
	activeChordIndex = $state<number | null>(null);

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

	constructor(tuning: Tuning = STANDARD_4_STRING_TUNING, fretCount: number = DEFAULT_FRET_COUNT) {
		this.tuning = tuning;
		this.fretCount = fretCount;
	}

	readonly scale = $derived.by<ScaleDefinition | null>(() =>
		this.scaleId === null ? null : getScaleDefinition(this.scaleId)
	);

	/**
	 * The optional chord backing, built on the same root the scale itself
	 * uses — not an independent tonic. Empty whenever no progression is
	 * selected or there's no root yet; the scheduler treats an empty array as
	 * "chord playback off" (see AGENTS.md — audio only, never fretboard
	 * chord-tone highlighting).
	 */
	readonly resolvedProgression = $derived.by<ResolvedChord[]>(() => {
		if (this.root === null || this.progressionTemplateId === null) return [];
		const template = resolveProgressionTemplate(
			this.progressionTemplateId,
			savedProgressions.items
		);
		if (template === null) return [];
		return buildProgression(this.root, template);
	});

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
		this.persist();
	}

	setScaleId(scaleId: string | null): void {
		this.scaleId = scaleId;
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
		this.resetActiveChordHighlight();
		this.persist();
	}

	setBarsPerChord(bars: number): void {
		this.barsPerChord = clampBarsPerChord(bars);
		this.resetActiveChordHighlight();
		this.persist();
	}

	/** Clears the highlight and cancels any pending visual update -- so a stale index never lingers past a stop or a progression/bars change. */
	private resetActiveChordHighlight(): void {
		for (const timeoutId of this.chordHighlightTimeouts) clearTimeout(timeoutId);
		this.chordHighlightTimeouts = [];
		this.activeChordIndex = null;
	}

	private persist(): void {
		writeJSON<PersistedScalePracticeConfig>(STORAGE_KEY, {
			root: this.root,
			scaleId: this.scaleId,
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
		this.resetActiveChordHighlight();
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
