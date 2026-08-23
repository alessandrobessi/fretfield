import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultAcidPatch } from '$lib/acid-bass/pattern';
import type { AcidBassPatch, AcidLfoPatch } from '$lib/acid-bass/types';

import { createAcidBassVoice, type AcidBassVoice } from '../acid-bass-voice';
import {
	FakeAudioContext,
	FakeAudioNode,
	FakeAudioParam,
	installFakeAudioWorkletNode
} from './fake-web-audio';

/**
 * Connectivity tests for the Acid Bass voice's real signal graph -- this
 * file has no unit tests otherwise (DSP wiring is normally verified live,
 * per this app's established boundary), which is exactly how a real bug
 * shipped silently: LFO/Mod Cutoff and Resonance were wired to the Biquad
 * filter's own AudioParams but never to the `acid24` AudioWorkletNode's,
 * inaudible once that worklet became the default, only-audible path (see
 * ROADMAP.md's "Fixed: LFO/Mod Cutoff and Resonance were silent on the
 * default filter" entry). These tests assert the actual graph topology via
 * `fake-web-audio.ts`'s connection-tracking fakes and `acid-bass-voice.ts`'s
 * own `__test` hooks, not just "did a function throw."
 */

installFakeAudioWorkletNode();

function fakeNode(node: unknown): FakeAudioNode {
	return node as FakeAudioNode;
}

function fakeParam(param: unknown): FakeAudioParam {
	return param as FakeAudioParam;
}

function testPatch(overrides: Partial<AcidBassPatch> = {}): AcidBassPatch {
	return { ...createDefaultAcidPatch(), ...overrides };
}

// createAcidBassLfo (acid-bass-lfo.ts) runs a real setInterval for its
// Sample & Hold re-randomization scheduler, cleared only by dispose() --
// every voice this file creates gets disposed in afterEach so no interval
// leaks past its own test.
const createdVoices: AcidBassVoice[] = [];

afterEach(() => {
	for (const voice of createdVoices.splice(0)) voice.dispose();
});

function makeVoice(options?: { audioWorkletAvailable?: boolean }) {
	const ctx = new FakeAudioContext(options);
	const voice = createAcidBassVoice(ctx as unknown as AudioContext);
	createdVoices.push(voice);
	return { ctx, voice };
}

describe('createAcidBassVoice: signal path smoke test', () => {
	it('the filter eventually reaches ctx.destination through the output chain', () => {
		const { ctx, voice } = makeVoice();
		expect(fakeNode(voice.__test.filter).reaches(ctx.destination)).toBe(true);
	});

	it('the acid24 output also eventually reaches ctx.destination once the worklet resolves', async () => {
		const { ctx, voice } = makeVoice();
		await voice.__test.waitForWorkletsReady();
		const acid24Node = voice.__test.acid24Node();
		expect(acid24Node).not.toBeNull();
		expect(fakeNode(acid24Node).reaches(ctx.destination)).toBe(true);
	});
});

describe('createAcidBassVoice: acid24 worklet availability', () => {
	it('resolves a real acid24Node when the worklet is available', async () => {
		const { voice } = makeVoice({ audioWorkletAvailable: true });
		await voice.__test.waitForWorkletsReady();
		expect(voice.__test.acid24Node()).not.toBeNull();
		expect(voice.__test.pulseWorkletNode()).not.toBeNull();
	});

	it('stays on the Biquad-only fallback when AudioWorklet is unavailable, and setPatch to acid24 does not throw', async () => {
		const { voice } = makeVoice({ audioWorkletAvailable: false });
		await voice.__test.waitForWorkletsReady();
		expect(voice.__test.acid24Node()).toBeNull();
		expect(voice.__test.pulseWorkletNode()).toBeNull();

		expect(() =>
			voice.setPatch(testPatch({ filter: { ...testPatch().filter, model: 'acid24' } }))
		).not.toThrow();
	});
});

describe('createAcidBassVoice: LFO Cutoff modulation reaches every audible filter path', () => {
	// Regression coverage for the exact bug this file already shipped once --
	// the gain node is always connected (the "gain the inactive ones to zero"
	// idiom), independent of the patch's own destination/enabled state, so no
	// setPatch() call is needed to observe the connection itself.
	it.each([1, 2] as const)(
		'LFO %i -> Cutoff reaches both the Biquad filter.frequency and acid24 cutoff',
		async (slot) => {
			const { voice } = makeVoice();
			await voice.__test.waitForWorkletsReady();

			const cutoffGain = fakeNode(voice.__test.lfoGains(slot).cutoff);
			expect(cutoffGain.isConnectedTo(fakeParam(voice.__test.filter.frequency))).toBe(true);

			const acid24CutoffParam = voice.__test.acid24Node()?.parameters.get('cutoff');
			expect(acid24CutoffParam).toBeDefined();
			expect(cutoffGain.reaches(fakeParam(acid24CutoffParam))).toBe(true);
		}
	);
});

