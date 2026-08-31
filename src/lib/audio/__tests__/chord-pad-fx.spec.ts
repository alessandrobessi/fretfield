import { describe, expect, it } from 'vitest';

import { delayDivisionToSeconds } from '$lib/chord-pad-fx/resolve';
import { createDefaultChordPadFxState } from '$lib/chord-pad-fx/pattern';
import type { ChordPadFxState } from '$lib/chord-pad-fx/types';

import { volumeToGain } from '../gain';
import { createChordPadFxBus } from '../chord-pad-fx';
import { FakeAudioContext, FakeAudioNode, FakeAudioParam } from './fake-web-audio';

/**
 * Connectivity/behavior tests for the Chord Pad's FX bus -- mirrors
 * `acid-bass-voice.spec.ts`'s own style: this file has no other test
 * coverage (DSP wiring is normally verified live), so these assert the
 * actual graph topology and resolved parameter values via
 * `fake-web-audio.ts`'s connection-tracking fakes and `chord-pad-fx.ts`'s
 * own `__test` hooks, not just "did a function throw."
 */

function fakeNode(node: unknown): FakeAudioNode {
	return node as FakeAudioNode;
}

function fakeParam(param: unknown): FakeAudioParam {
	return param as FakeAudioParam;
}

function makeBus() {
	const ctx = new FakeAudioContext();
	const bus = createChordPadFxBus(ctx as unknown as AudioContext);
	return { ctx, bus };
}

function stateWith(overrides: Partial<ChordPadFxState>): ChordPadFxState {
	return { ...createDefaultChordPadFxState(), ...overrides };
}

describe('createChordPadFxBus: signal path', () => {
	it('input reaches ctx.destination through the always-on dry path, even with every stage off (the fresh-bus default)', () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.input).reaches(ctx.destination)).toBe(true);
	});

	it("each stage's wet send genuinely reaches ctx.destination, not a dead-end branch", () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.__test.fuzzSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.chorusSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.delaySend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.reverbSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.phaserSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.flangerSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.tremoloGain).reaches(ctx.destination)).toBe(true);
	});

	it('input reaches the fuzz send (Fuzz is genuinely first in the chain)', () => {
		const { bus } = makeBus();
		expect(fakeNode(bus.input).reaches(fakeNode(bus.__test.fuzzSend))).toBe(true);
	});

	it("the flanger's own feedback loop reaches ctx.destination (the wet return)", () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.__test.flangerDelay).reaches(ctx.destination)).toBe(true);
	});

	it("the delay node's own output reaches ctx.destination (the wet return, downstream of Reverb)", () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.__test.delayNode).reaches(ctx.destination)).toBe(true);
	});
});

describe('createChordPadFxBus: setPatch resolves disabled/zero-mix stages to exactly dry', () => {
	it('every stage defaults off, so every wet-send gain resolves to 0, and tremoloGain resolves to a constant 1 (exactly dry)', () => {
		const { bus } = makeBus();
		bus.setPatch(createDefaultChordPadFxState(), 0);
		expect(fakeParam(bus.__test.fuzzSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.phaserSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.flangerSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.tremoloGain.gain).value).toBe(1);
	});

	it("enabling a stage with mix 0 still resolves that stage's wet-send gain to 0", () => {
		const { bus } = makeBus();
		const state = stateWith({
			fuzz: { enabled: true, drive: 50, mix: 0 },
			reverb: { enabled: true, size: 80, damping: 20, mix: 0 },
			delay: { enabled: true, division: '1/8', feedback: 50, mix: 0 },
			chorus: { enabled: true, rate: 1, depth: 50, mix: 0 },
			phaser: { enabled: true, rate: 0.5, depth: 50, mix: 0 },
			flanger: { enabled: true, rate: 0.5, depth: 50, feedback: 30, mix: 0 }
		});
		bus.setPatch(state, 0);
		expect(fakeParam(bus.__test.fuzzSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.phaserSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.flangerSend.gain).value).toBe(0);
	});

	it('enabling a stage with a nonzero mix resolves a nonzero wet-send gain', () => {
		const { bus } = makeBus();
		const state = stateWith({
			fuzz: { enabled: true, drive: 50, mix: 45 },
			reverb: { enabled: true, size: 80, damping: 20, mix: 60 },
			delay: { enabled: true, division: '1/8', feedback: 50, mix: 40 },
			chorus: { enabled: true, rate: 1, depth: 50, mix: 35 },
			phaser: { enabled: true, rate: 0.5, depth: 50, mix: 30 },
			flanger: { enabled: true, rate: 0.5, depth: 50, feedback: 30, mix: 25 }
		});
		bus.setPatch(state, 0);
		expect(fakeParam(bus.__test.fuzzSend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.phaserSend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.flangerSend.gain).value).toBeGreaterThan(0);
	});

	it('disabling Tremolo, or enabling it with depth 0, both hold tremoloGain at a constant 1 (exactly dry)', () => {
		const { bus } = makeBus();
		bus.setPatch(stateWith({ tremolo: { enabled: false, rate: 4, depth: 80 } }), 0);
		expect(fakeParam(bus.__test.tremoloGain.gain).value).toBe(1);

		bus.setPatch(stateWith({ tremolo: { enabled: true, rate: 4, depth: 0 } }), 0);
		expect(fakeParam(bus.__test.tremoloGain.gain).value).toBe(1);
	});

	it('enabling Tremolo with a nonzero depth pulls tremoloGain below 1', () => {
		const { bus } = makeBus();
		bus.setPatch(stateWith({ tremolo: { enabled: true, rate: 4, depth: 80 } }), 0);
		expect(fakeParam(bus.__test.tremoloGain.gain).value).toBeLessThan(1);
	});
});

