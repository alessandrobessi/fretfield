import type { Page } from '@playwright/test';

/**
 * Shared helpers for driving the app's audio-dependent features through the
 * `FakeAudioSource` test hooks (see src/lib/testing/live-input-test-hooks.ts)
 * — no real microphone or getUserMedia permission is ever requested, so CI
 * never needs real audio hardware.
 */

/**
 * `page.goto()` resolves once navigation/DOMContentLoaded finishes — not
 * once Svelte has hydrated and run `+page.svelte`'s script (which is what
 * actually installs `window.__fretfieldTestHooks__`). That gap is usually
 * imperceptible locally but can be wide enough under CI's slower/more
 * contended runners for a test to call the hook before it exists, so wait
 * for it explicitly rather than assuming it's already there.
 */
async function waitForTestHooks(page: Page): Promise<void> {
	await page.waitForFunction(
		() =>
			(window as unknown as { __fretfieldTestHooks__?: unknown }).__fretfieldTestHooks__ !==
			undefined
	);
}

export async function enableFakeInput(page: Page): Promise<void> {
	await waitForTestHooks(page);
	await page.evaluate(async () => {
		await (
			window as unknown as { __fretfieldTestHooks__: { enableWithFakeSource(): Promise<void> } }
		).__fretfieldTestHooks__.enableWithFakeSource();
	});
}

export async function playNote(page: Page, frequencyHz: number): Promise<void> {
	await page.evaluate((freq) => {
		(
			window as unknown as {
				__fretfieldTestHooks__: { playNote(frequencyHz: number): void };
			}
		).__fretfieldTestHooks__.playNote(freq);
	}, frequencyHz);
}
