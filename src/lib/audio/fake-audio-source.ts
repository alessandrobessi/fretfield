import type { AudioInputDevice, LiveAudioSource } from './types';

export interface FakeAudioSourceOptions {
	devices?: AudioInputDevice[];
	sampleRate?: number;
}

/**
 * Deterministic `LiveAudioSource` for tests — no real microphone required.
 * Tests call `pushFrame`/`pushSine`/`pushSilence` to drive whatever's
 * downstream (the pitch detector, tracker, store, or a Playwright page)
 * exactly like a real capture chain would, one frame at a time.
 */
export class FakeAudioSource implements LiveAudioSource {
	private devices: AudioInputDevice[];
	private readonly sampleRate: number;
	private onFrame: ((samples: Float32Array, sampleRate: number) => void) | null = null;
	private onError: ((error: Error) => void) | null = null;
	private startedDeviceId: string | null = null;

	constructor(options: FakeAudioSourceOptions = {}) {
		this.devices = options.devices ?? [{ deviceId: 'fake-device-1', label: 'Fake Test Interface' }];
		this.sampleRate = options.sampleRate ?? 48000;
	}

	async listDevices(): Promise<AudioInputDevice[]> {
		return this.devices;
	}

	setDevices(devices: AudioInputDevice[]): void {
		this.devices = devices;
	}

	async start(
		deviceId: string | null,
		onFrame: (samples: Float32Array, sampleRate: number) => void,
		onError?: (error: Error) => void
	): Promise<void> {
		this.onFrame = onFrame;
		this.onError = onError ?? null;
		this.startedDeviceId = deviceId;
	}

	stop(): void {
		this.onFrame = null;
		this.onError = null;
		this.startedDeviceId = null;
	}

	isStarted(): boolean {
		return this.onFrame !== null;
	}

	getStartedDeviceId(): string | null {
		return this.startedDeviceId;
	}

	pushFrame(samples: Float32Array): void {
		if (!this.onFrame) {
			throw new Error('FakeAudioSource.pushFrame called before start().');
		}
		this.onFrame(samples, this.sampleRate);
	}

	pushSilence(length: number): void {
		this.pushFrame(new Float32Array(length));
	}

	pushSine(frequencyHz: number, length: number, amplitude = 0.5): void {
		const samples = new Float32Array(length);
		for (let i = 0; i < length; i++) {
			samples[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / this.sampleRate);
		}
		this.pushFrame(samples);
	}

	/** Simulates the device being unplugged mid-session. */
	simulateDisconnect(): void {
		const callback = this.onError;
		this.stop();
		callback?.(new Error('Fake audio input device was disconnected.'));
	}
}
