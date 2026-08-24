import { describe, expect, it } from 'vitest';
import { volumeToGain } from '$lib/audio/gain';
import { noteNameToPitchClass } from '$lib/music/pitch';

import { createEmptyAcidStep } from '../pattern';
import type { AcidModulationDestination } from '../types';
import {
	ACID24_RESONANCE_SWING_RATIO,
	accentAmountToMultipliers,
	attackToSeconds,
	auxModulationDepthRatio,
	auxModulationSwing,
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
	resolveAccentModulationAmount,
	resolveAcidStepMidi,
	resolveAuxModulationAmount,
	resolveRandomModulationAmount,
	resonanceToModelParameter,
	saturationToPregain,
	subOctaveToRatio,
	sustainToRatio,
	tuneFineToRatio
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
		expect(mixCompensation(100, 0, 0)).toBeCloseTo(1, 5);
	});

	it('mixCompensation pulls gain down once two oscillators are driven hard, never doubling output', () => {
		const scale = mixCompensation(100, 0, 100);
		expect(scale).toBeLessThan(1);
		expect(scale).toBeGreaterThan(0);
	});

	it('mixCompensation pulls gain down further once all three oscillators are driven hard', () => {
		const twoUp = mixCompensation(100, 0, 100);
		const threeUp = mixCompensation(100, 100, 100);
		expect(threeUp).toBeLessThan(twoUp);
		expect(threeUp).toBeGreaterThan(0);
	});

	it('mixCompensation never boosts a quiet patch above unity', () => {
		expect(mixCompensation(20, 5, 10)).toBeLessThanOrEqual(1);
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

	it("ACID24_RESONANCE_SWING_RATIO narrows a Q-scaled resonance-mod swing down to acid24's own much smaller range, never expands it", () => {
		expect(ACID24_RESONANCE_SWING_RATIO).toBeGreaterThan(0);
		expect(ACID24_RESONANCE_SWING_RATIO).toBeLessThan(1);
		// A swing tuned against the full legacy Q ceiling (0.5-16), scaled by
		// this ratio, must land inside acid24's own 0-4 ladder-feedback range.
		const qCeiling = resonanceToModelParameter('legacy', 100);
		expect(qCeiling * ACID24_RESONANCE_SWING_RATIO).toBeLessThanOrEqual(4);
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

	it('saturationToPregain is 1x (clean) at 0, up to 6x at 100, and monotonic', () => {
		expect(saturationToPregain(0)).toBeCloseTo(1, 5);
		expect(saturationToPregain(100)).toBeCloseTo(6, 5);
		expect(saturationToPregain(75)).toBeGreaterThan(saturationToPregain(25));
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

	it('sustainToRatio is linear 0-1, and 100 reproduces the pre-Sustain "hold at full peak" behavior exactly', () => {
		expect(sustainToRatio(0)).toBe(0);
		expect(sustainToRatio(50)).toBeCloseTo(0.5, 5);
		expect(sustainToRatio(100)).toBe(1);
	});

	it('sustainToRatio clamps out-of-range input to the same 0-100 domain', () => {
		expect(sustainToRatio(-10)).toBe(0);
		expect(sustainToRatio(150)).toBe(1);
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

describe('auxiliary modulation mapping (Envelope/Accent/Random)', () => {
	const ALL_DESTINATIONS: AcidModulationDestination[] = [
		'cutoff',
		'resonance',
		'pitch',
		'pulseWidth',
		'subLevel',
		'osc2Level',
		'drive'
	];

	it('auxModulationDepthRatio: bipolar depth maps -100..100 to -1..1, clamped beyond', () => {
		expect(auxModulationDepthRatio(0)).toBe(0);
		expect(auxModulationDepthRatio(100)).toBe(1);
		expect(auxModulationDepthRatio(-100)).toBe(-1);
		expect(auxModulationDepthRatio(50)).toBeCloseTo(0.5, 5);
		expect(auxModulationDepthRatio(9999)).toBe(1);
		expect(auxModulationDepthRatio(-9999)).toBe(-1);
	});

	it('auxModulationSwing: destination mapping -- every destination returns a positive, finite, distinct-by-kind swing', () => {
		for (const destination of ALL_DESTINATIONS) {
			const swing = auxModulationSwing(destination, true, true);
			expect(Number.isFinite(swing)).toBe(true);
			expect(swing).toBeGreaterThan(0);
		}
	});

	it('auxModulationSwing: subLevel/osc2Level are inert whenever Sub/Osc 2 are off', () => {
		expect(auxModulationSwing('subLevel', false, true)).toBe(0);
		expect(auxModulationSwing('osc2Level', true, false)).toBe(0);
		expect(auxModulationSwing('subLevel', true, true)).toBeGreaterThan(0);
		expect(auxModulationSwing('osc2Level', true, true)).toBeGreaterThan(0);
	});

	it('auxModulationSwing: every destination stays within a musically safe, bounded range', () => {
		// Pinned, explicit ceilings -- a regression guard against a swing
		// constant accidentally growing large enough to push a destination
		// unsafe (spec M15's own "safe parameter clamps" requirement). Compared
		// against each destination's own known base-value ceiling elsewhere in
		// this file: cutoff tops out at MAX_CUTOFF_HZ (4500) before this swing,
		// well under MAX_SAFE_CUTOFF_HZ (12000) even with several sources
		// stacked; resonance/drive stay modest fractions of their own DSP
		// ranges (Q 0.5-16, pregain 1-10).
		expect(auxModulationSwing('cutoff', true, true)).toBeLessThanOrEqual(2000);
		expect(auxModulationSwing('resonance', true, true)).toBeLessThanOrEqual(3);
		expect(auxModulationSwing('drive', true, true)).toBeLessThanOrEqual(3);
		expect(auxModulationSwing('pitch', true, true)).toBeLessThanOrEqual(100);
		expect(auxModulationSwing('subLevel', true, true)).toBeLessThanOrEqual(1);
		expect(auxModulationSwing('osc2Level', true, true)).toBeLessThanOrEqual(1);
		expect(auxModulationSwing('pulseWidth', true, true)).toBeLessThanOrEqual(0.9);
	});

	describe('resolveAuxModulationAmount (Envelope source)', () => {
		it('source enable/disable: disabled always resolves to 0 regardless of depth', () => {
			expect(
				resolveAuxModulationAmount(
					{ enabled: false, destination: 'cutoff', depth: 100 },
					true,
					true
				)
			).toBe(0);
			expect(
				resolveAuxModulationAmount(
					{ enabled: false, destination: 'cutoff', depth: -100 },
					true,
					true
				)
			).toBe(0);
		});

		it('enabled resolves to depth ratio times the destination swing, sign-preserving', () => {
			const positive = resolveAuxModulationAmount(
				{ enabled: true, destination: 'cutoff', depth: 50 },
				true,
				true
			);
			const negative = resolveAuxModulationAmount(
				{ enabled: true, destination: 'cutoff', depth: -50 },
				true,
				true
			);
			expect(positive).toBeCloseTo(0.5 * auxModulationSwing('cutoff', true, true), 5);
			expect(negative).toBeCloseTo(-0.5 * auxModulationSwing('cutoff', true, true), 5);
		});
	});

	describe('resolveAccentModulationAmount (Accent source)', () => {
		it('only accented triggers ever get a nonzero contribution', () => {
			const source = { enabled: true, destination: 'drive' as const, depth: 100 };
			expect(resolveAccentModulationAmount(source, false, true, true)).toBe(0);
			expect(resolveAccentModulationAmount(source, true, true, true)).toBeGreaterThan(0);
		});

		it('an unaccented trigger is 0 even at full depth and a live destination', () => {
			expect(
				resolveAccentModulationAmount(
					{ enabled: true, destination: 'cutoff', depth: 100 },
					false,
					true,
					true
				)
			).toBe(0);
		});

		it('a disabled source stays 0 even when accented', () => {
			expect(
				resolveAccentModulationAmount(
					{ enabled: false, destination: 'cutoff', depth: 100 },
					true,
					true,
					true
				)
			).toBe(0);
		});
	});

	describe('resolveRandomModulationAmount (Random source)', () => {
		const source = { enabled: true, destination: 'pitch' as const, depth: 100 };

		it('bounded: never exceeds the destination swing in magnitude, across the full random range', () => {
			const swing = auxModulationSwing('pitch', true, true);
			for (let value = -1; value <= 1; value += 0.25) {
				const amount = resolveRandomModulationAmount(source, value, true, true);
				expect(Math.abs(amount)).toBeLessThanOrEqual(swing + 1e-9);
			}
		});

		it('deterministic: the same inputs always produce the same output', () => {
			const a = resolveRandomModulationAmount(source, 0.37, true, true);
			const b = resolveRandomModulationAmount(source, 0.37, true, true);
			expect(a).toBe(b);
		});

		it('a randomModulationValue of 0 always resolves to 0, regardless of depth', () => {
			expect(resolveRandomModulationAmount(source, 0, true, true)).toBe(0);
		});

		it('clamps an out-of-range randomModulationValue to -1..1 before applying it', () => {
			const atCeiling = resolveRandomModulationAmount(source, 1, true, true);
			const beyondCeiling = resolveRandomModulationAmount(source, 5, true, true);
			expect(beyondCeiling).toBeCloseTo(atCeiling, 5);
		});

		it('a disabled source stays 0 regardless of the random value', () => {
			expect(resolveRandomModulationAmount({ ...source, enabled: false }, 1, true, true)).toBe(0);
		});
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
			expect(Number.isFinite(saturationToPregain(value))).toBe(true);
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