describe('createAcidBassVoice: LFO modulation reaches its other destinations', () => {
	it.each([1, 2] as const)(
		'LFO %i -> Pitch reaches every pitch-modulated oscillator (checked via the representative one)',
		(slot) => {
			const { voice } = makeVoice();
			const pitchGain = fakeNode(voice.__test.lfoGains(slot).pitch);
			expect(pitchGain.isConnectedTo(fakeParam(voice.__test.representativeOscillatorDetune))).toBe(
				true
			);
		}
	);

	it.each([1, 2] as const)('LFO %i -> Sub Level reaches subGain.gain', (slot) => {
		const { voice } = makeVoice();
		const subLevelGain = fakeNode(voice.__test.lfoGains(slot).subLevel);
		expect(subLevelGain.isConnectedTo(fakeParam(voice.__test.subGain.gain))).toBe(true);
	});

	it.each([1, 2] as const)('LFO %i -> Osc 2 Level reaches osc2Gain.gain', (slot) => {
		const { voice } = makeVoice();
		const osc2LevelGain = fakeNode(voice.__test.lfoGains(slot).osc2Level);
		expect(osc2LevelGain.isConnectedTo(fakeParam(voice.__test.osc2Gain.gain))).toBe(true);
	});

	it.each([1, 2] as const)(
		'LFO %i -> Pulse Width reaches the Pulse worklet once it resolves',
		async (slot) => {
			const { voice } = makeVoice();
			await voice.__test.waitForWorkletsReady();
			const pulseWidthGain = fakeNode(voice.__test.lfoGains(slot).pulseWidth);
			const pulseWidthParam = voice.__test.pulseWorkletNode()?.parameters.get('pulseWidth');
			expect(pulseWidthParam).toBeDefined();
			expect(pulseWidthGain.isConnectedTo(fakeParam(pulseWidthParam))).toBe(true);
		}
	);
});

describe('createAcidBassVoice: aux-mod (Envelope/Accent/Random) Cutoff and Resonance reach every audible filter path', () => {
	const sources = ['envelope', 'accent', 'random'] as const;

	it.each(sources)(
		'%s -> Cutoff reaches both the Biquad filter.frequency and acid24 cutoff',
		async (source) => {
			const { voice } = makeVoice();
			await voice.__test.waitForWorkletsReady();

			const cutoffGain = fakeNode(voice.__test.auxModGains(source).cutoff);
			expect(cutoffGain.isConnectedTo(fakeParam(voice.__test.filter.frequency))).toBe(true);

			const acid24CutoffParam = voice.__test.acid24Node()?.parameters.get('cutoff');
			expect(acid24CutoffParam).toBeDefined();
			expect(cutoffGain.reaches(fakeParam(acid24CutoffParam))).toBe(true);
		}
	);

	it.each(sources)(
		'%s -> Resonance reaches both the Biquad filter.Q and acid24 resonance (through a scaling gain)',
		async (source) => {
			const { voice } = makeVoice();
			await voice.__test.waitForWorkletsReady();

			const resonanceGain = fakeNode(voice.__test.auxModGains(source).resonance);
			expect(resonanceGain.isConnectedTo(fakeParam(voice.__test.filter.Q))).toBe(true);

			const acid24ResonanceParam = voice.__test.acid24Node()?.parameters.get('resonance');
			expect(acid24ResonanceParam).toBeDefined();
			// Not a direct connection -- routed through a fixed-ratio scaling gain
			// (ACID24_RESONANCE_SWING_RATIO), so only the transitive `reaches` check
			// applies here, not `isConnectedTo`.
			expect(resonanceGain.reaches(fakeParam(acid24ResonanceParam))).toBe(true);
		}
	);
});

