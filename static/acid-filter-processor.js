/**
 * The Acid 24 filter's AudioWorkletProcessor
 * (~/Downloads/ACID-BASS-ENGINE-V2.md M10): a cascaded 4-stage one-pole
 * ladder with tanh-saturated global feedback -- see
 * src/lib/acid-bass/acid24-ladder.ts for the same algorithm as an
 * independently unit-tested pure function (AudioWorkletProcessor can't run
 * inside Vitest's jsdom environment, which has no Web Audio API at all).
 *
 * Deliberately plain, dependency-free JS -- no imports, not run through
 * Vite's bundler, loaded at runtime as a static asset via
 * `acid-worklet-node.ts`'s base-aware `addModule()` URL. Keep this file's
 * math in sync by hand with acid24-ladder.ts if it ever changes; nothing
 * enforces that automatically.
 *
 * cutoff/resonance/drive are AudioParams (not postMessage) so the main
 * thread never has to post a value every audio frame -- the same
 * AudioParam-automation approach every other node in this voice already
 * uses.
 */

class AcidFilterProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{ name: 'cutoff', defaultValue: 1000, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
			{ name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 4, automationRate: 'a-rate' },
			{ name: 'drive', defaultValue: 1, minValue: 1, maxValue: 10, automationRate: 'a-rate' }
		];
	}

	constructor() {
		super();
		this.stage0 = 0;
		this.stage1 = 0;
		this.stage2 = 0;
		this.stage3 = 0;
	}

	process(inputs, outputs, parameters) {
		const inputChannel = inputs[0] && inputs[0][0];
		const outputChannel = outputs[0] && outputs[0][0];
		if (!outputChannel) return true;

		const cutoffParam = parameters.cutoff;
		const resonanceParam = parameters.resonance;
		const driveParam = parameters.drive;

		for (let i = 0; i < outputChannel.length; i++) {
			const cutoffHz = cutoffParam.length > 1 ? cutoffParam[i] : cutoffParam[0];
			const resonance = resonanceParam.length > 1 ? resonanceParam[i] : resonanceParam[0];
			const drive = driveParam.length > 1 ? driveParam[i] : driveParam[0];

			// Same `1 - e^(-2*pi*f/fs)` one-pole coefficient as
			// cutoffHzToOnePoleCoefficient, clamped to [0, 1] (the range that
			// keeps a single one-pole stage unconditionally stable).
			const g = Math.min(1, Math.max(0, 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate)));

			const input = inputChannel ? inputChannel[i] : 0;

			// Both the feedback path and the driven input pass through
			// Math.tanh, which is what keeps every stage bounded to roughly
			// (-1, 1) regardless of how extreme resonance/drive get -- the
			// whole reason this topology can't produce NaN or an unbounded
			// runaway, even at self-oscillation.
			const feedback = resonance * Math.tanh(this.stage3);
			const driven = Math.tanh(input * drive - feedback);
			this.stage0 += g * (driven - this.stage0);
			this.stage1 += g * (this.stage0 - this.stage1);
			this.stage2 += g * (this.stage1 - this.stage2);
			this.stage3 += g * (this.stage2 - this.stage3);

			outputChannel[i] = this.stage3;
		}

		return true;
	}
}

registerProcessor('acid-filter-processor', AcidFilterProcessor);
