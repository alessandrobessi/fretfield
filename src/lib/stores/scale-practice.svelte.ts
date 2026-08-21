import {
	setAcidStepActive as setGrooveAcidStepActive,
	setAcidStepInterval as setGrooveAcidStepInterval,
	setAcidStepOctave as setGrooveAcidStepOctave,
	toggleAcidStepAccent as toggleGrooveAcidStepAccent,
	toggleAcidStepSlide as toggleGrooveAcidStepSlide
} from '$lib/acid-bass/pattern';
import { resolveAcidStepMidi } from '$lib/acid-bass/resolve';
import { ratchetOffsetsSeconds, stepShouldTrigger } from '$lib/acid-bass/sequencer';
import type {
	AcidBassPattern,
	AcidBassPatch,
	AcidOctaveOffset,
	AcidWave
} from '$lib/acid-bass/types';
import { createAcidBassVoice, type AcidBassVoice } from '$lib/audio/acid-bass-voice';
import { triggerChordPad } from '$lib/audio/chord-voices';
import {
	resolveAudioContextConstructor,
	triggerClosedHat,
	triggerKick,
	triggerOpenHat,
	triggerRide,
	triggerRim,
	triggerSnare
} from '$lib/audio/drum-voices';
import { effectiveSwing } from '$lib/groove/feel';
import { stepShouldSound } from '$lib/groove/intensity';
import { coerceGroove } from '$lib/groove/migrate';
import {
	cycleStepVelocity as cycleGrooveStepVelocity,
	setArrangementBar as setGrooveArrangementBar,
	setArrangementLength as setGrooveArrangementLength,
	setFeel as setGrooveFeel,
	setFeelAmount as setGrooveFeelAmount,
	setPatternForRole,
	setStepVelocity as setGrooveStepVelocity,
	setTimeSignature as setGrooveTimeSignature,
	stepOffsetMs
} from '$lib/groove/pattern';
import { listGroovePresets } from '$lib/groove/presets';
import { TIME_SIGNATURES, type TimeSignature } from '$lib/groove/time-signature';
import { GrooveTransport, type CountIn } from '$lib/groove/transport';
import {
	DRUM_VOICES,
	type DrumVoice,
	type Groove,
	type GrooveFeel,
	type GroovePattern,
	type PatternRole,
	type StepVelocity
} from '$lib/groove/types';
import { midiToFrequency } from '$lib/audio/note-mapping';
import { getChordDefinition } from '$lib/music/chords';
import type { FretPosition } from '$lib/music/fretboard';
import { intervalSemitones, type IntervalId } from '$lib/music/intervals';
import type { PitchClass } from '$lib/music/pitch';
import {
	buildProgression,
	getProgressionTemplate,
	resolvedChordSymbol,
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

// 100 = every authored step sounds regardless of its minIntensity -- matches
// pre-Intensity-engine playback exactly, so the default introduces no
// regression for grooves that never used the feature.
const DEFAULT_INTENSITY = 100;

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
		openHat: triggerOpenHat,
		ride: triggerRide,
		rim: triggerRim
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
	intensity: number;
}

const DEFAULT_CONFIG: PersistedScalePracticeConfig = {
	root: null,
	zone: { minFret: 0, maxFret: 12 },
	bpm: DEFAULT_BPM,
	groove: DEFAULT_GROOVE,
	progressionTemplateId: null,
	barsPerChord: DEFAULT_BARS_PER_CHORD,
	countIn: '1-bar',
	intensity: DEFAULT_INTENSITY
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
		countIn: (raw.countIn as CountIn | undefined) ?? DEFAULT_CONFIG.countIn,
		intensity: (raw.intensity as number | undefined) ?? DEFAULT_CONFIG.intensity
	};
}

function clampBpm(bpm: number): number {
	return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

function clampBarsPerChord(bars: number): number {
	return Math.min(MAX_BARS_PER_CHORD, Math.max(MIN_BARS_PER_CHORD, Math.round(bars)));
}

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, Math.round(value)));
}

