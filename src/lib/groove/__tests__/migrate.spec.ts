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

	it('carries swing over unchanged', () => {
		expect(migrateLegacyPattern(legacyPattern()).swing).toBe(65);
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
});
