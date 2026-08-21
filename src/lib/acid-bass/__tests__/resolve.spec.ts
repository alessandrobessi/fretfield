import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { createEmptyAcidStep } from '../pattern';
import {
	clampCutoffHz,
	decayToSeconds,
	driveToPregain,
	motionToEnvelopeRatio,
	resolveAcidStepMidi,
	resonanceToQ,
	toneToCutoffHz
} from '../resolve';

describe('parameter mapping', () => {
	it('toneToCutoffHz stays finite, positive, and monotonic across the range', () => {
		expect(toneToCutoffHz(0)).toBeCloseTo(70, 0);
		expect(toneToCutoffHz(100)).toBeCloseTo(4500, 0);
		expect(toneToCutoffHz(50)).toBeGreaterThan(toneToCutoffHz(0));
		expect(toneToCutoffHz(50)).toBeLessThan(toneToCutoffHz(100));
	});

	it('clampCutoffHz keeps out-of-range values within a safe, positive, sub-Nyquist band', () => {
		expect(clampCutoffHz(-500)).toBeGreaterThan(0);
		expect(clampCutoffHz(999999)).toBeLessThan(20000);
		expect(clampCutoffHz(1000)).toBe(1000);
	});

	it('resonanceToQ spans the suggested 0.5-16 range and is monotonic', () => {
		expect(resonanceToQ(0)).toBeCloseTo(0.5, 5);
		expect(resonanceToQ(100)).toBeCloseTo(16, 5);
		expect(resonanceToQ(75)).toBeGreaterThan(resonanceToQ(25));
	});

	it('motionToEnvelopeRatio is 1 (no additional opening) at 0 and grows monotonically', () => {
		expect(motionToEnvelopeRatio(0)).toBe(1);
		expect(motionToEnvelopeRatio(100)).toBeGreaterThan(motionToEnvelopeRatio(50));
		expect(motionToEnvelopeRatio(50)).toBeGreaterThan(motionToEnvelopeRatio(0));
	});

	it('decayToSeconds spans the suggested 70ms-900ms range and is monotonic', () => {
		expect(decayToSeconds(0)).toBeCloseTo(0.07, 3);
		expect(decayToSeconds(100)).toBeCloseTo(0.9, 3);
		expect(decayToSeconds(75)).toBeGreaterThan(decayToSeconds(25));
	});

	it('driveToPregain is 1 (effectively clean) at 0 and grows monotonically', () => {
		expect(driveToPregain(0)).toBe(1);
		expect(driveToPregain(100)).toBeGreaterThan(driveToPregain(50));
	});

	it('every mapping stays finite across the full 0-100 domain', () => {
		for (let value = 0; value <= 100; value += 10) {
			expect(Number.isFinite(toneToCutoffHz(value))).toBe(true);
			expect(Number.isFinite(resonanceToQ(value))).toBe(true);
			expect(Number.isFinite(motionToEnvelopeRatio(value))).toBe(true);
			expect(Number.isFinite(decayToSeconds(value))).toBe(true);
			expect(Number.isFinite(driveToPregain(value))).toBe(true);
		}
	});
});

describe('resolveAcidStepMidi', () => {
	it('a root (interval "1") step transposes with the reference root', () => {
		const step = { ...createEmptyAcidStep(), active: true, interval: '1' as const };
		const c = resolveAcidStepMidi(noteNameToPitchClass('C'), step);
		const d = resolveAcidStepMidi(noteNameToPitchClass('D'), step);
		const g = resolveAcidStepMidi(noteNameToPitchClass('G'), step);
		expect(d - c).toBe(2);
		expect(g - c).toBe(7);
	});

	it('a b7 step transposes the same way relative to whatever root is given', () => {
		const step = { ...createEmptyAcidStep(), active: true, interval: 'b7' as const };
		const overC = resolveAcidStepMidi(noteNameToPitchClass('C'), step);
		const overD = resolveAcidStepMidi(noteNameToPitchClass('D'), step);
		expect(overD - overC).toBe(2);
	});

	it('octave offsets transpose by exactly 12 semitones', () => {
		// G, not C: C's octave -1 case would hit the register floor (MIDI 24 ->
		// clamped to 28), which is exercised separately below -- this test
		// isolates pure transposition, away from the clamp boundary.
		const root = noteNameToPitchClass('G');
		const base = {
			...createEmptyAcidStep(),
			active: true,
			interval: '1' as const,
			octave: 0 as const
		};
		const up = { ...base, octave: 1 as const };
		const down = { ...base, octave: -1 as const };
		expect(resolveAcidStepMidi(root, up) - resolveAcidStepMidi(root, base)).toBe(12);
		expect(resolveAcidStepMidi(root, base) - resolveAcidStepMidi(root, down)).toBe(12);
	});

	it('lands in a musically sensible bass register for the unshifted root', () => {
		for (const name of ['C', 'D', 'E', 'F#', 'A', 'B']) {
			const step = { ...createEmptyAcidStep(), active: true, interval: '1' as const };
			const midi = resolveAcidStepMidi(noteNameToPitchClass(name), step);
			expect(midi).toBeGreaterThanOrEqual(36);
			expect(midi).toBeLessThanOrEqual(47);
		}
	});

	it('clamps to the supported register at extremes rather than producing an absurd pitch', () => {
		const root = noteNameToPitchClass('B');
		const veryLow = {
			...createEmptyAcidStep(),
			active: true,
			interval: '1' as const,
			octave: -1 as const
		};
		const veryHigh = {
			...createEmptyAcidStep(),
			active: true,
			interval: '7' as const,
			octave: 1 as const
		};
		expect(resolveAcidStepMidi(root, veryLow)).toBeGreaterThanOrEqual(28);
		expect(resolveAcidStepMidi(root, veryHigh)).toBeLessThanOrEqual(64);
	});
});