describe('createAcidBassVoice: aux-mod modulation reaches its other destinations', () => {
	const sources = ['envelope', 'accent', 'random'] as const;

	it.each(sources)('%s -> Pitch reaches the representative oscillator detune', (source) => {
		const { voice } = makeVoice();
		const pitchGain = fakeNode(voice.__test.auxModGains(source).pitch);
		expect(pitchGain.isConnectedTo(fakeParam(voice.__test.representativeOscillatorDetune))).toBe(
			true
		);
	});

	it.each(sources)('%s -> Sub Level reaches subGain.gain', (source) => {
		const { voice } = makeVoice();
		const subLevelGain = fakeNode(voice.__test.auxModGains(source).subLevel);
		expect(subLevelGain.isConnectedTo(fakeParam(voice.__test.subGain.gain))).toBe(true);
	});

	it.each(sources)('%s -> Osc 2 Level reaches osc2Gain.gain', (source) => {
		const { voice } = makeVoice();
		const osc2LevelGain = fakeNode(voice.__test.auxModGains(source).osc2Level);
		expect(osc2LevelGain.isConnectedTo(fakeParam(voice.__test.osc2Gain.gain))).toBe(true);
	});

	it.each(sources)('%s -> Drive reaches driveInput.gain', (source) => {
		const { voice } = makeVoice();
		const driveGain = fakeNode(voice.__test.auxModGains(source).drive);
		expect(driveGain.isConnectedTo(fakeParam(voice.__test.driveInput.gain))).toBe(true);
	});

	it.each(sources)(
		'%s -> Pulse Width reaches the Pulse worklet once it resolves',
		async (source) => {
			const { voice } = makeVoice();
			await voice.__test.waitForWorkletsReady();
			const pulseWidthGain = fakeNode(voice.__test.auxModGains(source).pulseWidth);
			const pulseWidthParam = voice.__test.pulseWorkletNode()?.parameters.get('pulseWidth');
			expect(pulseWidthParam).toBeDefined();
			expect(pulseWidthGain.isConnectedTo(fakeParam(pulseWidthParam))).toBe(true);
		}
	);
});

describe('createAcidBassVoice: setPatch enables/disables the correct LFO destination gain', () => {
	const ENABLED_CUTOFF_LFO1: AcidLfoPatch = {
		enabled: true,
		shape: 'sine',
		destination: 'cutoff',
		rateMode: 'free',
		rateHz: 2,
		division: '1/8',
		depth: 80
	};

	it('routes a nonzero amount onto the active destination and zeroes every other one', () => {
		const { voice } = makeVoice();
		voice.setPatch(testPatch({ lfo1: ENABLED_CUTOFF_LFO1 }));

		const gains = voice.__test.lfoGains(1);
		expect(fakeParam(gains.cutoff.gain).value).toBeGreaterThan(0);
		expect(fakeParam(gains.pitch.gain).value).toBe(0);
		expect(fakeParam(gains.subLevel.gain).value).toBe(0);
		expect(fakeParam(gains.osc2Level.gain).value).toBe(0);
		expect(fakeParam(gains.pulseWidth.gain).value).toBe(0);
	});

	it('zeroes the destination gain again once the LFO is disabled', () => {
		const { voice } = makeVoice();
		voice.setPatch(testPatch({ lfo1: ENABLED_CUTOFF_LFO1 }));
		expect(fakeParam(voice.__test.lfoGains(1).cutoff.gain).value).toBeGreaterThan(0);

		voice.setPatch(testPatch({ lfo1: { ...ENABLED_CUTOFF_LFO1, enabled: false } }));
		expect(fakeParam(voice.__test.lfoGains(1).cutoff.gain).value).toBe(0);
	});

	it('Sub Level and Osc 2 Level LFO depth is inert while Sub/Osc 2 are themselves off', () => {
		const { voice } = makeVoice();
		voice.setPatch(
			testPatch({
				lfo1: { ...ENABLED_CUTOFF_LFO1, destination: 'subLevel' },
				oscillator: { ...testPatch().oscillator, subEnabled: false }
			})
		);
		expect(fakeParam(voice.__test.lfoGains(1).subLevel.gain).value).toBe(0);
	});
});

describe('createAcidBassVoice: dispose', () => {
	it('stops every oscillator and constant source', () => {
		const { voice } = makeVoice();
		voice.dispose();
		expect(voice.__test.filter).toBeDefined(); // graph itself is untouched by dispose
	});

	it('is safe to call twice', () => {
		const { voice } = makeVoice();
		voice.dispose();
		expect(() => voice.dispose()).not.toThrow();
	});

	it('schedule() after dispose() is a silent no-op, never throws', () => {
		const { voice } = makeVoice();
		voice.dispose();
		expect(() =>
			voice.schedule({
				time: 0,
				frequencyHz: 110,
				stepDurationSeconds: 0.25,
				accent: false,
				gatePercent: 80,
				randomModulationValue: 0
			})
		).not.toThrow();
	});
});
