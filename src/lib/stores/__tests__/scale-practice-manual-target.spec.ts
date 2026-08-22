import { describe, expect, it } from 'vitest';

import {
	findFretPositionsForMidi,
	STANDARD_4_STRING_ABSOLUTE_TUNING
} from '$lib/music/absolute-pitch';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { ScalePracticeStore } from '../scale-practice.svelte';
import type { BassTargetNote } from '../scale-practice.svelte';

/**
 * User-requested parity fix (2026-08, not part of the V4 spec): the
 * fretboard's CURRENT/NEXT/UPCOMING marker used to be generated-only
 * (`generatedTargetPath`, Acid Bass Intelligence V4 §29) even though
 * manually-authored steps are just as real an answer to "where does the
 * bassline go next." `manualTargetPath` is the manual-mode equivalent;
 * `bassTargetPath` is the single field `FretCell.svelte` actually reads,
 * picking whichever of the two matches the current mode. Same
 * "unit-tested directly against a plain (non-component) instance" approach
 * as `scale-practice-generated-target.spec.ts`.
 */
function readyStore(): ScalePracticeStore {
	const store = new ScalePracticeStore();
	store.setRoot(noteNameToPitchClass('C'));
	return store;
}

describe('manualTargetPath: absent outside Manual mode', () => {
	it('every field is null while mode is generated, even with active manual steps still sitting in the pattern', () => {
		const store = readyStore();
		store.setAcidStepActive(0, true);
		store.setAcidStepInterval(0, '1');
		store.setAcidBassMode('generated');

		expect(store.groove.acidBass.mode).toBe('generated');
		expect(store.manualTargetPath).toEqual({ current: null, next: null, upcoming: null });
	});

	it('every field is null in Manual mode with no root chosen yet', () => {
		const store = new ScalePracticeStore();
		store.setAcidStepActive(0, true);

		expect(store.groove.acidBass.mode).toBe('manual');
		expect(store.manualTargetPath).toEqual({ current: null, next: null, upcoming: null });
	});

	it('every field is null in Manual mode with no active steps anywhere in the arrangement', () => {
		const store = readyStore();
		for (let i = 0; i < store.groove.acidBass.patterns.A.length; i++) {
			store.setAcidStepActive(i, false);
		}

		expect(store.manualTargetPath).toEqual({ current: null, next: null, upcoming: null });
	});
});

describe('manualTargetPath: exact-MIDI position mapping', () => {
	it("an active step's preferredPosition and alternativePositions genuinely produce its own exact midi", () => {
		const store = readyStore();
		store.setAcidStepActive(0, true);
		store.setAcidStepInterval(0, '1');

		const path = store.manualTargetPath;
		expect(path.current).not.toBeNull();
		const note = path.current as BassTargetNote;
		expect(note.preferredPosition).not.toBeNull();
		const real = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, 20, note.midi);
		expect(real).toContainEqual(note.preferredPosition);
		for (const alt of note.alternativePositions) {
			expect(real).toContainEqual(alt);
		}
	});
});

describe('manualTargetPath: current/next/upcoming ordering', () => {
	it('current, next, and upcoming resolve to three distinct active steps', () => {
		const store = readyStore();
		store.setAcidStepActive(0, true);
		store.setAcidStepInterval(0, '1');
		store.setAcidStepActive(4, true);
		store.setAcidStepInterval(4, '5');
		store.setAcidStepActive(8, true);
		store.setAcidStepInterval(8, 'b7');

		const { current, next, upcoming } = store.manualTargetPath;
		const c = current as BassTargetNote;
		const n = next as BassTargetNote;
		const u = upcoming as BassTargetNote;
		expect(c.stepIndex).not.toBe(n.stepIndex);
		expect(n.stepIndex).not.toBe(u.stepIndex);
	});

	it('is deterministic for the same steps', () => {
		const storeA = readyStore();
		storeA.setAcidStepActive(0, true);
		const storeB = readyStore();
		storeB.setAcidStepActive(0, true);

		expect(storeA.manualTargetPath).toEqual(storeB.manualTargetPath);
	});
});

describe('bassTargetPath: picks the mode-appropriate path', () => {
	it('mirrors manualTargetPath while in Manual mode', () => {
		const store = readyStore();
		store.setAcidStepActive(0, true);

		expect(store.bassTargetPath).toEqual(store.manualTargetPath);
		expect(store.bassTargetPath.current).not.toBeNull();
	});

	it('mirrors generatedTargetPath once switched to Generated mode', () => {
		const store = readyStore();
		store.setProgressionTemplate('major-ii-v-i');
		store.setAcidBassMode('generated');

		expect(store.bassTargetPath).toEqual(store.generatedTargetPath);
		expect(store.bassTargetPath.current).not.toBeNull();
	});
});
