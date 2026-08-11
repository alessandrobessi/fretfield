import { describe, expect, it } from 'vitest';
import { getChordDefinition } from '../chords';
import { analyzeFretboard } from '../harmony';
import { analyzeLocalField, createFretboardRegion, findUsefulLocalFields } from '../local-fields';
import { noteNameToPitchClass } from '../pitch';
import { STANDARD_4_STRING_TUNING } from '../tuning';

describe('createFretboardRegion', () => {
	it('centers a region on the anchor fret', () => {
		const region = createFretboardRegion(10, 5, 20);
		expect(region.minFret).toBe(8);
		expect(region.maxFret).toBe(12);
	});

	it('shifts (not shrinks) the region when the anchor is near the nut', () => {
		const region = createFretboardRegion(0, 5, 20);
		expect(region.minFret).toBe(0);
		expect(region.maxFret).toBe(4);
	});

	it('shifts (not shrinks) the region when the anchor is near the top of the neck', () => {
		const region = createFretboardRegion(20, 5, 20);
		expect(region.minFret).toBe(16);
		expect(region.maxFret).toBe(20);
	});

	it('clips to the fretboard even when width exceeds fretCount', () => {
		const region = createFretboardRegion(2, 30, 20);
		expect(region.minFret).toBe(0);
		expect(region.maxFret).toBe(20);
	});
});

describe('analyzeLocalField', () => {
	const root = noteNameToPitchClass('C');
	const chord = getChordDefinition('dominant-7');
	const analyzed = analyzeFretboard({
		tuning: STANDARD_4_STRING_TUNING,
		fretCount: 20,
		root,
		chord
	});

	it('only includes positions within the region bounds', () => {
		const region = createFretboardRegion(3, 5, 20);
		const analysis = analyzeLocalField(region, analyzed);
		for (const position of analysis.positions) {
			expect(position.fret).toBeGreaterThanOrEqual(region.minFret);
			expect(position.fret).toBeLessThanOrEqual(region.maxFret);
		}
	});

	it('a region containing the root on every string scores full root coverage', () => {
		// C appears on every string within frets 0-12 somewhere; a wide region guarantees full coverage.
		const region = createFretboardRegion(6, 13, 20);
		const analysis = analyzeLocalField(region, analyzed);
		expect(analysis.rootCoverage).toBe(1);
	});

	it('a region with no chord tones at all scores zero root/structural coverage', () => {
		// Degenerate but valid: a region so narrow near an area with no root and no structural tone.
		const emptyRegion = { id: 'empty', minFret: 0, maxFret: 0 };
		const analysis = analyzeLocalField(emptyRegion, []);
		expect(analysis.rootCoverage).toBe(0);
		expect(analysis.structuralCoverage).toBe(0);
		expect(analysis.coverageScore).toBe(0);
	});
});

describe('findUsefulLocalFields', () => {
	const root = noteNameToPitchClass('C');
	const chord = getChordDefinition('dominant-7');
	const analyzed = analyzeFretboard({
		tuning: STANDARD_4_STRING_TUNING,
		fretCount: 20,
		root,
		chord
	});

	it('returns regions ranked by descending coverage score', () => {
		const regions = findUsefulLocalFields(analyzed, 20);
		expect(regions.length).toBeGreaterThan(0);
		for (let i = 1; i < regions.length; i++) {
			expect(regions[i - 1].coverageScore).toBeGreaterThanOrEqual(regions[i].coverageScore);
		}
	});

	it('adjacent regions overlap (share at least one fret)', () => {
		const regions = findUsefulLocalFields(analyzed, 20, 5);
		const byMinFret = [...regions].sort((a, b) => a.region.minFret - b.region.minFret);
		let sawOverlap = false;
		for (let i = 1; i < byMinFret.length; i++) {
			if (byMinFret[i].region.minFret <= byMinFret[i - 1].region.maxFret) {
				sawOverlap = true;
			}
		}
		expect(sawOverlap).toBe(true);
	});

	it('produces no duplicate regions even where edge-clipping would otherwise collide', () => {
		const regions = findUsefulLocalFields(analyzed, 20, 5);
		const ids = regions.map((r) => r.region.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
