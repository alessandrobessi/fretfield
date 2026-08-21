import { describe, expect, it } from 'vitest';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { createEmptyAcidStep } from '../pattern';
import {
	accentAmountToMultipliers,
	attackToSeconds,
	clampCutoffHz,
	cutoffToHz,
	decayToSeconds,
	driveToPregain,
	envAmountToRatio,
	glideTimeToSeconds,
	keyTrackingMultiplier,
	lfoRateHzClamp,
	lfoSyncFrequencyHz,
	mixCompensation,
	pulseWidthClamp,
	releaseToSeconds,
	resolveAcidStepMidi,
	resonanceToModelParameter,
	subOctaveToRatio,
	tuneFineToRatio,
	volumeToGain
} from '../resolve';

describe('oscillator mapping', () => {
	it('tuneFineToRatio: +12 semitones is 2x, -12 is 0.5x', () => {
		expect(tuneFineToRatio(12, 0)).toBeCloseTo(2, 5);
		expect(tuneFineToRatio(-12, 0)).toBeCloseTo(0.5, 5);
		expect(tuneFineToRatio(0, 0)).toBeCloseTo(1, 5);
	});

	it('tuneFineToRatio: fine cents nudge the ratio in the same direction as tune', () => {
		expect(tuneFineToRatio(0, 50)).toBeGreaterThan(1);
		expect(tuneFineToRatio(0, -50)).toBeLessThan(1);
	});

	it('subOctaveToRatio: -1 is 0.5x, -2 is 0.25x', () => {
		expect(subOctaveToRatio(-1)).toBeCloseTo(0.5, 5);
		expect(subOctaveToRatio(-2)).toBeCloseTo(0.25, 5);
	});

	it('pulseWidthClamp keeps the pulse audibly asymmetric, never fully collapsed', () => {
		expect(pulseWidthClamp(0)).toBeGreaterThanOrEqual(5);
		expect(pulseWidthClamp(100)).toBeLessThanOrEqual(95);
		expect(pulseWidthClamp(50)).toBe(50);
	});

	it('mixCompensation is unity for a bare main oscillator (matches V1 single-oscillator loudness)', () => {
		expect(mixCompensation(100, 0)).toBeCloseTo(1, 5);
	});

	it('mixCompensation pulls gain down once both oscillators are driven hard, never doubling output', () => {
		const scale = mixCompensation(100, 100);
		expect(scale).toBeLessThan(1);
		expect(scale).toBeGreaterThan(0);
	});

	it('mixCompensation never boosts a quiet patch above unity', () => {
		expect(mixCompensation(20, 10)).toBeLessThanOrEqual(1);
	});
});

