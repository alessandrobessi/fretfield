import { browser } from '$app/environment';

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`/
 * `persistence-test-hooks.ts`, for Radio Mode: `forceRotate` lets
 * `e2e/radio.e2e.ts` prove a rotation applies cleanly (now-playing text
 * changes, playback keeps running) without waiting a real 90-180s.
 * `getAcidBassState` exists specifically because "the bass isn't audible" is
 * the one class of bug this page's own UI gives no visible signal for (no
 * Bass tab, no enabled/mode readout) -- a direct read is the only way to
 * confirm the fix (a `GroovePreset`'s own baked-in `Groove` silently
 * disabling Acid Bass on every rotation) actually holds, live or in e2e.
 * Harmless in production either way -- read-only, or a call to
 * `RadioDirector`'s own public `forceRotate()`, nothing a normal visitor's
 * click can reach.
 */
export interface RadioTestHooks {
	forceRotate(): void;
	getAcidBassState(): { enabled: boolean; mode: string };
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
