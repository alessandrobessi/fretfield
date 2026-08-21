// Standard Web Audio "lookahead scheduler" constants: the JS timer only
// needs to wake up often enough to keep scheduling steps within the lookahead
// window -- the actual playback timing comes from AudioContext.currentTime,
// not from setInterval's own accuracy, so drift/jitter in the JS timer never
// reaches the audio.
const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

export type CountIn = 'off' | '1-bar' | '2-bars';

function countInBarCount(countIn: CountIn): number {
	if (countIn === 'off') return 0;
	return countIn === '1-bar' ? 1 : 2;
}

export interface GrooveTransportCallbacks {
	/** Fires once per bar, right as its first step is scheduled -- `barIndex` counts up from 0 and never resets mid-session (arrangement/chord lookups wrap it themselves via modulo). */
	onBarStart(barIndex: number, gridTime: number): void;
	/** Fires for every 16th-note step of real playback (not during count-in). */
	onStep(barIndex: number, stepIndex: number, gridTime: number): void;
	/** Fires for every 16th-note step of a count-in, before real playback begins. Optional -- a caller that doesn't want a count-in click can omit it. */
	onCountInStep?(stepIndex: number, gridTime: number): void;
	/** Fires exactly once, the instant the count-in finishes and real playback is about to begin. */
	onCountInEnd?(): void;
}

/**
 * The single authoritative clock for Scale Practice's Groove Engine --
 * schedules drum steps, the count-in, and (via the same per-bar callback)
 * chord-pad/fretboard-sync triggering off one `AudioContext.currentTime`
 * clock, so drums and harmony can never drift apart onto separate timers
 * (see AGENTS.md). Deliberately does no audio triggering itself -- the
 * caller's callbacks own that -- keeping this module pure timing/sequencing,
 * per the "UI -> Groove state -> Transport -> Renderer" layering in
 * AGENTS.md.
 */
export class GrooveTransport {
	private readonly callbacks: GrooveTransportCallbacks;
	private audioContext: AudioContext | null = null;
	private schedulerHandle: ReturnType<typeof setInterval> | null = null;
	private bpm = 80;
	private stepsPerBar = 16;
	private nextStepTime = 0;
	private currentStep = 0;
	private currentBar = 0;
	private countInBarsRemaining = 0;

	constructor(callbacks: GrooveTransportCallbacks) {
		this.callbacks = callbacks;
	}

	get isRunning(): boolean {
		return this.audioContext !== null;
	}

	/** Starts (or restarts) playback on `ctx`'s clock -- always resets to bar 1/beat 1/step 1, per the roadmap's "stop resets, nothing resumes mid-bar" playback behavior. `stepsPerBar` (see `groove/time-signature.ts`) governs both real bars and count-in bars alike -- a count-in bar is the same length as a real one in whatever meter is playing. */
	start(ctx: AudioContext, bpm: number, countIn: CountIn, stepsPerBar: number): void {
		this.audioContext = ctx;
		this.bpm = bpm;
		this.stepsPerBar = stepsPerBar;
		this.currentStep = 0;
		this.currentBar = 0;
		this.countInBarsRemaining = countInBarCount(countIn);
		this.nextStepTime = ctx.currentTime + 0.05;
		this.schedulerHandle = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
	}

	stop(): void {
		if (this.schedulerHandle !== null) {
			clearInterval(this.schedulerHandle);
			this.schedulerHandle = null;
		}
		this.audioContext = null;
	}

	setBpm(bpm: number): void {
		this.bpm = bpm;
	}

	/**
	 * Live meter change mid-playback (e.g. the player switches Time Signature
	 * without stopping first) -- without this, `stepsPerBar` would stay frozen
	 * at whatever it was when `start()` was called, and the very next `tick()`
	 * would call back with `currentStep` values the (now-resized) pattern
	 * arrays don't have, throwing inside the caller. Snaps `currentStep` back
	 * to the start of the current bar if the new meter is shorter than
	 * wherever playback currently is, rather than waiting for the normal
	 * end-of-bar wraparound check (which only runs *after* the next `onStep`
	 * call -- too late to prevent that call's own out-of-range index).
	 */
	setStepsPerBar(stepsPerBar: number): void {
		this.stepsPerBar = stepsPerBar;
		if (this.currentStep >= stepsPerBar) this.currentStep = 0;
	}

	/** Schedules every step whose (unswung) grid time falls within the lookahead window. */
	private tick(): void {
		const ctx = this.audioContext;
		if (ctx === null) return;

		while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
			if (this.countInBarsRemaining > 0) {
				this.callbacks.onCountInStep?.(this.currentStep, this.nextStepTime);
			} else {
				if (this.currentStep === 0) this.callbacks.onBarStart(this.currentBar, this.nextStepTime);
				this.callbacks.onStep(this.currentBar, this.currentStep, this.nextStepTime);
			}

			const stepDurationSeconds = 60 / this.bpm / 4; // 4 sixteenth notes per beat
			this.nextStepTime += stepDurationSeconds;
			this.currentStep += 1;
			if (this.currentStep >= this.stepsPerBar) {
				this.currentStep = 0;
				if (this.countInBarsRemaining > 0) {
					this.countInBarsRemaining -= 1;
					if (this.countInBarsRemaining === 0) this.callbacks.onCountInEnd?.();
				} else {
					this.currentBar += 1;
				}
			}
		}
	}
}
