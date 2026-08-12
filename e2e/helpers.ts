import type { Page } from '@playwright/test';

/**
 * Shared helpers for driving the app's audio-dependent features through the
 * `FakeAudioSource` test hooks (see src/lib/testing/live-input-test-hooks.ts)
 * — no real microphone or getUserMedia permission is ever requested, so CI
 * never needs real audio hardware.
 */

export async function enableFakeInput(page: Page): Promise<void> {
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