/** Same idea as `clampPercent`, for a bipolar -100..100 control (Acid Bass's Env Mod). */
function clampBipolarPercent(value: number): number {
	return Math.min(100, Math.max(-100, Math.round(value)));
}

function clampIntensity(intensity: number): number {
	return clampPercent(intensity);
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
	/** Which bar of `groove.arrangement` is currently sounding -- drives the arrangement strip's playhead. `null` whenever the drum machine isn't running. Already wrapped to `arrangement.length`, unlike the transport's own ever-increasing bar counter. */
	activeBarIndex = $state<number | null>(null);
	/** Which pattern role the 16-step grid is currently showing/editing -- set by clicking a bar in the arrangement strip, or the pattern-role picker directly. Session-only, like `activeChordIndex`. */
	selectedPatternRole = $state<PatternRole>('A');
	countIn = $state<CountIn>(this.persisted.countIn);
	/** True for the count-in bar(s) after `start()`, before real playback (and `activeStepIndex`/`activeChordIndex` updates) begins. */
	isCountingIn = $state(false);
	/** 0-100, global: gates which authored steps sound (see `groove/intensity.ts`). Defaults to 100 -- everything authored plays, matching pre-Intensity-engine behavior. */
	intensity = $state(this.persisted.intensity);

	private readonly tuning: Tuning;
	private readonly fretCount: number;
	private readonly transport: GrooveTransport;
	private audioContext: AudioContext | null = null;
	/** Whichever pattern the current bar's arrangement slot points at -- resolved once per bar (not per step) in `handleBarStart`. */
	private currentBarPattern: GroovePattern = this.groove.patterns.A;
	/** Same idea as `currentBarPattern`, for Acid Bass -- the same arrangement role, since there is no independent bass arrangement. */
	private currentBarAcidPattern: AcidBassPattern = this.groove.acidBass.patterns.A;
	/** The Acid Bass reference root for the current bar -- the active progression chord's own root, or `this.root` with no progression (spec §15). Resolved once per bar in `handleBarStart`, `null` only when there's no progression *and* no root picked yet. */
	private currentBarChordRoot: PitchClass | null = null;
	/** The bar index `currentBarPattern`/`currentBarAcidPattern` were resolved for -- kept around so a mid-bar meter change (see `setTimeSignature`) can re-resolve both against the just-resized `groove` for the bar already in progress, instead of leaving them pointed at stale, wrong-length pattern arrays until the next `onBarStart`. */
	private currentBar = 0;
	/** The persistent monophonic synth voice -- created in `start()`, disposed in `stop()`, alongside `audioContext`'s own lifecycle (never a second `AudioContext`). */
	private acidBassVoice: AcidBassVoice | null = null;
	// Visual-only timers: audio timing always comes from AudioContext.currentTime
	// (the transport's own clock), but the *highlight* has to flip at the same
	// wall-clock moment the chord/step actually starts sounding, which a
	// setTimeout keyed off (gridTime - ctx.currentTime) approximates closely
	// enough for a UI cue. Tracked so stop()/a progression change can cancel
	// any still-pending ones instead of leaving a stale highlight to fire late.
	private chordHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];
	/** Same visual-timer approach as `chordHighlightTimeouts`, one per grid step, driving `activeStepIndex`. */
	private stepHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];
	/** Same visual-timer approach again, one per bar, driving `activeBarIndex`. */
	private barHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];

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

	/** Index-aligned with `groove.arrangement` -- the chord symbol sounding on each bar, `null` for "no chord backing on this bar," `undefined` entirely when there's no progression selected at all. Shared by the always-visible arrangement strip and the Groove Editor's own editable one, so they can never disagree. */
	readonly barChordLabels = $derived.by<(string | null)[] | undefined>(() => {
		if (this.resolvedProgression.length === 0) return undefined;
		return this.groove.arrangement.map((_, barIndex) => {
			const chordIndex = Math.floor(barIndex / this.barsPerChord) % this.resolvedProgression.length;
			return resolvedChordSymbol(this.resolvedProgression[chordIndex]);
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

	/** Clicking a step: cycles it off -> ghost -> normal -> accent -> off, on whichever pattern `selectedPatternRole` currently points at. */
	cycleStep(voice: DrumVoice, index: number): void {
		const pattern = cycleGrooveStepVelocity(
			this.groove.patterns[this.selectedPatternRole],
			voice,
			index
		);
		this.groove = setPatternForRole(this.groove, this.selectedPatternRole, pattern);
		this.persist();
	}

	/** Shift-click (accent) / Alt-click (off): sets a step's velocity directly rather than cycling. */
	setStepVelocity(voice: DrumVoice, index: number, velocity: StepVelocity): void {
		const pattern = setGrooveStepVelocity(
			this.groove.patterns[this.selectedPatternRole],
			voice,
			index,
			velocity
		);
		this.groove = setPatternForRole(this.groove, this.selectedPatternRole, pattern);
		this.persist();
	}

	setFeel(feel: GrooveFeel): void {
		this.groove = setGrooveFeel(this.groove, feel);
		this.persist();
	}

	setFeelAmount(amount: number): void {
		this.groove = setGrooveFeelAmount(this.groove, amount);
		this.persist();
	}

	/** Resizes every pattern to the new meter's step count (see `groove/pattern.ts`'s `setTimeSignature`) -- existing steps within the new length survive, a shorter-to-longer change pads with off-steps. */
	setTimeSignature(timeSignature: TimeSignature): void {
		this.groove = setGrooveTimeSignature(this.groove, timeSignature);
		// Live tempo changes take effect immediately via `transport.setBpm`
		// (see `setBpm` above) -- a meter change needs the same treatment, or
		// the transport keeps ticking against the old (now-mismatched) step
		// count until the next Stop/Play.
		this.transport.setStepsPerBar(TIME_SIGNATURES[timeSignature].stepsPerBar);
		// `currentBarPattern`/`currentBarAcidPattern` were resolved once at this
		// bar's `onBarStart` and won't otherwise refresh until the *next* one --
		// if this bar is still in progress and the new meter is longer, the next
		// `onStep` would index past the end of the stale (shorter) cached
		// pattern arrays and throw. Re-resolving both against the just-resized
		// `groove`, for the same bar, keeps them in sync immediately.
		if (this.running) {
			this.currentBarPattern = this.activePatternForBar(this.currentBar);
			this.currentBarAcidPattern = this.activeAcidPatternForBar(this.currentBar);
		}
		this.persist();
	}

	setIntensity(intensity: number): void {
		this.intensity = clampIntensity(intensity);
		this.persist();
	}

	/** Turning Bass on/off affects only this voice -- never drums, chord backing, transport state, active bar, or fretboard highlighting (spec §4.1). Turning off mid-playback silences immediately rather than waiting for the current step's own release. */
	setAcidBassEnabled(enabled: boolean): void {
		this.groove = { ...this.groove, acidBass: { ...this.groove.acidBass, enabled } };
		if (!enabled) this.acidBassVoice?.silence();
		this.persist();
	}

	setAcidBassWave(wave: AcidWave): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			oscillator: { ...patch.oscillator, mainWave: wave }
		}));
	}

	/** Was "Tone" in V1 -- see `resolve.ts`'s `cutoffToHz`. */
	setAcidBassCutoff(cutoff: number): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			filter: { ...patch.filter, cutoff: clampPercent(cutoff) }
		}));
	}

	setAcidBassResonance(resonance: number): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			filter: { ...patch.filter, resonance: clampPercent(resonance) }
		}));
	}

	/** Was "Motion" (unipolar 0-100) in V1 -- now bipolar -100..100, see `resolve.ts`'s `envAmountToRatio`. */
	setAcidBassEnvAmount(envAmount: number): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			filter: { ...patch.filter, envAmount: clampBipolarPercent(envAmount) }
		}));
	}

	setAcidBassDecay(decay: number): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			envelope: { ...patch.envelope, decay: clampPercent(decay) }
		}));
	}

	setAcidBassDrive(drive: number): void {
		this.updateAcidBassPatch((patch) => ({
			...patch,
			output: { ...patch.output, drive: clampPercent(drive) }
		}));
	}

	/** Live parameter editing (spec §33): patch changes apply to the running voice immediately (see `AcidBassVoice.setPatch`), without restarting the transport. */
	private updateAcidBassPatch(mutate: (patch: AcidBassPatch) => AcidBassPatch): void {
		const nextPatch = mutate(this.groove.acidBass.patch);
		this.groove = { ...this.groove, acidBass: { ...this.groove.acidBass, patch: nextPatch } };
		this.acidBassVoice?.setPatch(nextPatch);
		this.persist();
	}

	/** Editing an Acid Bass step always targets `selectedPatternRole`'s own pattern -- the same role selection the drum step grid uses (spec §12: no independent bass pattern-role selection). */
	setAcidStepActive(stepIndex: number, active: boolean): void {
		this.updateAcidBassSelectedPattern((pattern) =>
			setGrooveAcidStepActive(pattern, stepIndex, active)
		);
	}

	setAcidStepInterval(stepIndex: number, interval: IntervalId): void {
		this.updateAcidBassSelectedPattern((pattern) =>
			setGrooveAcidStepInterval(pattern, stepIndex, interval)
		);
	}

	setAcidStepOctave(stepIndex: number, octave: AcidOctaveOffset): void {
		this.updateAcidBassSelectedPattern((pattern) =>
			setGrooveAcidStepOctave(pattern, stepIndex, octave)
		);
	}

	toggleAcidStepAccent(stepIndex: number): void {
		this.updateAcidBassSelectedPattern((pattern) => toggleGrooveAcidStepAccent(pattern, stepIndex));
	}

	toggleAcidStepSlide(stepIndex: number): void {
		this.updateAcidBassSelectedPattern((pattern) => toggleGrooveAcidStepSlide(pattern, stepIndex));
	}

	private updateAcidBassSelectedPattern(
		mutate: (pattern: AcidBassPattern) => AcidBassPattern
	): void {
		const pattern = mutate(this.groove.acidBass.patterns[this.selectedPatternRole]);
		this.groove = {
			...this.groove,
			acidBass: {
				...this.groove.acidBass,
				patterns: { ...this.groove.acidBass.patterns, [this.selectedPatternRole]: pattern }
			}
		};
		this.persist();
	}

	/** Which pattern's steps the grid shows/edits -- purely a UI focus, doesn't touch the arrangement. */
	setSelectedPatternRole(role: PatternRole): void {
		this.selectedPatternRole = role;
	}

	/** Reassigns which pattern plays at `barIndex` in the arrangement. */
	setArrangementBar(barIndex: number, role: PatternRole): void {
		this.groove = setGrooveArrangementBar(this.groove, barIndex, role);
		this.persist();
	}

	/** Grows/shrinks the arrangement -- new bars default to role A, extra bars truncate from the end. */
	setArrangementLength(length: number): void {
		this.groove = setGrooveArrangementLength(this.groove, length);
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

	/** Cancels any not-yet-fired bar-playhead updates -- same reasoning again. */
	private cancelPendingBarHighlights(): void {
		for (const timeoutId of this.barHighlightTimeouts) clearTimeout(timeoutId);
		this.barHighlightTimeouts = [];
	}

	private persist(): void {
		writeJSON<PersistedScalePracticeConfig>(STORAGE_KEY, {
			root: this.root,
			zone: this.zone,
			bpm: this.bpm,
			groove: this.groove,
			progressionTemplateId: this.progressionTemplateId,
			barsPerChord: this.barsPerChord,
			countIn: this.countIn,
			intensity: this.intensity
		});
	}

	/** Whichever pattern `bar`'s slot in the arrangement points at. */
	private activePatternForBar(bar: number): GroovePattern {
		const role = this.groove.arrangement[bar % this.groove.arrangement.length];
		return this.groove.patterns[role];
	}

	/** Same lookup as `activePatternForBar`, for Acid Bass -- the identical arrangement role, since there is no independent bass arrangement (spec §12). */
	private activeAcidPatternForBar(bar: number): AcidBassPattern {
		const role = this.groove.arrangement[bar % this.groove.arrangement.length];
		return this.groove.acidBass.patterns[role];
	}

	/** The Acid Bass reference root for `bar` -- the active progression chord's own root (continuously across that chord's whole `barsPerChord`-bar span, not just the bar it starts on), or `this.root` with no progression selected at all (spec §15). */
	private resolveBarChordRoot(bar: number): PitchClass | null {
		const progression = this.resolvedProgression;
		if (progression.length === 0) return this.root;
		const chordIndex = Math.floor(bar / this.barsPerChord) % progression.length;
		return progression[chordIndex].root;
	}

	/** Starts (or stops) only the drum machine — has no effect on which notes are highlighted. */
	start(): void {
		if (this.running) return;
		const AudioContextCtor = resolveAudioContextConstructor();
		if (AudioContextCtor === null) return;

		this.audioContext = new AudioContextCtor();
		this.acidBassVoice = createAcidBassVoice(this.audioContext);
		this.acidBassVoice.setPatch(this.groove.acidBass.patch);
		this.running = true;
		this.isCountingIn = this.countIn !== 'off';
		const stepsPerBar = TIME_SIGNATURES[this.groove.timeSignature].stepsPerBar;
		this.transport.start(this.audioContext, this.bpm, this.countIn, stepsPerBar);
	}

	stop(): void {
		this.running = false;
		this.isCountingIn = false;
		this.transport.stop();
		this.acidBassVoice?.dispose();
		this.acidBassVoice = null;
		void this.audioContext?.close();
		this.audioContext = null;
		this.cancelPendingChordHighlights();
		this.cancelPendingStepHighlights();
		this.cancelPendingBarHighlights();
		this.activeStepIndex = null;
		this.activeBarIndex = null;
	}

	/** Fires once per bar of real playback (never during count-in) -- resolves which pattern the bar plays and triggers the chord pad. */
	private handleBarStart(bar: number, gridTime: number): void {
		this.scheduleBarChord(bar, gridTime);
		this.currentBar = bar;
		this.currentBarPattern = this.activePatternForBar(bar);
		this.currentBarAcidPattern = this.activeAcidPatternForBar(bar);
		this.currentBarChordRoot = this.resolveBarChordRoot(bar);

		const ctx = this.audioContext;
		if (ctx === null) return;
		const delayMs = Math.max(0, (gridTime - ctx.currentTime) * 1000);
		const timeoutId = setTimeout(() => {
			this.activeBarIndex = bar % this.groove.arrangement.length;
			this.barHighlightTimeouts = this.barHighlightTimeouts.filter((id) => id !== timeoutId);
		}, delayMs);
		this.barHighlightTimeouts = [...this.barHighlightTimeouts, timeoutId];
	}

	private handleStep(stepIndex: number, gridTime: number): void {
		const ctx = this.audioContext;
		if (ctx === null) return;
		const swing = effectiveSwing(this.groove.feel, this.groove.feelAmount);
		const stepsPerBeatGroup = TIME_SIGNATURES[this.groove.timeSignature].stepsPerBeatGroup;
		const swungTime = gridTime + stepOffsetMs(stepIndex, this.bpm, swing, stepsPerBeatGroup) / 1000;
		for (const voice of DRUM_VOICES) {
			const step = this.currentBarPattern.steps[voice][stepIndex];
			if (stepShouldSound(step, this.intensity)) {
				VOICE_TRIGGERS[voice](ctx, swungTime, step.velocity);
			}
		}

		this.scheduleAcidBassStep(stepIndex, swungTime);

		const delayMs = Math.max(0, (gridTime - ctx.currentTime) * 1000);
		const timeoutId = setTimeout(() => {
			this.activeStepIndex = stepIndex;
			this.stepHighlightTimeouts = this.stepHighlightTimeouts.filter((id) => id !== timeoutId);
		}, delayMs);
		this.stepHighlightTimeouts = [...this.stepHighlightTimeouts, timeoutId];
	}

	/**
	 * Schedules the Acid Bass voice for one step, if enabled and there's
	 * something to sound -- reuses the exact same swung `time` drums were just
	 * scheduled at (one definition of "when does step N actually sound?", spec
	 * §7.2), never a second timing calculation. A step's `slide` glides the
	 * oscillator toward the *immediately following* step's own pitch only when
	 * that step is active (no gliding across rests) -- resolved by looking one
	 * step back/forward in the already-cached `currentBarAcidPattern`, not by
	 * separate stateful tracking.
	 *
	 * Sequencer powers (M5): a step's own `probability` is rolled once here,
	 * before anything else -- a failed roll skips the step as if it weren't
	 * active this time through, ratchet hits included. `ratchet > 1` fans this
	 * one step out into several evenly-spaced retriggers of the voice (each an
	 * ordinary, ratchet-unaware `schedule()` call, see `acid-bass-voice.ts`),
	 * sharing the same accent/locks across every hit, and silently ignores the
	 * step's own outgoing `slide` (spec §42 -- which of several hits would
	 * glide is undefined, so ratchet wins).
	 */
	private scheduleAcidBassStep(stepIndex: number, time: number): void {
		if (!this.groove.acidBass.enabled || this.acidBassVoice === null) return;
		if (this.currentBarChordRoot === null) return;

		const pattern = this.currentBarAcidPattern;
		const step = pattern[stepIndex];
		if (step === undefined || !step.active) return;

		const role = this.groove.arrangement[this.currentBar % this.groove.arrangement.length];
		if (!stepShouldTrigger(step, this.currentBar, stepIndex, role)) return;

		const previousStep = stepIndex > 0 ? pattern[stepIndex - 1] : undefined;
		const legato = previousStep !== undefined && previousStep.active && previousStep.slide;

		const frequencyHz = midiToFrequency(resolveAcidStepMidi(this.currentBarChordRoot, step));
		const stepDurationSeconds = 60 / this.bpm / 4;

		if (!legato && step.ratchet > 1) {
			for (const offset of ratchetOffsetsSeconds(step.ratchet, stepDurationSeconds)) {
				this.acidBassVoice.schedule({
					time: time + offset,
					frequencyHz,
					stepDurationSeconds: stepDurationSeconds / step.ratchet,
					accent: step.accent,
					gatePercent: step.gate,
					locks: step.locks
				});
			}
			return;
		}

		let slideToFrequencyHz: number | undefined;
		if (step.slide) {
			const nextStep = pattern[stepIndex + 1];
			if (nextStep?.active) {
				slideToFrequencyHz = midiToFrequency(
					resolveAcidStepMidi(this.currentBarChordRoot, nextStep)
				);
			}
		}

		this.acidBassVoice.schedule({
			time,
			frequencyHz,
			stepDurationSeconds,
			accent: step.accent,
			gatePercent: step.gate,
			locks: step.locks,
			slideToFrequencyHz,
			legato
		});
	}

	/** A simple percussive click on every beat (not every 16th-note step) of a count-in bar -- "a simple percussive cue," per AGENTS.md. */
	private handleCountInStep(stepIndex: number, gridTime: number): void {
		const ctx = this.audioContext;
		const stepsPerBeatGroup = TIME_SIGNATURES[this.groove.timeSignature].stepsPerBeatGroup;
		if (ctx === null || stepIndex % stepsPerBeatGroup !== 0) return;
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

		const stepsPerBar = TIME_SIGNATURES[this.groove.timeSignature].stepsPerBar;
		const barDurationSeconds = (60 / this.bpm / 4) * stepsPerBar;
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
