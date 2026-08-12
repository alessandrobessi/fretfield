import {
	DEFAULT_PITCH_DETECTOR_CONFIG,
	type PitchDetectorConfig,
	type PitchEstimate
} from './types';

function computeRms(samples: Float32Array): number {
	let sumSquares = 0;
	for (let i = 0; i < samples.length; i++) {
		sumSquares += samples[i] * samples[i];
	}
	return Math.sqrt(sumSquares / samples.length);
}

/**
 * The YIN difference function (de Cheveigné & Kawahara 2002, eq. 6): for each
 * candidate lag `tau`, how well does the signal correlate with itself shifted
 * by `tau` samples. A true period produces a deep dip near tau = period.
 */
function differenceFunction(samples: Float32Array, maxTau: number): Float32Array {
	const diff = new Float32Array(maxTau + 1);
	const windowLength = samples.length - maxTau;
	for (let tau = 0; tau <= maxTau; tau++) {
		let sum = 0;
		for (let j = 0; j < windowLength; j++) {
			const delta = samples[j] - samples[j + tau];
			sum += delta * delta;
		}
		diff[tau] = sum;
	}
	return diff;
}

/** Cumulative mean normalized difference function (eq. 8) — this is what makes YIN robust to loud overtones a plain difference/autocorrelation isn't. */
function cumulativeMeanNormalizedDifference(diff: Float32Array): Float32Array {
	const cmndf = new Float32Array(diff.length);
	cmndf[0] = 1;
	let runningSum = 0;
	for (let tau = 1; tau < diff.length; tau++) {
		runningSum += diff[tau];
		cmndf[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
	}
	return cmndf;
}

/** Parabolic interpolation around a discrete minimum for sub-sample lag accuracy (eq. 9). */
function parabolicInterpolation(cmndf: Float32Array, tau: number): number {
	if (tau <= 0 || tau >= cmndf.length - 1) return tau;
	const s0 = cmndf[tau - 1];
	const s1 = cmndf[tau];
	const s2 = cmndf[tau + 1];
	const denominator = 2 * (2 * s1 - s2 - s0);
	if (denominator === 0) return tau;
	const adjustment = (s2 - s0) / denominator;
	return Math.abs(adjustment) < 1 ? tau + adjustment : tau;
}

/**
 * Finds the first local minimum below `threshold` in ascending tau order
 * (YIN's "absolute threshold" step), falling back to the global minimum if
 * nothing crosses the threshold — the resulting low confidence naturally
 * filters those out downstream rather than needing a separate early return.
 */
function findBestTau(
	cmndf: Float32Array,
	minTau: number,
	maxTau: number,
	threshold: number
): number {
	for (let tau = minTau; tau <= maxTau; tau++) {
		if (cmndf[tau] < threshold) {
			let better = tau;
			while (better + 1 <= maxTau && cmndf[better + 1] < cmndf[better]) {
				better++;
			}
			return better;
		}
	}
	let minIndex = minTau;
	for (let tau = minTau + 1; tau <= maxTau; tau++) {
		if (cmndf[tau] < cmndf[minIndex]) minIndex = tau;
	}
	return minIndex;
}

/**
 * Monophonic fundamental-frequency detection via YIN. Deliberately not a
 * spectral-peak or zero-crossing detector: bass signals routinely have a
 * louder 2nd/3rd harmonic than the fundamental, and YIN's autocorrelation-
 * style periodicity search is robust to that (see the harmonic-rich test
 * cases in pitch-detector.spec.ts).
 */
export function detectPitch(
	samples: Float32Array,
	sampleRate: number,
	config: PitchDetectorConfig = DEFAULT_PITCH_DETECTOR_CONFIG
): PitchEstimate | null {
	const { minFrequencyHz, maxFrequencyHz, yinThreshold, minRms, minConfidence } = config;

	if (computeRms(samples) < minRms) return null;

	const minTau = Math.max(1, Math.floor(sampleRate / maxFrequencyHz));
	const maxTau = Math.min(
		Math.floor(sampleRate / minFrequencyHz),
		Math.floor(samples.length / 2) - 1
	);
	if (maxTau <= minTau) return null;

	const diff = differenceFunction(samples, maxTau);
	const cmndf = cumulativeMeanNormalizedDifference(diff);
	const tau = findBestTau(cmndf, minTau, maxTau, yinThreshold);

	const confidence = Math.max(0, Math.min(1, 1 - cmndf[tau]));
	if (confidence < minConfidence) return null;

	const interpolatedTau = parabolicInterpolation(cmndf, tau);
	const frequencyHz = sampleRate / interpolatedTau;
	if (frequencyHz < minFrequencyHz || frequencyHz > maxFrequencyHz) return null;

	return { frequencyHz, confidence };
}
