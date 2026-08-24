import { describe, expect, it } from 'vitest';

import {
	triggerClosedHat,
	triggerKick,
	triggerOpenHat,
	triggerRide,
	triggerRim,
	triggerSnare
} from '../drum-voices';
import { FakeAudioContext, FakeAudioNode } from './fake-web-audio';

/**
 * Connectivity test for every drum trigger function -- each one takes a
 * `destinationNode` (added 2026-08 so the Mixer's "Drums" fader can route
 * every voice through one shared bus instead of straight to
 * `ctx.destination`), mirroring `chord-voices.ts`'s own `triggerChordPad`
 * precedent. Asserts the hit actually reaches whatever node is passed in,
 * and leaves `ctx.destination` itself untouched.
 */

const TRIGGERS: Record<
	string,
	(ctx: AudioContext, destinationNode: AudioNode, time: number) => void
> = {
	kick: triggerKick,
	snare: triggerSnare,
	closedHat: triggerClosedHat,
	openHat: triggerOpenHat,
	ride: triggerRide,
	rim: triggerRim
};

describe('drum trigger functions route through the passed destinationNode', () => {
	for (const [name, trigger] of Object.entries(TRIGGERS)) {
		it(`${name} connects to the passed destination, not a hardcoded ctx.destination`, () => {
			const ctx = new FakeAudioContext();
			const destination = new FakeAudioNode();

			trigger(ctx as unknown as AudioContext, destination as unknown as AudioNode, 0);

			expect(destination.hasIncomingConnections()).toBe(true);
			expect(ctx.destination.hasIncomingConnections()).toBe(false);
		});
	}
});