describe('createChordPadFxBus: fuzz drive resolution', () => {
	it('drive 0 means unity (clean) pregain, drive 100 means a much higher pregain', () => {
		const { bus } = makeBus();
		bus.setPatch(stateWith({ fuzz: { enabled: true, drive: 0, mix: 30 } }), 0);
		expect(fakeParam(bus.__test.fuzzPregain.gain).value).toBe(1);

		bus.setPatch(stateWith({ fuzz: { enabled: true, drive: 100, mix: 30 } }), 0);
		expect(fakeParam(bus.__test.fuzzPregain.gain).value).toBeGreaterThan(1);
	});
});

describe('createChordPadFxBus: flanger feedback resolution', () => {
	it('feedback 0 means no feedback gain, feedback 100 means high (but still sub-unity) feedback gain', () => {
		const { bus } = makeBus();
		bus.setPatch(
			stateWith({ flanger: { enabled: true, rate: 0.5, depth: 50, feedback: 0, mix: 30 } }),
			0
		);
		expect(fakeParam(bus.__test.flangerFeedback.gain).value).toBe(0);

		bus.setPatch(
			stateWith({ flanger: { enabled: true, rate: 0.5, depth: 50, feedback: 100, mix: 30 } }),
			0
		);
		const feedback = fakeParam(bus.__test.flangerFeedback.gain).value;
		expect(feedback).toBeGreaterThan(0);
		expect(feedback).toBeLessThan(1);
	});
});

describe('createChordPadFxBus: reverb size/damping reach every comb filter', () => {
	it("size scales the comb filters' own feedback gain, damping scales their lowpass cutoff", () => {
		const { bus } = makeBus();
		bus.setPatch(stateWith({ reverb: { enabled: true, size: 100, damping: 0, mix: 50 } }), 0);
		const highFeedback = fakeParam(bus.__test.representativeCombFeedback.gain).value;
		const brightCutoff = fakeParam(bus.__test.representativeCombDamping.frequency).value;

		bus.setPatch(stateWith({ reverb: { enabled: true, size: 0, damping: 100, mix: 50 } }), 0);
		const lowFeedback = fakeParam(bus.__test.representativeCombFeedback.gain).value;
		const darkCutoff = fakeParam(bus.__test.representativeCombDamping.frequency).value;

		expect(highFeedback).toBeGreaterThan(lowFeedback);
		expect(brightCutoff).toBeGreaterThan(darkCutoff);
	});
});

describe('createChordPadFxBus: delay tempo sync', () => {
	it('setPatch resolves the tempo-synced delay time from the division and the last setTempo call', () => {
		const { bus } = makeBus();
		bus.setTempo(120);
		bus.setPatch(
			stateWith({ delay: { enabled: true, division: '1/8', feedback: 30, mix: 50 } }),
			0
		);
		expect(fakeParam(bus.__test.delayNode.delayTime).value).toBeCloseTo(
			delayDivisionToSeconds(120, '1/8')
		);
	});

	it('a later setTempo call alone (no new setPatch) re-derives the delay time at the new tempo', () => {
		const { bus } = makeBus();
		bus.setTempo(120);
		bus.setPatch(
			stateWith({ delay: { enabled: true, division: '1/4', feedback: 30, mix: 50 } }),
			0
		);
		bus.setTempo(160);
		expect(fakeParam(bus.__test.delayNode.delayTime).value).toBeCloseTo(
			delayDivisionToSeconds(160, '1/4')
		);
	});
});

describe('createChordPadFxBus: channel volume (the Mixer\'s "Chords" fader)', () => {
	it('the channel gain node sits downstream of input, on the path to ctx.destination', () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.input).reaches(fakeNode(bus.__test.channelGain))).toBe(true);
		expect(fakeNode(bus.__test.channelGain).reaches(ctx.destination)).toBe(true);
	});

	it('defaults to full (100) headroom-scaled gain before any setVolume call', () => {
		const { bus } = makeBus();
		expect(fakeParam(bus.__test.channelGain.gain).value).toBeCloseTo(volumeToGain(100));
	});

	it('setVolume resolves through the same volumeToGain headroom curve every Groove Engine voice shares', () => {
		const { bus } = makeBus();
		bus.setVolume(50, 0);
		expect(fakeParam(bus.__test.channelGain.gain).value).toBeCloseTo(volumeToGain(50));
	});

	it('setVolume(0) silences the channel', () => {
		const { bus } = makeBus();
		bus.setVolume(0, 0);
		expect(fakeParam(bus.__test.channelGain.gain).value).toBe(0);
	});
});
