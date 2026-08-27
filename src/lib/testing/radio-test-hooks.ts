import { browser } from '$app/environment';

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`/
 * `persistence-test-hooks.ts`, for Radio Mode: `forceRotate` lets
 * `e2e/radio.e2e.ts` prove a rotation applies cleanly (now-playing text
 * changes, playback keeps running) without waiting a real 90-180s. Harmless
 * in production -- it only exposes `RadioDirector`'s own public
 * `forceRotate()`, nothing a normal visitor's click can reach.
 */
export interface RadioTestHooks {
	forceRotate(): void;
}

declare global {
	interface Window {
		__fretfieldRadioTestHooks__?: RadioTestHooks;
	}
}

export function installRadioTestHooks(hooks: RadioTestHooks): void {
	if (!browser) return;
	window.__fretfieldRadioTestHooks__ = hooks;
}
