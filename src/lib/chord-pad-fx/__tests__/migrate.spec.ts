import { describe, expect, it } from 'vitest';

import { coerceChordPadFxState } from '../migrate';
import { createDefaultChordPadFxState } from '../pattern';

describe('coerceChordPadFxState: nothing at all (pre-chord-pad-fx groove)', () => {
	it('returns a fresh, everything-off default state', () => {
		const state = coerceChordPadFxState(undefined);
		expect(state).toEqual(createDefaultChordPadFxState());
		expect(state.reverb.enabled).toBe(false);
		expect(state.delay.enabled).toBe(false);
		expect(state.chorus.enabled).toBe(false);
	});

	it('also handles null and unrecognizable garbage the same way', () => {
		expect(coerceChordPadFxState(null).version).toBe(3);
		expect(coerceChordPadFxState('not an object').version).toBe(3);
		expect(coerceChordPadFxState(42).version).toBe(3);
	});
});

describe('coerceChordPadFxState: an already-current (version 3), well-formed state', () => {
	it('round-trips every field unchanged', () => {
		const current = {
			version: 3 as const,
			fuzz: { enabled: true, drive: 65, mix: 40 },
			reverb: { enabled: true, size: 70, damping: 20, mix: 55 },
			delay: { enabled: true, division: '1/16T' as const, feedback: 60, mix: 40 },
			chorus: { enabled: true, rate: 2.5, depth: 80, mix: 45 },
			phaser: { enabled: true, rate: 0.5, depth: 60, mix: 25 },
			flanger: { enabled: true, rate: 0.4, depth: 70, feedback: 50, mix: 30 },
			tremolo: { enabled: true, rate: 6, depth: 65 }
		};
		expect(coerceChordPadFxState(current)).toEqual(current);
	});
});

describe('coerceChordPadFxState: version 1 -> 3 migration (Reverb/Delay/Chorus only)', () => {
	it('keeps reverb/delay/chorus exactly as persisted, defaults phaser/flanger/tremolo/fuzz off/neutral, and stamps version 3', () => {
		const v1 = {
			version: 1 as const,
			reverb: { enabled: true, size: 70, damping: 20, mix: 55 },
			delay: { enabled: true, division: '1/16T' as const, feedback: 60, mix: 40 },
			chorus: { enabled: true, rate: 2.5, depth: 80, mix: 45 }
		};
		const state = coerceChordPadFxState(v1);
		const defaults = createDefaultChordPadFxState();

		expect(state.version).toBe(3);
		expect(state.reverb).toEqual(v1.reverb);
		expect(state.delay).toEqual(v1.delay);
		expect(state.chorus).toEqual(v1.chorus);
		expect(state.phaser).toEqual(defaults.phaser);
		expect(state.flanger).toEqual(defaults.flanger);
		expect(state.tremolo).toEqual(defaults.tremolo);
		expect(state.fuzz).toEqual(defaults.fuzz);
		expect(state.phaser.enabled).toBe(false);
		expect(state.flanger.enabled).toBe(false);
		expect(state.tremolo.enabled).toBe(false);
		expect(state.fuzz.enabled).toBe(false);
	});

	it('a version-1 groove with malformed reverb/delay/chorus still coerces those fields defensively', () => {
		const state = coerceChordPadFxState({
			version: 1,
			reverb: { enabled: true, size: 'not a number' },
			delay: { division: 'garbage' }
		});
		const defaults = createDefaultChordPadFxState();

		expect(state.version).toBe(3);
		expect(state.reverb.enabled).toBe(true);
		expect(state.reverb.size).toBe(defaults.reverb.size);
		expect(state.delay.division).toBe(defaults.delay.division);
		expect(state.phaser).toEqual(defaults.phaser);
		expect(state.fuzz).toEqual(defaults.fuzz);
	});
});

