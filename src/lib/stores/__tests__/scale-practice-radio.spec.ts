import { beforeEach, describe, expect, it, vi } from 'vitest';

import { noteNameToPitchClass } from '$lib/music/pitch';
import { writeJSON } from '$lib/utils/local-storage';

import { ScalePracticeStore } from '../scale-practice.svelte';

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
