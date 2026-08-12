import { browser } from '$app/environment';
import type { IntervalId } from '$lib/music/intervals';
import type { PracticeMode } from '$lib/practice/types';
import { practice } from '$lib/stores/practice.svelte';

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`, for the one
 * piece of Guided Practice that's otherwise nondeterministic: which target
 * an exercise picks. `startPractice`'s optional `interval` reuses the real
 * `PracticeStore.start()` pinning capability (not a test-only code path) so
 * e2e tests don't depend on `Math.random()`.
 */
export interface PracticeTestHooks {
	startPractice(mode: PracticeMode, interval?: IntervalId): void;
	nextExercise(): void;
}

declare global {
	interface Window {
		__fretfieldPracticeTestHooks__?: PracticeTestHooks;
	}
}

export function installPracticeTestHooks(): void {
	if (!browser) return;

	window.__fretfieldPracticeTestHooks__ = {
		startPractice(mode, interval) {
			practice.start(mode, interval ? { interval } : undefined);
		},
		nextExercise() {
			practice.next();
		}
	};
}
