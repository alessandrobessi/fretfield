import { describe, expect, it } from 'vitest';
import { coerceGroove, migrateLegacyPattern } from '../migrate';
import { createEmptyGroove } from '../pattern';
import { STEPS_PER_BAR } from '../types';

function legacyPattern() {
	const steps = {
		kick: new Array(STEPS_PER_BAR).fill(false),
		snare: new Array(STEPS_PER_BAR).fill(false),
		closedHat: new Array(STEPS_PER_BAR).fill(false),
		openHat: new Array(STEPS_PER_BAR).fill(false)
	};
	steps.kick[0] = true;
	steps.kick[8] = true;
	steps.snare[4] = true;
	return { steps, swing: 65 };
}

describe('migrateLegacyPattern', () => {
	it('maps true steps to velocity 0.7 and false steps to 0, in role A', () => {
		const groove = migrateLegacyPattern(legacyPattern());
		expect(groove.patterns.A.steps.kick[0].velocity).toBe(0.7);
		expect(groove.patterns.A.steps.kick[8].velocity).toBe(0.7);
		expect(groove.patterns.A.steps.kick[1].velocity).toBe(0);
		expect(groove.patterns.A.steps.snare[4].velocity).toBe(0.7);
		expect(groove.patterns.A.steps.snare.filter((s) => s.velocity !== 0)).toHaveLength(1);
	});

	it('carries swing over as feel "swing" + feelAmount', () => {
		const groove = migrateLegacyPattern(legacyPattern());
		expect(groove.feel).toBe('swing');
		expect(groove.feelAmount).toBe(65);
	});

	it('a 0 swing migrates to a straight feel', () => {
		const groove = migrateLegacyPattern({ ...legacyPattern(), swing: 0 });
		expect(groove.feel).toBe('straight');
		expect(groove.feelAmount).toBe(0);
	});

	it('wraps the migrated pattern in a one-bar arrangement', () => {
		expect(migrateLegacyPattern(legacyPattern()).arrangement).toEqual(['A']);
	});

	it('leaves patterns B/F/T empty', () => {
		const groove = migrateLegacyPattern(legacyPattern());
		for (const role of ['B', 'F', 'T'] as const) {
			for (const voice of Object.keys(
				groove.patterns[role].steps
			) as (keyof typeof groove.patterns.A.steps)[]) {
				expect(groove.patterns[role].steps[voice].every((s) => s.velocity === 0)).toBe(true);
			}
		}
	});
});

describe('coerceGroove', () => {
	it('migrates a legacy pattern', () => {
		const coerced = coerceGroove(legacyPattern());
		expect(coerced.arrangement).toEqual(['A']);
		expect(coerced.patterns.A.steps.kick[0].velocity).toBe(0.7);
	});

	it('passes a current-model Groove through unchanged', () => {
		const groove = createEmptyGroove();
		expect(coerceGroove(groove)).toEqual(groove);
	});

	it('migrates a pre-Feel Groove (plain swing, no feel/feelAmount)', () => {
		const preFeel = { ...createEmptyGroove(), swing: 65 } as unknown as Record<string, unknown>;
		delete preFeel.feel;
		delete preFeel.feelAmount;

		const coerced = coerceGroove(preFeel);
		expect(coerced.feel).toBe('swing');
		expect(coerced.feelAmount).toBe(65);
		expect(coerced.arrangement).toEqual(['A']);
	});

	it('a pre-Feel Groove with 0 swing migrates to a straight feel', () => {
		const preFeel = { ...createEmptyGroove(), swing: 0 } as unknown as Record<string, unknown>;
		delete preFeel.feel;
		delete preFeel.feelAmount;

		expect(coerceGroove(preFeel).feel).toBe('straight');
	});

	it('migrates a pre-time-signature Groove (feel/feelAmount, no timeSignature) to 4/4', () => {
		const preTimeSignature = createEmptyGroove() as unknown as Record<string, unknown>;
		delete preTimeSignature.timeSignature;

		const coerced = coerceGroove(preTimeSignature);
		expect(coerced.timeSignature).toBe('4/4');
	});
});
