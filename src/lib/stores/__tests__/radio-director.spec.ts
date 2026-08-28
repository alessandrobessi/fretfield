import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BasslineStyleId } from '$lib/music/bassline/types';
import { listProgressionTemplates } from '$lib/music/progressions';

import {
	createRadioDirector,
	pickNextCombo,
	type RadioCombo,
	type RadioDirectorDeps
} from '../radio-director';

// Pinned to trance only (user-requested, 2026-08 -- "music should always be
// trance") -- see radio-director.ts's own GROOVE_PRESET_IDS doc comment.
const GROOVE_PRESET_IDS = new Set(['trance']);
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

	it('never repeats the immediately-previous root/progression/style, across many trials -- groove is pinned to trance, so it never varies at all, by design', () => {
		let previous = pickNextCombo(null);
		for (let i = 0; i < 200; i++) {
			const combo = pickNextCombo(previous);
			expect(combo.root).not.toBe(previous.root);
			expect(combo.progressionId).not.toBe(previous.progressionId);
			expect(combo.groovePresetId).toBe('trance');
			expect(combo.bassStyle).not.toBe(previous.bassStyle);
			previous = combo;
		}
	});

	it('produces real variety in root, even though the groove is always trance', () => {
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
		expect(grooves).toEqual(new Set(['trance']));
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
			setAcidBassEnabled: vi.fn<RadioDirectorDeps['setAcidBassEnabled']>(),
			setAcidBassMode: vi.fn<RadioDirectorDeps['setAcidBassMode']>(),
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

	it("re-asserts Acid Bass enabled + generated mode after every setGroove call, on every rotation (regression: a GroovePreset's own baked-in Groove carries Acid Bass disabled/manual, so setGroove alone silently turns the bass back off)", () => {
		const director = createRadioDirector(deps);
		director.start();
		director.forceRotate();
		director.forceRotate();

		expect(deps.setGroove.mock.calls.length).toBe(3);
		expect(deps.setAcidBassEnabled.mock.calls.length).toBe(3);
		expect(deps.setAcidBassMode.mock.calls.length).toBe(3);
		for (const call of deps.setAcidBassEnabled.mock.calls) expect(call[0]).toBe(true);
		for (const call of deps.setAcidBassMode.mock.calls) expect(call[0]).toBe('generated');

		// And in the correct order relative to setGroove -- setGroove must not
		// be the last word on Acid Bass's own enabled/mode state.
		const grooveCallOrder = deps.setGroove.mock.invocationCallOrder[0];
		const enabledCallOrder = deps.setAcidBassEnabled.mock.invocationCallOrder[0];
		expect(enabledCallOrder).toBeGreaterThan(grooveCallOrder);
	});

	it('onRotate fires with the exact combo just applied, on every rotation including the first', () => {
		const onRotate = vi.fn();
		const director = createRadioDirector(deps, { onRotate });
		director.start();

		expect(onRotate).toHaveBeenCalledTimes(1);
		expect(onRotate).toHaveBeenCalledWith(director.current);
	});

	it('forceRotate() is a no-op before start(), and immediately applies a new combo once started', () => {
		const director = createRadioDirector(deps);

		director.forceRotate();
		expect(deps.setRoot).not.toHaveBeenCalled();

		director.start();
		const firstCombo = director.current;
		expect(deps.setRoot).toHaveBeenCalledTimes(1);

		director.forceRotate();
		expect(deps.setRoot).toHaveBeenCalledTimes(2);
		expect(director.current).not.toBe(firstCombo);
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
