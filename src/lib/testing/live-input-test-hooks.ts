import { browser } from '$app/environment';
import type { AudioInputDevice } from '$lib/audio/types';
import { DEFAULT_PITCH_DETECTOR_CONFIG } from '$lib/audio/types';
import { liveInput } from '$lib/stores/live-input.svelte';

/**
 * The injectable seam CI/Playwright needs (product spec §20): swaps the real
 * `MicrophoneAudioSource` for a deterministic `FakeAudioSource` and exposes a
 * small driver on `window` so e2e tests can simulate played notes without any
 * real microphone. Harmless in production — it only lets a test *replace*
 * the capture backend, which requires deliberately calling this API; no
 * normal user interaction reaches it.
 */
export interface LiveInputTestHooks {
	enableWithFakeSource(devices?: AudioInputDevice[]): Promise<void>;
	playNote(frequencyHz: number, frames?: number): void;
	silence(frames?: number): void;
	disable(): void;
}

declare global {
	interface Window {
		__fretfieldTestHooks__?: LiveInputTestHooks;
	}
}

export function installLiveInputTestHooks(): void {
	if (!browser) return;

	let fake: import('$lib/audio/fake-audio-source').FakeAudioSource | null = null;

	window.__fretfieldTestHooks__ = {
		async enableWithFakeSource(devices) {
			const { FakeAudioSource } = await import('$lib/audio/fake-audio-source');
			fake = new FakeAudioSource(devices ? { devices } : undefined);
			liveInput.useSource(fake);
			await liveInput.enable();
		},
		playNote(frequencyHz, frames = 4) {
			if (fake === null) throw new Error('Call enableWithFakeSource() first.');
			for (let i = 0; i < frames; i++) {
				fake.pushSine(frequencyHz, DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize, 0.5);
			}
		},
		silence(frames = 5) {
			if (fake === null) throw new Error('Call enableWithFakeSource() first.');
			for (let i = 0; i < frames; i++) {
				fake.pushSilence(DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize);
			}
		},
		disable() {
			liveInput.disable();
			fake = null;
		}
	};
}