describe('coerceChordPadFxState: version 2 -> 3 migration (Reverb/Delay/Chorus/Phaser/Flanger/Tremolo only)', () => {
	it('keeps all six existing effects exactly as persisted, defaults fuzz off/neutral, and stamps version 3', () => {
		const v2 = {
			version: 2 as const,
			reverb: { enabled: true, size: 70, damping: 20, mix: 55 },
			delay: { enabled: true, division: '1/16T' as const, feedback: 60, mix: 40 },
			chorus: { enabled: true, rate: 2.5, depth: 80, mix: 45 },
			phaser: { enabled: true, rate: 0.5, depth: 60, mix: 25 },
			flanger: { enabled: true, rate: 0.4, depth: 70, feedback: 50, mix: 30 },
			tremolo: { enabled: true, rate: 6, depth: 65 }
		};
		const state = coerceChordPadFxState(v2);
		const defaults = createDefaultChordPadFxState();

		expect(state.version).toBe(3);
		expect(state.reverb).toEqual(v2.reverb);
		expect(state.delay).toEqual(v2.delay);
		expect(state.chorus).toEqual(v2.chorus);
		expect(state.phaser).toEqual(v2.phaser);
		expect(state.flanger).toEqual(v2.flanger);
		expect(state.tremolo).toEqual(v2.tremolo);
		expect(state.fuzz).toEqual(defaults.fuzz);
		expect(state.fuzz.enabled).toBe(false);
	});
});

describe('coerceChordPadFxState: malformed/partial persisted data', () => {
	it('falls back to defaults field-by-field rather than rejecting the whole object', () => {
		const state = coerceChordPadFxState({
			reverb: { enabled: true, size: 'not a number', mix: 999 },
			delay: { division: 'garbage', feedback: -50 },
			chorus: null
		});
		const defaults = createDefaultChordPadFxState();

		expect(state.reverb.enabled).toBe(true);
		expect(state.reverb.size).toBe(defaults.reverb.size);
		expect(state.reverb.mix).toBe(100); // clamped, not rejected
		expect(state.reverb.damping).toBe(defaults.reverb.damping);

		expect(state.delay.division).toBe(defaults.delay.division);
		expect(state.delay.feedback).toBe(0); // clamped, not rejected

		expect(state.chorus).toEqual(defaults.chorus);
	});

	it('clamps an out-of-range chorus rate rather than accepting an inaudible/absurd Hz value', () => {
		const state = coerceChordPadFxState({ chorus: { enabled: true, rate: 999 } });
		expect(state.chorus.rate).toBeLessThan(10);
		expect(state.chorus.rate).toBeGreaterThan(0);
	});

	it('falls back to defaults field-by-field for malformed phaser/flanger/tremolo data too', () => {
		const state = coerceChordPadFxState({
			phaser: { enabled: true, rate: 'not a number', mix: 999 },
			flanger: { enabled: true, feedback: -50 },
			tremolo: null
		});
		const defaults = createDefaultChordPadFxState();

		expect(state.phaser.enabled).toBe(true);
		expect(state.phaser.rate).toBe(defaults.phaser.rate);
		expect(state.phaser.mix).toBe(100); // clamped, not rejected

		expect(state.flanger.enabled).toBe(true);
		expect(state.flanger.feedback).toBe(0); // clamped, not rejected

		expect(state.tremolo).toEqual(defaults.tremolo);
	});

	it('clamps out-of-range phaser/flanger/tremolo rates rather than accepting inaudible/absurd Hz values', () => {
		const state = coerceChordPadFxState({
			phaser: { enabled: true, rate: 999 },
			flanger: { enabled: true, rate: 999 },
			tremolo: { enabled: true, rate: 999 }
		});
		expect(state.phaser.rate).toBeLessThanOrEqual(2);
		expect(state.flanger.rate).toBeLessThanOrEqual(3);
		expect(state.tremolo.rate).toBeLessThanOrEqual(10);
	});

	it('falls back to defaults field-by-field for malformed fuzz data too', () => {
		const state = coerceChordPadFxState({
			fuzz: { enabled: true, drive: 'not a number', mix: 999 }
		});
		const defaults = createDefaultChordPadFxState();

		expect(state.fuzz.enabled).toBe(true);
		expect(state.fuzz.drive).toBe(defaults.fuzz.drive);
		expect(state.fuzz.mix).toBe(100); // clamped, not rejected
	});
});
