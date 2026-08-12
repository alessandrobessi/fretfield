import { describe, expect, it } from 'vitest';
import { MicrophoneAudioSource } from '../audio-input';

describe('MicrophoneAudioSource — unsupported environment (no browser APIs)', () => {
	it('isSupported() is false without navigator.mediaDevices/AudioContext', () => {
		expect(MicrophoneAudioSource.isSupported()).toBe(false);
	});

	it('listDevices() returns an empty list rather than throwing', async () => {
		const source = new MicrophoneAudioSource();
		await expect(source.listDevices()).resolves.toEqual([]);
	});

	it('start() rejects with a descriptive error instead of throwing synchronously', async () => {
		const source = new MicrophoneAudioSource();
		await expect(source.start(null, () => {})).rejects.toThrow(/not supported/i);
	});

	it('stop() is always safe to call, even if start() was never called or failed', () => {
		const source = new MicrophoneAudioSource();
		expect(() => source.stop()).not.toThrow();
	});
});
