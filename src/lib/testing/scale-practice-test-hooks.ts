import { browser } from '$app/environment';
import type { PitchClass } from '$lib/music/pitch';
import { scalePractice } from '$lib/stores/scale-practice.svelte';

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`/
 * `practice-test-hooks.ts`, for the one thing that would otherwise make
 * Scale Practice e2e tests slow/flaky: real wall-clock BPM timing.
 * `advanceBeat()` calls the store's real per-beat evaluation logic
 * synchronously, bypassing the `setTimeout` scheduler entirely.
 */
export interface ScalePracticeTestHooks {
	configure(root: PitchClass, scaleId: string): void;
	setZone(minFret: number, maxFret: number): void;
	setBpm(bpm: number): void;
	start(): void;
	stop(): void;
	advanceBeat(): void;
}

declare global {
	interface Window {
		__fretfieldScalePracticeTestHooks__?: ScalePracticeTestHooks;
	}
}

export function installScalePracticeTestHooks(): void {
	if (!browser) return;

	window.__fretfieldScalePracticeTestHooks__ = {
		configure(root, scaleId) {
			scalePractice.setRoot(root);
			scalePractice.setScaleId(scaleId);
		},
		setZone(minFret, maxFret) {
			scalePractice.setZone(minFret, maxFret);
		},
		setBpm(bpm) {
			scalePractice.setBpm(bpm);
		},
		start() {
			scalePractice.start();
			// The real scheduler would otherwise keep ticking in the background
			// and race `advanceBeat()` — tests drive every beat by hand instead.
			scalePractice.stopSchedulerForTesting();
		},
		stop() {
			scalePractice.stop();
		},
		advanceBeat() {
			scalePractice.advanceBeatForTesting();
		}
	};
}
