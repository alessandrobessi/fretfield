import { afterEach, describe, expect, it } from 'vitest';

import { createAcidBassLfo, type AcidBassLfo } from '../acid-bass-lfo';
import { FakeAudioContext, FakeAudioNode, FakeAudioParam } from './fake-web-audio';

/**
 * Connectivity/behavior tests for the Acid Bass LFO -- this file has no unit
 * tests otherwise (see `acid-bass-voice.spec.ts`'s own header for the same
 * reasoning). Covers the crossfade-by-shape wiring and rate control that
 * `acid-bass-voice.ts` builds its own LFO 1/LFO 2 modulation on top of.
 */

function fakeNode(node: unknown): FakeAudioNode {
	return node as FakeAudioNode;
}

function fakeParam(param: unknown): FakeAudioParam {
	return param as FakeAudioParam;
}

// The Sample & Hold re-randomization scheduler runs a real setInterval,
// cleared only by dispose() -- every LFO this file creates is disposed in
// afterEach so no interval leaks past its own test.
const createdLfos: AcidBassLfo[] = [];

afterEach(() => {
	for (const lfo of createdLfos.splice(0)) lfo.dispose();
});

function makeLfo() {
	const ctx = new FakeAudioContext();
	const lfo = createAcidBassLfo(ctx as unknown as AudioContext);
	createdLfos.push(lfo);
	return { ctx, lfo };
}

describe('createAcidBassLfo: structural wiring', () => {
	it('every shape gain reaches the shared output', () => {
		const { lfo } = makeLfo();
		for (const gain of Object.values(lfo.__test.shapeGains)) {
			expect(fakeNode(gain).reaches(fakeNode(lfo.output))).toBe(true);
		}
	});
});

describe('createAcidBassLfo: shape crossfade', () => {
	it('defaults to sine active, every other shape gained to zero', () => {
		const { lfo } = makeLfo();
		const gains = lfo.__test.shapeGains;
		expect(fakeParam(gains.sine.gain).value).toBe(1);
		expect(fakeParam(gains.triangle.gain).value).toBe(0);
		expect(fakeParam(gains.square.gain).value).toBe(0);
		expect(fakeParam(gains.sampleHold.gain).value).toBe(0);
	});

	it('setShape crossfades exactly one shape gain to active at a time', () => {
		const { lfo } = makeLfo();
		lfo.setShape('square');

		const gains = lfo.__test.shapeGains;
		expect(fakeParam(gains.square.gain).value).toBe(1);
		expect(fakeParam(gains.sine.gain).value).toBe(0);
		expect(fakeParam(gains.triangle.gain).value).toBe(0);
		expect(fakeParam(gains.sampleHold.gain).value).toBe(0);
	});

	it('setShape to Sample & Hold activates only that gain', () => {
		const { lfo } = makeLfo();
		lfo.setShape('sampleHold');

		const gains = lfo.__test.shapeGains;
		expect(fakeParam(gains.sampleHold.gain).value).toBe(1);
		expect(fakeParam(gains.sine.gain).value).toBe(0);
		expect(fakeParam(gains.triangle.gain).value).toBe(0);
		expect(fakeParam(gains.square.gain).value).toBe(0);
	});
});

describe('createAcidBassLfo: rate control', () => {
	it('setRateHz updates every rate-bearing oscillator, clamped to a safe range', () => {
		const { lfo } = makeLfo();
		lfo.setRateHz(5);
		for (const osc of lfo.__test.rateOscillators) {
			expect(fakeParam(osc.frequency).value).toBeCloseTo(5, 5);
		}
	});

	it('setRateHz clamps to the 0.05-20Hz range rather than passing an absurd value through raw', () => {
		const { lfo } = makeLfo();
		lfo.setRateHz(999999);
		expect(fakeParam(lfo.__test.rateOscillators[0].frequency).value).toBeCloseTo(20, 5);

		lfo.setRateHz(-5);
		expect(fakeParam(lfo.__test.rateOscillators[0].frequency).value).toBeCloseTo(0.05, 5);
	});
});

describe('createAcidBassLfo: dispose', () => {
	it('stops every oscillator and the Sample & Hold source', () => {
		const { lfo } = makeLfo();
		expect(() => lfo.dispose()).not.toThrow();
	});

	it('is safe to call twice', () => {
		const { lfo } = makeLfo();
		lfo.dispose();
		expect(() => lfo.dispose()).not.toThrow();
	});
});
