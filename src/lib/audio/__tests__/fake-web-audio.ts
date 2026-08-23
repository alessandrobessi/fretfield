/**
 * A minimal, connection-tracking fake of the Web Audio API -- enough surface
 * for `acid-bass-voice.ts`/`acid-bass-lfo.ts` to build their real node graph
 * under vitest's plain `node` environment (no real Web Audio implementation
 * available there), and enough introspection (`isConnectedTo`) to assert the
 * actual signal-graph topology a real `AudioContext` would produce -- not
 * just that graph construction ran without throwing.
 *
 * Built specifically to catch the class of bug this codebase's own
 * `acid-bass-voice.ts` already shipped once: LFO/Mod Cutoff and Resonance
 * gain nodes connected to the Biquad filter's AudioParams but never to the
 * `acid24` AudioWorkletNode's own params, once that worklet became the
 * default and only audible path. A UI-level or store-level test can never
 * see that kind of gap -- only a real connectivity assertion on the actual
 * graph can.
 */

/* eslint-disable @typescript-eslint/no-unused-vars -- every method below matches a real Web Audio API signature (AudioParam automation methods, node factory options) verbatim, including arguments this fake has no use for (timing, curves, max delay) but must still accept so real call sites type-check against it. */

export class FakeAudioParam {
	value: number;
	private readonly connectedFrom = new Set<FakeAudioNode>();

	constructor(defaultValue = 0) {
		this.value = defaultValue;
	}

	setValueAtTime(value: number, _time: number): FakeAudioParam {
		this.value = value;
		return this;
	}
	linearRampToValueAtTime(value: number, _time: number): FakeAudioParam {
		this.value = value;
		return this;
	}
	exponentialRampToValueAtTime(value: number, _time: number): FakeAudioParam {
		this.value = value;
		return this;
	}
	setTargetAtTime(value: number, _time: number, _timeConstant: number): FakeAudioParam {
		this.value = value;
		return this;
	}
	cancelScheduledValues(_time: number): FakeAudioParam {
		return this;
	}
	cancelAndHoldAtTime(_time: number): FakeAudioParam {
		return this;
	}

	/** @internal -- called by `FakeAudioNode.connect`/`disconnect`, not for direct use in tests. */
	_registerIncoming(node: FakeAudioNode): void {
		this.connectedFrom.add(node);
	}
	/** @internal */
	_unregisterIncoming(node: FakeAudioNode): void {
		this.connectedFrom.delete(node);
	}
	isConnectedFrom(node: FakeAudioNode): boolean {
		return this.connectedFrom.has(node);
	}
}

export class FakeAudioNode {
	private readonly outputs = new Set<FakeAudioNode | FakeAudioParam>();

	connect(target: FakeAudioNode | FakeAudioParam): FakeAudioNode | FakeAudioParam {
		this.outputs.add(target);
		if (target instanceof FakeAudioParam) target._registerIncoming(this);
		return target;
	}

	disconnect(target?: FakeAudioNode | FakeAudioParam): void {
		if (target === undefined) {
			for (const out of this.outputs) {
				if (out instanceof FakeAudioParam) out._unregisterIncoming(this);
			}
			this.outputs.clear();
			return;
		}
		this.outputs.delete(target);
		if (target instanceof FakeAudioParam) target._unregisterIncoming(this);
	}

	/** Direct (one-hop) connection only -- for asserting "this specific gain feeds that specific param/node," the shape most of this file's own routing bugs actually take. */
	isConnectedTo(target: FakeAudioNode | FakeAudioParam): boolean {
		return this.outputs.has(target);
	}

	/** True if `target` is reachable through any chain of connections -- for "does this signal eventually reach the output," not just one hop. */
	reaches(target: FakeAudioNode | FakeAudioParam, seen: Set<FakeAudioNode> = new Set()): boolean {
		if (this.outputs.has(target)) return true;
		if (seen.has(this)) return false;
		seen.add(this);
		for (const out of this.outputs) {
			if (out instanceof FakeAudioNode && out.reaches(target, seen)) return true;
		}
		return false;
	}
}

export class FakeGainNode extends FakeAudioNode {
	readonly gain = new FakeAudioParam(1);
}

export class FakeOscillatorNode extends FakeAudioNode {
	type = 'sine';
	readonly frequency = new FakeAudioParam(440);
	readonly detune = new FakeAudioParam(0);
	started = false;
	stopped = false;
	setPeriodicWave(_wave: unknown): void {}
	start(_time?: number): void {
		this.started = true;
	}
	stop(_time?: number): void {
		this.stopped = true;
	}
}

