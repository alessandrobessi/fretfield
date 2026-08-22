import { afterEach, describe, expect, it } from 'vitest';

import {
	findFretPositionsForMidi,
	STANDARD_4_STRING_ABSOLUTE_TUNING
} from '$lib/music/absolute-pitch';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { liveInput } from '../live-input.svelte';
import { ScalePracticeStore } from '../scale-practice.svelte';
import type { BassTargetNote } from '../scale-practice.svelte';

/**
 * Acid Bass Intelligence V4 M12: `ScalePracticeStore.generatedTargetPath`,
 * unit-tested directly against a plain (non-component) instance -- Svelte 5
 * runes evaluate synchronously outside a component too, so this needs no
 * DOM/browser environment.
 */
function readyStore(): ScalePracticeStore {
	const store = new ScalePracticeStore();
	store.setRoot(noteNameToPitchClass('C'));
	store.setProgressionTemplate('major-ii-v-i');
	return store;
}

afterEach(() => {
	liveInput.detectedNote = null;
});

describe('generatedTargetPath: absent in Manual mode', () => {
	it('every field is null while mode is manual, even with a root and progression already selected', () => {
		const store = readyStore();
		expect(store.groove.acidBass.mode).toBe('manual');
		expect(store.generatedTargetPath).toEqual({ current: null, next: null, upcoming: null });
	});

	it('reverting from Generated back to Manual clears the path again', () => {
		const store = readyStore();
		store.setAcidBassMode('generated');
		expect(store.generatedTargetPath.current).not.toBeNull();

		store.setAcidBassMode('manual');
		expect(store.generatedTargetPath).toEqual({ current: null, next: null, upcoming: null });
	});
});

describe('generatedTargetPath: exact-MIDI position mapping', () => {
	it("every target's preferredPosition and alternativePositions genuinely produce its own exact midi", () => {
		const store = readyStore();
		store.setAcidBassMode('generated');
		const path = store.generatedTargetPath;

		for (const target of [path.current, path.next, path.upcoming]) {
			expect(target).not.toBeNull();
			const note = target as BassTargetNote;
			expect(note.preferredPosition).not.toBeNull();
			const real = findFretPositionsForMidi(STANDARD_4_STRING_ABSOLUTE_TUNING, 20, note.midi);
			expect(real).toContainEqual(note.preferredPosition);
			for (const alt of note.alternativePositions) {
				expect(real).toContainEqual(alt);
			}
		}
	});
});

describe('generatedTargetPath: current/next state', () => {
	it("current, next, and upcoming are three distinct steps in the plan's own cycle order", () => {
		const store = readyStore();
		store.setAcidBassMode('generated');
		const plan = store.generatedBasslinePlan;
		expect(plan).not.toBeNull();
		const stepsPerBar = plan!.bars[0].steps.length;
		const globalStep = (n: { barIndex: number; stepIndex: number }) =>
			n.barIndex * stepsPerBar + n.stepIndex;

		const { current, next, upcoming } = store.generatedTargetPath;
		const c = current as BassTargetNote;
		const n = next as BassTargetNote;
		const u = upcoming as BassTargetNote;
		expect(globalStep(n)).not.toBe(globalStep(c));
		expect(globalStep(u)).not.toBe(globalStep(n));
	});

	it('is deterministic for the same generation settings', () => {
		const storeA = readyStore();
		storeA.setAcidBassMode('generated');
		const storeB = readyStore();
		storeB.setAcidBassMode('generated');

		expect(storeA.generatedTargetPath).toEqual(storeB.generatedTargetPath);
	});
});

describe('generatedTargetPath: played note remains visible', () => {
	it('playedPositions (Live Input) still resolves correctly with Generated mode active', () => {
		const store = readyStore();
		store.setAcidBassMode('generated');
		expect(store.generatedTargetPath.current).not.toBeNull();

		liveInput.detectedNote = {
			frequencyHz: 220,
			midi: 57,
			pitchClass: noteNameToPitchClass('A'),
			octave: 3,
			cents: 0,
			confidence: 1,
			rms: 0.5,
			timestampMs: 0
		};

		const played = store.playedPositions;
		expect(played.length).toBeGreaterThan(0);
		expect(played.every((p) => p.pitchClass === noteNameToPitchClass('A'))).toBe(true);
	});
});