describe('filter mapping', () => {
	it('cutoffToHz stays finite, positive, and monotonic across the range', () => {
		expect(cutoffToHz(0)).toBeCloseTo(70, 0);
		expect(cutoffToHz(100)).toBeCloseTo(4500, 0);
		expect(cutoffToHz(50)).toBeGreaterThan(cutoffToHz(0));
		expect(cutoffToHz(50)).toBeLessThan(cutoffToHz(100));
	});

	it('clampCutoffHz keeps out-of-range values within a safe, positive, sub-Nyquist band', () => {
		expect(clampCutoffHz(-500)).toBeGreaterThan(0);
		expect(clampCutoffHz(999999)).toBeLessThan(20000);
		expect(clampCutoffHz(1000)).toBe(1000);
	});

	it('clampCutoffHz respects the actual sample rate, not a hardcoded 44.1kHz assumption', () => {
		expect(clampCutoffHz(999999, 22050)).toBeLessThanOrEqual(22050 * 0.45);
	});

	it('resonanceToModelParameter spans 0.5-16 (Q) for legacy, is lower-ceilinged for svf12, and is monotonic for both', () => {
		expect(resonanceToModelParameter('legacy', 0)).toBeCloseTo(0.5, 5);
		expect(resonanceToModelParameter('legacy', 100)).toBeCloseTo(16, 5);
		expect(resonanceToModelParameter('legacy', 75)).toBeGreaterThan(
			resonanceToModelParameter('legacy', 25)
		);
		expect(resonanceToModelParameter('svf12', 100)).toBeLessThan(
			resonanceToModelParameter('legacy', 100)
		);
	});

	it('resonanceToModelParameter returns a bounded ladder-feedback value for acid24, distinct in scale from Q', () => {
		expect(resonanceToModelParameter('acid24', 0)).toBe(0);
		expect(resonanceToModelParameter('acid24', 100)).toBeLessThanOrEqual(4);
		expect(resonanceToModelParameter('acid24', 75)).toBeGreaterThan(
			resonanceToModelParameter('acid24', 25)
		);
	});

	it('envAmountToRatio is 1 (no movement) at 0, grows above 1 for positive, shrinks below 1 for negative', () => {
		expect(envAmountToRatio(0)).toBe(1);
		expect(envAmountToRatio(100)).toBeGreaterThan(1);
		expect(envAmountToRatio(-100)).toBeLessThan(1);
		expect(envAmountToRatio(-100)).toBeGreaterThan(0);
	});

	it('envAmountToRatio is monotonic through zero, and +/-v are reciprocal (opening and closing are symmetric in log-space)', () => {
		expect(envAmountToRatio(50)).toBeGreaterThan(envAmountToRatio(0));
		expect(envAmountToRatio(0)).toBeGreaterThan(envAmountToRatio(-50));
		expect(envAmountToRatio(50) * envAmountToRatio(-50)).toBeCloseTo(1, 5);
		expect(envAmountToRatio(100) * envAmountToRatio(-100)).toBeCloseTo(1, 5);
	});

	it('keyTrackingMultiplier is 1 at the reference note regardless of tracking amount', () => {
		expect(keyTrackingMultiplier(0, 60, 60)).toBeCloseTo(1, 5);
		expect(keyTrackingMultiplier(100, 60, 60)).toBeCloseTo(1, 5);
	});

	it('keyTrackingMultiplier at 0 is independent of pitch; at 100 doubles an octave up', () => {
		expect(keyTrackingMultiplier(0, 72, 60)).toBeCloseTo(1, 5);
		expect(keyTrackingMultiplier(100, 72, 60)).toBeCloseTo(2, 5);
	});
});

describe('envelope mapping', () => {
	it('attackToSeconds spans roughly 2ms-250ms and is monotonic', () => {
		expect(attackToSeconds(0)).toBeCloseTo(0.002, 3);
		expect(attackToSeconds(100)).toBeCloseTo(0.25, 2);
		expect(attackToSeconds(75)).toBeGreaterThan(attackToSeconds(25));
	});

	it('releaseToSeconds spans roughly 2ms-600ms and is monotonic', () => {
		expect(releaseToSeconds(0)).toBeCloseTo(0.002, 3);
		expect(releaseToSeconds(100)).toBeCloseTo(0.6, 2);
		expect(releaseToSeconds(75)).toBeGreaterThan(releaseToSeconds(25));
	});

	it('decayToSeconds spans the suggested 70ms-900ms range and is monotonic', () => {
		expect(decayToSeconds(0)).toBeCloseTo(0.07, 3);
		expect(decayToSeconds(100)).toBeCloseTo(0.9, 3);
		expect(decayToSeconds(75)).toBeGreaterThan(decayToSeconds(25));
	});

	it('accentAmountToMultipliers approximates V1s fixed constants (1.28x VCA, 1.35x env) at its compatibility point (50)', () => {
		const { vca, env } = accentAmountToMultipliers(50);
		expect(vca).toBeCloseTo(1.28, 1);
		expect(env).toBeCloseTo(1.35, 1);
	});

	it('accentAmountToMultipliers is 1 (no boost) at 0 and grows well past the compatibility point toward 100', () => {
		expect(accentAmountToMultipliers(0).vca).toBeCloseTo(1, 5);
		expect(accentAmountToMultipliers(0).env).toBeCloseTo(1, 5);
		expect(accentAmountToMultipliers(100).vca).toBeGreaterThan(accentAmountToMultipliers(50).vca);
		expect(accentAmountToMultipliers(100).env).toBeGreaterThan(accentAmountToMultipliers(50).env);
	});
});

