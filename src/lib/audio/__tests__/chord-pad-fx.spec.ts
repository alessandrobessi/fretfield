import { describe, expect, it } from 'vitest';

import { delayDivisionToSeconds } from '$lib/chord-pad-fx/resolve';
import { createDefaultChordPadFxState } from '$lib/chord-pad-fx/pattern';
import type { ChordPadFxState } from '$lib/chord-pad-fx/types';

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
		expect(fakeNode(bus.__test.chorusSend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.delaySend).reaches(ctx.destination)).toBe(true);
		expect(fakeNode(bus.__test.reverbSend).reaches(ctx.destination)).toBe(true);
	});

	it("the delay node's own output reaches ctx.destination (the wet return, downstream of Reverb)", () => {
		const { ctx, bus } = makeBus();
		expect(fakeNode(bus.__test.delayNode).reaches(ctx.destination)).toBe(true);
	});
});

describe('createChordPadFxBus: setPatch resolves disabled/zero-mix stages to exactly dry', () => {
	it('every stage defaults off, so every wet-send gain resolves to 0', () => {
		const { bus } = makeBus();
		bus.setPatch(createDefaultChordPadFxState(), 0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBe(0);
	});

	it("enabling a stage with mix 0 still resolves that stage's wet-send gain to 0", () => {
		const { bus } = makeBus();
		const state = stateWith({
			reverb: { enabled: true, size: 80, damping: 20, mix: 0 },
			delay: { enabled: true, division: '1/8', feedback: 50, mix: 0 },
			chorus: { enabled: true, rate: 1, depth: 50, mix: 0 }
		});
		bus.setPatch(state, 0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBe(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBe(0);
	});

	it('enabling a stage with a nonzero mix resolves a nonzero wet-send gain', () => {
		const { bus } = makeBus();
		const state = stateWith({
			reverb: { enabled: true, size: 80, damping: 20, mix: 60 },
			delay: { enabled: true, division: '1/8', feedback: 50, mix: 40 },
			chorus: { enabled: true, rate: 1, depth: 50, mix: 35 }
		});
		bus.setPatch(state, 0);
		expect(fakeParam(bus.__test.chorusSend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.delaySend.gain).value).toBeGreaterThan(0);
		expect(fakeParam(bus.__test.reverbSend.gain).value).toBeGreaterThan(0);
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
