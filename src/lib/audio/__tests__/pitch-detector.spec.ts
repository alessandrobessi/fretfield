import { describe, expect, it } from 'vitest';
import { detectPitch } from '../pitch-detector';
import { DEFAULT_PITCH_DETECTOR_CONFIG } from '../types';

const SAMPLE_RATE = 48000;

function generateSine(
	frequencyHz: number,
	sampleRate: number,
	length: number,
	amplitude = 0.5
): Float32Array {
	const samples = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		samples[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
	}
	return samples;
}

function generateHarmonicRich(
	fundamentalHz: number,
	sampleRate: number,
	length: number,
	partialAmplitudes: number[]
): Float32Array {
	const samples = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let value = 0;
		for (let partial = 0; partial < partialAmplitudes.length; partial++) {
			const harmonicHz = fundamentalHz * (partial + 1);
			value += partialAmplitudes[partial] * Math.sin((2 * Math.PI * harmonicHz * i) / sampleRate);
		}
		samples[i] = value;
	}
	return samples;
}

/** The standard 4-string bass range plus reasonable margin, per the product spec. */
const BASS_NOTES: { name: string; frequencyHz: number }[] = [
	{ name: 'E1', frequencyHz: 41.2 },
	{ name: 'A1', frequencyHz: 55.0 },
	{ name: 'D2', frequencyHz: 73.42 },
	{ name: 'G2', frequencyHz: 98.0 },
	{ name: 'C3', frequencyHz: 130.81 },
	{ name: 'E3', frequencyHz: 164.81 },
	{ name: 'G4', frequencyHz: 392.0 }
];

describe('detectPitch — pure sine waves across the bass range', () => {
	for (const { name, frequencyHz } of BASS_NOTES) {
		it(`detects ${name} (~${frequencyHz} Hz)`, () => {
			const samples = generateSine(
				frequencyHz,
				SAMPLE_RATE,
				DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize
			);
			const estimate = detectPitch(samples, SAMPLE_RATE);
			expect(estimate).not.toBeNull();
			expect(estimate!.frequencyHz).toBeCloseTo(frequencyHz, 0);
			expect(estimate!.confidence).toBeGreaterThan(0.8);
		});
	}
});

describe('detectPitch — robust to a louder harmonic than the fundamental', () => {
	it('still reports the fundamental when the 2nd harmonic is louder', () => {
		const fundamentalHz = 55.0; // A1
		const samples = generateHarmonicRich(
			fundamentalHz,
			SAMPLE_RATE,
			DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize,
			[
				0.3, // fundamental
				0.6, // 2nd harmonic, louder
				0.2 // 3rd harmonic
			]
		);
		const estimate = detectPitch(samples, SAMPLE_RATE);
		expect(estimate).not.toBeNull();
		expect(estimate!.frequencyHz).toBeCloseTo(fundamentalHz, 0);
	});

	it('still reports the fundamental when the 3rd harmonic is the loudest partial', () => {
		const fundamentalHz = 98.0; // G2
		const samples = generateHarmonicRich(
			fundamentalHz,
			SAMPLE_RATE,
			DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize,
			[0.25, 0.35, 0.55]
		);
		const estimate = detectPitch(samples, SAMPLE_RATE);
		expect(estimate).not.toBeNull();
		expect(estimate!.frequencyHz).toBeCloseTo(fundamentalHz, 0);
	});
});

describe('detectPitch — rejects non-pitched or out-of-range input', () => {
	it('returns null for silence', () => {
		const samples = new Float32Array(DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize);
		expect(detectPitch(samples, SAMPLE_RATE)).toBeNull();
	});

	it('returns null for very low RMS (near-silent noise floor)', () => {
		const samples = generateSine(
			110,
			SAMPLE_RATE,
			DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize,
			0.0001
		);
		expect(detectPitch(samples, SAMPLE_RATE)).toBeNull();
	});

	it('returns null for white noise (no stable period)', () => {
		const samples = new Float32Array(DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize);
		// Deterministic pseudo-random noise so the test is reproducible.
		let seed = 42;
		for (let i = 0; i < samples.length; i++) {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			samples[i] = (seed / 0x7fffffff) * 2 - 1;
		}
		expect(detectPitch(samples, SAMPLE_RATE)).toBeNull();
	});

	it('returns null for a buffer too short to analyze the configured range', () => {
		const samples = generateSine(110, SAMPLE_RATE, 32);
		expect(detectPitch(samples, SAMPLE_RATE)).toBeNull();
	});

	it('never reports a frequency outside the configured range', () => {
		// A pure tone above the ceiling is periodic at integer submultiples of its
		// true frequency too (that's what "periodic" means), so a submultiple can
		// legitimately fall inside the search band and get reported — that's not a
		// bug, it's inherent to any lag/period-restricted detector. The guarantee
		// we can actually make is that whatever comes back (if anything) always
		// respects the configured bounds.
		const samples = generateSine(1000, SAMPLE_RATE, DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize);
		const estimate = detectPitch(samples, SAMPLE_RATE);
		if (estimate !== null) {
			expect(estimate.frequencyHz).toBeGreaterThanOrEqual(
				DEFAULT_PITCH_DETECTOR_CONFIG.minFrequencyHz
			);
			expect(estimate.frequencyHz).toBeLessThanOrEqual(
				DEFAULT_PITCH_DETECTOR_CONFIG.maxFrequencyHz
			);
		}
	});

	it('respects a custom, narrower configured range', () => {
		const samples = generateSine(98.0, SAMPLE_RATE, DEFAULT_PITCH_DETECTOR_CONFIG.bufferSize);
		const estimate = detectPitch(samples, SAMPLE_RATE, {
			...DEFAULT_PITCH_DETECTOR_CONFIG,
			minFrequencyHz: 200,
			maxFrequencyHz: 450
		});
		expect(estimate).toBeNull();
	});
});