describe('glide mapping', () => {
	it('glideTimeToSeconds spans roughly 10ms-500ms and is monotonic', () => {
		expect(glideTimeToSeconds(0)).toBeCloseTo(0.01, 3);
		expect(glideTimeToSeconds(100)).toBeCloseTo(0.5, 2);
		expect(glideTimeToSeconds(75)).toBeGreaterThan(glideTimeToSeconds(25));
	});
});

describe('output mapping', () => {
	it('driveToPregain is 1 (effectively clean) at 0 and grows monotonically', () => {
		expect(driveToPregain(0)).toBe(1);
		expect(driveToPregain(100)).toBeGreaterThan(driveToPregain(50));
	});

	it('volumeToGain is 0 at 0, capped below unity at 100 (headroom), and monotonic', () => {
		expect(volumeToGain(0)).toBe(0);
		expect(volumeToGain(100)).toBeLessThan(1);
		expect(volumeToGain(100)).toBeGreaterThan(0.5);
		expect(volumeToGain(75)).toBeGreaterThan(volumeToGain(25));
	});
});

describe('LFO mapping', () => {
	it('lfoRateHzClamp keeps free-running rate within the suggested 0.05-20Hz range', () => {
		expect(lfoRateHzClamp(0)).toBeGreaterThanOrEqual(0.05);
		expect(lfoRateHzClamp(9999)).toBeLessThanOrEqual(20);
		expect(lfoRateHzClamp(2)).toBe(2);
	});

	it('lfoSyncFrequencyHz: a quarter-note division is exactly bpm/60', () => {
		expect(lfoSyncFrequencyHz(120, '1/4')).toBeCloseTo(120 / 60, 5);
	});

	it('lfoSyncFrequencyHz: halving the division doubles the frequency', () => {
		expect(lfoSyncFrequencyHz(120, '1/8')).toBeCloseTo(lfoSyncFrequencyHz(120, '1/4') * 2, 5);
		expect(lfoSyncFrequencyHz(120, '1/16')).toBeCloseTo(lfoSyncFrequencyHz(120, '1/8') * 2, 5);
	});

	it('lfoSyncFrequencyHz: a triplet division is faster than its straight counterpart', () => {
		expect(lfoSyncFrequencyHz(120, '1/8T')).toBeGreaterThan(lfoSyncFrequencyHz(120, '1/8'));
	});

	it('lfoSyncFrequencyHz scales with BPM at a fixed division', () => {
		expect(lfoSyncFrequencyHz(240, '1/4')).toBeCloseTo(lfoSyncFrequencyHz(120, '1/4') * 2, 5);
	});
});

describe('every mapping stays finite across its domain', () => {
	it('0-100 domain mappings', () => {
		for (let value = 0; value <= 100; value += 10) {
			expect(Number.isFinite(cutoffToHz(value))).toBe(true);
			expect(Number.isFinite(resonanceToModelParameter('legacy', value))).toBe(true);
			expect(Number.isFinite(resonanceToModelParameter('svf12', value))).toBe(true);
			expect(Number.isFinite(resonanceToModelParameter('acid24', value))).toBe(true);
			expect(Number.isFinite(decayToSeconds(value))).toBe(true);
			expect(Number.isFinite(driveToPregain(value))).toBe(true);
			expect(Number.isFinite(volumeToGain(value))).toBe(true);
			expect(Number.isFinite(attackToSeconds(value))).toBe(true);
			expect(Number.isFinite(releaseToSeconds(value))).toBe(true);
			expect(Number.isFinite(glideTimeToSeconds(value))).toBe(true);
			expect(Number.isFinite(accentAmountToMultipliers(value).vca)).toBe(true);
			expect(Number.isFinite(accentAmountToMultipliers(value).env)).toBe(true);
			expect(Number.isFinite(pulseWidthClamp(value))).toBe(true);
		}
	});

	it('-100..100 bipolar domain', () => {
		for (let value = -100; value <= 100; value += 20) {
			expect(Number.isFinite(envAmountToRatio(value))).toBe(true);
			expect(envAmountToRatio(value)).toBeGreaterThan(0);
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
