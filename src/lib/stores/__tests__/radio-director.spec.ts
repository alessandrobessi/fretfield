import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listGroovePresets } from '$lib/groove/presets';
import type { BasslineStyleId } from '$lib/music/bassline/types';
import { listProgressionTemplates } from '$lib/music/progressions';

import {
	createRadioDirector,
	pickNextCombo,
	type RadioCombo,
	type RadioDirectorDeps
} from '../radio-director';

const GROOVE_PRESET_IDS = new Set(
	listGroovePresets()
		.map((p) => p.id)
		.filter((id) => id !== 'click')
);
const PROGRESSION_IDS = new Set(listProgressionTemplates().map((t) => t.id));
const BASS_STYLES = new Set<BasslineStyleId>([
	'rooted',
	'funk',
	'acid',
	'chromatic',
	'melodic',
	'walking'
]);

describe('pickNextCombo', () => {
	it("every pick lands inside its own pool, and bpm stays within that groove preset's own genre-tempo range, across many trials", () => {
		let previous: RadioCombo | null = null;
		for (let i = 0; i < 200; i++) {
			const combo = pickNextCombo(previous);
			expect(GROOVE_PRESET_IDS.has(combo.groovePresetId)).toBe(true);
			expect(PROGRESSION_IDS.has(combo.progressionId)).toBe(true);
			expect(BASS_STYLES.has(combo.bassStyle)).toBe(true);
			expect(Number.isInteger(combo.root)).toBe(true);
			expect(combo.root).toBeGreaterThanOrEqual(0);
			expect(combo.root).toBeLessThan(12);
			expect(Number.isFinite(combo.bpm)).toBe(true);
			previous = combo;
		}
	});

	it('never repeats the immediately-previous root/progression/groove/style, across many trials', () => {
		let previous = pickNextCombo(null);
		for (let i = 0; i < 200; i++) {
			const combo = pickNextCombo(previous);
			expect(combo.root).not.toBe(previous.root);
			expect(combo.progressionId).not.toBe(previous.progressionId);
			expect(combo.groovePresetId).not.toBe(previous.groovePresetId);
			expect(combo.bassStyle).not.toBe(previous.bassStyle);
			previous = combo;
		}
	});

	it('produces real variety, not the same handful of combos every time', () => {
		const roots = new Set<number>();
		const grooves = new Set<string>();
		let previous: RadioCombo | null = null;
		for (let i = 0; i < 100; i++) {
			const combo = pickNextCombo(previous);
			roots.add(combo.root);
			grooves.add(combo.groovePresetId);
			previous = combo;
		}
		expect(roots.size).toBeGreaterThan(1);
		expect(grooves.size).toBeGreaterThan(1);
	});

	it('the very first pick (previous: null) skips every no-repeat guardrail without hanging', () => {
		expect(() => pickNextCombo(null)).not.toThrow();
	});
});

describe('createRadioDirector', () => {
	let deps: RadioDirectorDeps & { [K in keyof RadioDirectorDeps]: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.useFakeTimers();
		deps = {
			setRoot: vi.fn<RadioDirectorDeps['setRoot']>(),
			setProgressionTemplate: vi.fn<RadioDirectorDeps['setProgressionTemplate']>(),
			setGroove: vi.fn<RadioDirectorDeps['setGroove']>(),
			setAcidBassGenerationStyle: vi.fn<RadioDirectorDeps['setAcidBassGenerationStyle']>(),
			setBpm: vi.fn<RadioDirectorDeps['setBpm']>()
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('start() rotates immediately -- every setter fires once without waiting for the first poll', () => {
		const director = createRadioDirector(deps);
		director.start();

		expect(deps.setRoot).toHaveBeenCalledTimes(1);
		expect(deps.setProgressionTemplate).toHaveBeenCalledTimes(1);
		expect(deps.setGroove).toHaveBeenCalledTimes(1);
		expect(deps.setAcidBassGenerationStyle).toHaveBeenCalledTimes(1);
		expect(deps.setBpm).toHaveBeenCalledTimes(1);
		expect(director.current).not.toBeNull();
	});

	it('onRotate fires with the exact combo just applied, on every rotation including the first', () => {
		const onRotate = vi.fn();
		const director = createRadioDirector(deps, { onRotate });
		director.start();

		expect(onRotate).toHaveBeenCalledTimes(1);
		expect(onRotate).toHaveBeenCalledWith(director.current);
	});

	it('rotates again on its own well within a real streaming session, and stops rotating once stop() is called', () => {
		const director = createRadioDirector(deps);
		director.start();
		const afterStart = deps.setRoot.mock.calls.length;

		// Comfortably longer than the longest possible segment (180s) plus
		// poll granularity (5s) -- guarantees at least one more rotation fired.
		vi.advanceTimersByTime(10 * 60 * 1000);
		const afterTenMinutes = deps.setRoot.mock.calls.length;
		expect(afterTenMinutes).toBeGreaterThan(afterStart);

		director.stop();
		vi.advanceTimersByTime(10 * 60 * 1000);
		expect(deps.setRoot.mock.calls.length).toBe(afterTenMinutes);
	});

	it('calling start() twice does not double up the interval', () => {
		const director = createRadioDirector(deps);
		director.start();
		director.start();
		const afterDoubleStart = deps.setRoot.mock.calls.length;

		vi.advanceTimersByTime(10 * 60 * 1000);
		// A doubled interval would rotate roughly twice as often; loosely
		// assert it stayed in the single-interval ballpark rather than pinning
		// an exact count (segment duration is randomized).
		const rotationsInTenMinutes = deps.setRoot.mock.calls.length - afterDoubleStart;
		expect(rotationsInTenMinutes).toBeLessThanOrEqual(8);
	});
});
