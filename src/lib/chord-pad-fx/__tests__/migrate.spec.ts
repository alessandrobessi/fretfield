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
		expect(coerceChordPadFxState(null).version).toBe(1);
		expect(coerceChordPadFxState('not an object').version).toBe(1);
		expect(coerceChordPadFxState(42).version).toBe(1);
	});
});

describe('coerceChordPadFxState: an already-current, well-formed state', () => {
	it('round-trips every field unchanged', () => {
		const current = {
			version: 1 as const,
			reverb: { enabled: true, size: 70, damping: 20, mix: 55 },
			delay: { enabled: true, division: '1/16T' as const, feedback: 60, mix: 40 },
			chorus: { enabled: true, rate: 2.5, depth: 80, mix: 45 }
		};
		expect(coerceChordPadFxState(current)).toEqual(current);
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
});
