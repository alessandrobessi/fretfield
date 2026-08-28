import { beforeEach, describe, expect, it, vi } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';
import { writeJSON } from '$lib/utils/local-storage';

import { pickNextCombo, type RadioCombo } from '../radio-director';
import { ScalePracticeStore } from '../scale-practice.svelte';
import { listGroovePresets } from '$lib/groove/presets';

/**
 * `persistEnabled` (Radio Mode, user-requested, 2026-08): Radio drives this
 * same singleton store for hours, rotating root/progression/groove far more
 * often than a human ever would -- without this flag, every rotation would
 * silently overwrite whatever a real user last saved in ordinary Practice,
 * in the same browser's `localStorage`. `writeJSON` is mocked rather than
 * asserting against real `localStorage` -- this suite runs under the
 * `node` test environment (see `vite.config.ts`), which has no
 * `localStorage` global, so `writeJSON` itself is already a silent no-op
 * there regardless of `persistEnabled`; only a call-count assertion on the
 * mock actually exercises the guard.
 */
vi.mock('$lib/utils/local-storage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/utils/local-storage')>();
	return { ...actual, writeJSON: vi.fn(actual.writeJSON) };
});

function readyStore() {
	const store = new ScalePracticeStore();
	store.setRoot(noteNameToPitchClass('C'));
	return store;
}

describe('persistEnabled', () => {
	beforeEach(() => {
		vi.mocked(writeJSON).mockClear();
	});

	it('defaults to true -- ordinary Practice usage persists exactly as before', () => {
		const store = readyStore();
		vi.mocked(writeJSON).mockClear();

		store.setRoot(noteNameToPitchClass('D'));

		expect(writeJSON).toHaveBeenCalledTimes(1);
	});

	it('false suppresses every persist() call, however many setters run', () => {
		const store = readyStore();
		store.persistEnabled = false;
		vi.mocked(writeJSON).mockClear();

		store.setRoot(noteNameToPitchClass('D'));
		store.setIntensity(40);
		store.setDrumsVolume(20);

		expect(writeJSON).not.toHaveBeenCalled();
	});

	it('toggling back to true resumes persistence', () => {
		const store = readyStore();
		store.persistEnabled = false;
		store.setRoot(noteNameToPitchClass('D'));
		store.persistEnabled = true;
		vi.mocked(writeJSON).mockClear();

		store.setIntensity(40);

		expect(writeJSON).toHaveBeenCalledTimes(1);
	});
});

/**
 * Runtime-safety soak (Radio Mode, user-requested, 2026-08): a real 24/7
 * stream rotates far more often, over far longer than any human practice
 * session ever has. This drives the exact same setters `RadioDirector`
 * calls each rotation -- `setRoot`/`setProgressionTemplate`/`setGroove`/
 * `setAcidBassGenerationStyle`/`setBpm` -- hundreds of times in a row
 * (roughly a full day at Radio's own ~90-180s segment length) and asserts
 * nothing throws, persistence stays suppressed throughout, and the store
 * lands in a valid state. `setAcidBassGenerationStyle` only ever touches
 * `groove.acidBass.generation` (a plain data field feeding the pure
 * bassline generator) -- not the live `AcidBassVoice`/its patch -- so
 * there is no live Web Audio node in this path at all to leak; this test
 * exists to catch a regression in that invariant, not because a leak is
 * suspected today.
 */
describe('runtime safety under heavy rotation (simulated multi-hour Radio session)', () => {
	it('500 simulated rotations: no throw, no persistence, store stays valid throughout', () => {
		const store = readyStore();
		store.persistEnabled = false;
		vi.mocked(writeJSON).mockClear();

		let previous: RadioCombo | null = null;
		let lastCombo: RadioCombo | null = null;
		// Not wrapped in expect(...).not.toThrow() -- an uncaught exception
		// here already fails the test on its own, and this avoids relying on
		// TypeScript narrowing `previous`'s reassignment back out of a closure.
		for (let i = 0; i < 500; i++) {
			const combo = pickNextCombo(previous);
			const groovePreset = listGroovePresets().find((p) => p.id === combo.groovePresetId);
			if (groovePreset === undefined) throw new Error('unreachable: pool-sourced id');

			store.setRoot(combo.root);
			store.setProgressionTemplate(combo.progressionId);
			store.setGroove(groovePreset.groove);
			// Regression: groovePreset.groove carries Acid Bass's own default
			// disabled/manual state, so setGroove alone would silently turn the
			// bass back off on every rotation -- must be re-asserted after.
			store.setAcidBassEnabled(true);
			store.setAcidBassMode('generated');
			store.setAcidBassGenerationStyle(combo.bassStyle);
			store.setBpm(combo.bpm);

			previous = combo;
			lastCombo = combo;
		}

		expect(writeJSON).not.toHaveBeenCalled();
		expect(store.bpm).toBeGreaterThanOrEqual(30);
		expect(store.bpm).toBeLessThanOrEqual(240);
		expect(store.groove.acidBass.enabled).toBe(true);
		expect(store.groove.acidBass.mode).toBe('generated');
		expect(store.groove.acidBass.generation.style).toBe(lastCombo?.bassStyle);
	});
});
