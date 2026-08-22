/**
 * Distortion characters (Acid Bass Intelligence V4 §31/§34/M16) -- one
 * shared transfer-curve character (`AcidDistortionPatch.character`) applied
 * to both pre-filter Saturation and post-VCA Drive, the two `WaveShaperNode`
 * stages `acid-bass-voice.ts` already has. Only the *curve shape* lives here;
 * how hard each stage drives into it (Saturation's `saturationToPregain`,
 * Drive's `driveToPregain`, both in `resolve.ts`) is unchanged and still
 * varies independently per patch/stage.
 *
 * `'soft'` is a verbatim extraction of the curve `acid-bass-voice.ts` used
 * unconditionally before this milestone -- migrated/existing patches (which
 * all default to `'soft'`, see `pattern.ts`) must sound identical.
 *
 * Curves are pure functions of `character` alone (never per-note state), so
 * `getDistortionCurve` caches one `Float32Array` per character and always
 * returns that same cached instance -- spec's own "avoid rebuilding curves
 * every note... curves may be cached by character."
 */

import type { AcidDistortionCharacter } from './types';

const CURVE_SAMPLES = 256;

function buildCurve(shape: (x: number) => number): Float32Array<ArrayBuffer> {
	const curve = new Float32Array(CURVE_SAMPLES);
	for (let i = 0; i < CURVE_SAMPLES; i++) {
		const x = (i / (CURVE_SAMPLES - 1)) * 2 - 1;
		curve[i] = shape(x);
	}
	return curve;
}

/** Verbatim extraction of the pre-M16 fixed tanh-like soft-clip curve -- see file header. Symmetric, smooth knee; effectively clean at low pregain, gently rounded at high pregain. */
function softShape(x: number): number {
	return Math.tanh(x * 1.5);
}

// A diode clipper conducts asymmetrically (hard in one direction, soft in
// the other) -- modeled here as a brighter/sharper positive half and a
// softer, slightly quieter negative half, rather than the symmetric curve
// Soft/Hard both use. Musically convincing, not a circuit simulation, the
// same "not circuit-accurate" idiom the rest of this codebase's DSP mappings
// already use (e.g. the acid24 ladder filter, `resolve.ts`'s own doc
// comments).
const DIODE_POSITIVE_DRIVE = 2.5;
const DIODE_NEGATIVE_DRIVE = 1.2;
const DIODE_NEGATIVE_TRIM = 0.85;

function diodeShape(x: number): number {
	return x >= 0 ? Math.tanh(x * DIODE_POSITIVE_DRIVE) : Math.tanh(x * DIODE_NEGATIVE_DRIVE) * DIODE_NEGATIVE_TRIM;
}

// A genuinely harder-edged clip than Soft or Diode -- approaches a squared-
// off knee (linear until it slams into the ±1 ceiling) rather than either's
// smooth tanh roll-off, for a more aggressive, more overtly "digital clip"
// character. Still continuous and bounded to -1..1 (WaveShaperNode's own
// domain), never a literal step discontinuity.
const HARD_CLIP_DRIVE = 4;

function hardShape(x: number): number {
	return Math.sign(x) * Math.min(1, Math.abs(x) * HARD_CLIP_DRIVE);
}

const CURVE_BUILDERS: Record<AcidDistortionCharacter, (x: number) => number> = {
	soft: softShape,
	diode: diodeShape,
	hard: hardShape
};

const curveCache = new Map<AcidDistortionCharacter, Float32Array<ArrayBuffer>>();

/** The cached, shared curve for `character` -- always the same `Float32Array` instance for the same character, so assigning `WaveShaperNode.curve` on a patch edit never rebuilds anything. */
export function getDistortionCurve(character: AcidDistortionCharacter): Float32Array<ArrayBuffer> {
	const cached = curveCache.get(character);
	if (cached !== undefined) return cached;
	const curve = buildCurve(CURVE_BUILDERS[character]);
	curveCache.set(character, curve);
	return curve;
}
