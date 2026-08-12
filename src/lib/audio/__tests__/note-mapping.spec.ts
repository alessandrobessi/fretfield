import { describe, expect, it } from 'vitest';
import { defaultNoteName } from '$lib/music/pitch';
import {
	centsDeviation,
	frequencyToMidi,
	midiToFrequency,
	midiToOctave,
	midiToPitchClass,
	nearestMidi
} from '../note-mapping';

describe('frequencyToMidi / midiToFrequency', () => {
	it('E2 (~82.41 Hz) maps to approximately MIDI 40', () => {
		expect(frequencyToMidi(82.41)).toBeCloseTo(40, 1);
	});

	it('A4 (440 Hz) is exactly MIDI 69', () => {
		expect(frequencyToMidi(440)).toBeCloseTo(69, 5);
	});

	it('round-trips through midiToFrequency', () => {
		for (const midi of [28, 33, 38, 43, 60, 69]) {
			expect(frequencyToMidi(midiToFrequency(midi))).toBeCloseTo(midi, 5);
		}
	});
});

describe('nearestMidi / centsDeviation', () => {
	it('rounds to the nearest integer MIDI note', () => {
		expect(nearestMidi(40.1)).toBe(40);
		expect(nearestMidi(40.6)).toBe(41);
	});

	it('reports cents deviation from a reference MIDI note', () => {
		expect(centsDeviation(40.07, 40)).toBeCloseTo(7, 0);
		expect(centsDeviation(39.95, 40)).toBeCloseTo(-5, 0);
		expect(centsDeviation(40, 40)).toBe(0);
	});
});

describe('midiToPitchClass / midiToOctave — scientific pitch notation (MIDI 60 = C4)', () => {
	it('matches the bass open-string reference table from the product spec', () => {
		// E1 = 28, A1 = 33, D2 = 38, G2 = 43
		expect(midiToOctave(28)).toBe(1);
		expect(defaultNoteName(midiToPitchClass(28))).toBe('E');

		expect(midiToOctave(33)).toBe(1);
		expect(defaultNoteName(midiToPitchClass(33))).toBe('A');

		expect(midiToOctave(38)).toBe(2);
		expect(defaultNoteName(midiToPitchClass(38))).toBe('D');

		expect(midiToOctave(43)).toBe(2);
		expect(defaultNoteName(midiToPitchClass(43))).toBe('G');
	});

	it('MIDI 60 is C4 (middle C)', () => {
		expect(midiToOctave(60)).toBe(4);
		expect(defaultNoteName(midiToPitchClass(60))).toBe('C');
	});

	it('same pitch class, different octave, are not confused', () => {
		expect(midiToPitchClass(28)).toBe(midiToPitchClass(40)); // E1 and E2
		expect(midiToOctave(28)).not.toBe(midiToOctave(40));
	});
});
