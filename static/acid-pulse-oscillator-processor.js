/**
 * The Pulse oscillator's AudioWorkletProcessor (M11): a PolyBLEP
 * band-limited pulse wave with a live, a-rate `pulseWidth` AudioParam --
 * see src/lib/acid-bass/pulse-oscillator.ts for the same algorithm as an
 * independently unit-tested pure function (AudioWorkletProcessor can't run
 * inside Vitest's jsdom environment, which has no Web Audio API at all).
 *
 * Deliberately plain, dependency-free JS -- no imports, not run through
 * Vite's bundler, loaded at runtime as a static asset via
 * `acid-worklet-node.ts`'s base-aware `addModule()` URL. Keep this file's
 * math in sync by hand with pulse-oscillator.ts if it ever changes.
 *
 * frequency/pulseWidth are AudioParams (not postMessage), the same
 * automation approach every other node in this voice already uses --
 * `pulseWidth` being genuinely a-rate is the whole point of this file: it's
 * what makes "LFO -> Pulse Width" sample-accurate instead of the static,
 * regenerate-on-patch-change `PeriodicWave` approximation used before this
 * milestone.
 */

class AcidPulseOscillatorProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{ name: 'frequency', defaultValue: 110, minValue: 1, maxValue: 20000, automationRate: 'a-rate' },
			{ name: 'pulseWidth', defaultValue: 0.5, minValue: 0.05, maxValue: 0.95, automationRate: 'a-rate' }
		];
	}

	constructor() {
		super();
		this.phase = 0;
	}

	process(_inputs, outputs, parameters) {
		const outputChannel = outputs[0] && outputs[0][0];
		if (!outputChannel) return true;

		const frequencyParam = parameters.frequency;
		const pulseWidthParam = parameters.pulseWidth;

		for (let i = 0; i < outputChannel.length; i++) {
			const frequencyHz = frequencyParam.length > 1 ? frequencyParam[i] : frequencyParam[0];
			const pulseWidth = pulseWidthParam.length > 1 ? pulseWidthParam[i] : pulseWidthParam[0];
			const phaseIncrement = frequencyHz / sampleRate;

			let value = this.phase < pulseWidth ? 1 : -1;
			value += polyBlep(this.phase, phaseIncrement);
			const fallEdgePhase = (this.phase + (1 - pulseWidth)) % 1;
			value -= polyBlep(fallEdgePhase, phaseIncrement);
			outputChannel[i] = value;

			const nextPhase = this.phase + phaseIncrement;
			this.phase = nextPhase - Math.floor(nextPhase);
		}

		return true;
	}
}

function polyBlep(t, dt) {
	if (dt <= 0) return 0;
	if (t < dt) {
		const x = t / dt;
		return x + x - x * x - 1;
	}
	if (t > 1 - dt) {
		const x = (t - 1) / dt;
		return x * x + x + x + 1;
	}
	return 0;
}

registerProcessor('acid-pulse-oscillator-processor', AcidPulseOscillatorProcessor);
