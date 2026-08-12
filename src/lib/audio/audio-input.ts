import type { AudioInputDevice, LiveAudioSource } from './types';

export interface AudioInputOptions {
	fftSize?: number;
}

const DEFAULT_FFT_SIZE = 4096;

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
	if (typeof window === 'undefined') return null;
	const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
	return withWebkit.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

/**
 * Real browser microphone/interface capture: `getUserMedia` → `AudioContext`
 * → `MediaStreamAudioSourceNode` → `AnalyserNode`, polled once per animation
 * frame. Deliberately not an `AudioWorklet` — a polled `AnalyserNode` is
 * simpler and plenty fast for monophonic bass pitch detection; only worth
 * revisiting if that polling is ever shown to cause visible jank.
 */
export class MicrophoneAudioSource implements LiveAudioSource {
	private readonly fftSize: number;
	private audioContext: AudioContext | null = null;
	private mediaStream: MediaStream | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private analyserNode: AnalyserNode | null = null;
	private timeDomainBuffer: Float32Array<ArrayBuffer> | null = null;
	private animationFrameId: number | null = null;

	constructor(options: AudioInputOptions = {}) {
		this.fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
	}

	static isSupported(): boolean {
		return (
			typeof navigator !== 'undefined' &&
			navigator.mediaDevices !== undefined &&
			typeof navigator.mediaDevices.getUserMedia === 'function' &&
			resolveAudioContextConstructor() !== null
		);
	}

	/** Device labels are only populated once permission has been granted at least once. */
	async listDevices(): Promise<AudioInputDevice[]> {
		if (!MicrophoneAudioSource.isSupported()) return [];
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices
			.filter((device) => device.kind === 'audioinput')
			.map((device, index) => ({
				deviceId: device.deviceId,
				label: device.label || `Input ${index + 1}`
			}));
	}

	async start(
		deviceId: string | null,
		onFrame: (samples: Float32Array, sampleRate: number) => void,
		onError?: (error: Error) => void
	): Promise<void> {
		if (!MicrophoneAudioSource.isSupported()) {
			throw new Error('Audio input is not supported in this browser.');
		}

		this.stop();

		this.mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
				...(deviceId ? { deviceId: { exact: deviceId } } : {})
			}
		});

		for (const track of this.mediaStream.getTracks()) {
			track.addEventListener('ended', () => {
				this.stop();
				onError?.(new Error('The audio input device was disconnected.'));
			});
		}

		const AudioContextCtor = resolveAudioContextConstructor();
		if (AudioContextCtor === null) {
			this.stop();
			throw new Error('Audio input is not supported in this browser.');
		}
		this.audioContext = new AudioContextCtor();
		if (this.audioContext.state === 'suspended') {
			await this.audioContext.resume();
		}

		this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = this.fftSize;
		this.sourceNode.connect(this.analyserNode);
		this.timeDomainBuffer = new Float32Array(this.analyserNode.fftSize);

		const sampleRate = this.audioContext.sampleRate;
		const poll = (): void => {
			if (!this.analyserNode || !this.timeDomainBuffer) return;
			this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
			onFrame(this.timeDomainBuffer, sampleRate);
			this.animationFrameId = requestAnimationFrame(poll);
		};
		this.animationFrameId = requestAnimationFrame(poll);
	}

	stop(): void {
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
		if (this.analyserNode) {
			this.analyserNode.disconnect();
			this.analyserNode = null;
		}
		if (this.mediaStream) {
			for (const track of this.mediaStream.getTracks()) {
				track.stop();
			}
			this.mediaStream = null;
		}
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
		}
		this.timeDomainBuffer = null;
	}
}