export class FakeBiquadFilterNode extends FakeAudioNode {
	type = 'lowpass';
	readonly frequency = new FakeAudioParam(350);
	readonly Q = new FakeAudioParam(1);
}

export class FakeWaveShaperNode extends FakeAudioNode {
	curve: Float32Array | null = null;
	oversample = 'none';
}

export class FakeConstantSourceNode extends FakeAudioNode {
	readonly offset = new FakeAudioParam(1);
	started = false;
	stopped = false;
	start(_time?: number): void {
		this.started = true;
	}
	stop(_time?: number): void {
		this.stopped = true;
	}
}

export class FakeDelayNode extends FakeAudioNode {
	readonly delayTime = new FakeAudioParam(0);
}

/** Enough of `AnalyserNode` for `AcidBassAudioScope.svelte`'s own read calls (`getByteFrequencyData`/`getByteTimeDomainData`) to have somewhere real to write -- returns silence (0/128, matching a real idle analyser's output), not meaningful signal data; this fake has no actual DSP/FFT behind it. */
export class FakeAnalyserNode extends FakeAudioNode {
	fftSize = 2048;
	readonly context: { sampleRate: number };

	constructor(context: { sampleRate: number }) {
		super();
		this.context = context;
	}

	get frequencyBinCount(): number {
		return this.fftSize / 2;
	}

	getByteFrequencyData(array: Uint8Array): void {
		array.fill(0);
	}

	getByteTimeDomainData(array: Uint8Array): void {
		array.fill(128);
	}
}

/**
 * Processor name -> its own AudioParam names, mirroring the real
 * `static/acid-*-processor.js` files' own `parameterDescriptors` -- kept in
 * sync by hand since a plain Node test has no way to load a real
 * `AudioWorkletProcessor` and read its static descriptors.
 */
const WORKLET_PARAMETER_NAMES: Record<string, string[]> = {
	'acid-filter-processor': ['cutoff', 'resonance', 'drive'],
	'acid-pulse-oscillator-processor': ['frequency', 'pulseWidth']
};

export class FakeAudioWorkletNode extends FakeAudioNode {
	readonly parameters: Map<string, FakeAudioParam>;

	constructor(_ctx: FakeAudioContext, processorName: string, _options?: unknown) {
		super();
		const names = WORKLET_PARAMETER_NAMES[processorName] ?? [];
		this.parameters = new Map(names.map((name) => [name, new FakeAudioParam()]));
	}
}

export interface FakeAudioContextOptions {
	/** Simulates a browser with no AudioWorklet support, or the module fetch/registration failing -- `createAcid24WorkletNode`/`createPulseOscillatorWorkletNode` both resolve to `null` in this case, per their own no-throw contract. Defaults to available. */
	audioWorkletAvailable?: boolean;
}

export class FakeAudioContext {
	currentTime = 0;
	sampleRate = 44100;
	readonly destination = new FakeAudioNode();
	readonly audioWorklet?: { addModule(url: string): Promise<void> };

	constructor(options: FakeAudioContextOptions = {}) {
		if (options.audioWorkletAvailable ?? true) {
			this.audioWorklet = { addModule: async () => {} };
		}
	}

	createOscillator(): FakeOscillatorNode {
		return new FakeOscillatorNode();
	}
	createGain(): FakeGainNode {
		return new FakeGainNode();
	}
	createBiquadFilter(): FakeBiquadFilterNode {
		return new FakeBiquadFilterNode();
	}
	createWaveShaper(): FakeWaveShaperNode {
		return new FakeWaveShaperNode();
	}
	createConstantSource(): FakeConstantSourceNode {
		return new FakeConstantSourceNode();
	}
	createAnalyser(): FakeAnalyserNode {
		return new FakeAnalyserNode(this);
	}
	createDelay(_maxDelayTime?: number): FakeDelayNode {
		return new FakeDelayNode();
	}
	createPeriodicWave(_real: Float32Array, _imag: Float32Array): object {
		return {};
	}
}

/**
 * Installs the fake `AudioWorkletNode` global that `acid-worklet-node.ts`
 * constructs directly (`new AudioWorkletNode(ctx, name, options)`, not via
 * `ctx.createAudioWorkletNode`) -- call once per test file, before creating
 * any voice that should have a working `acid24`/Pulse worklet path.
 */
export function installFakeAudioWorkletNode(): void {
	(globalThis as { AudioWorkletNode?: unknown }).AudioWorkletNode = FakeAudioWorkletNode;
}
