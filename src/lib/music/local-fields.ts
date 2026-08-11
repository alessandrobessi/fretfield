import type { AnalyzedFretPosition } from './harmony';
import type { FretPosition } from './fretboard';

/**
 * A bounded, contiguous span of frets — a "local view" of the harmonic
 * field, not a fixed CAGED-style shape. Regions are meant to overlap: the
 * same pitch reachable in two adjacent regions is what makes them feel
 * connected rather than disconnected boxes (BLUEPRINT.md / ROADMAP.md
 * Local Fields goal).
 */
export interface FretboardRegion {
	id: string;
	minFret: number;
	maxFret: number;
	anchor?: FretPosition;
}

export interface LocalFieldAnalysis {
	region: FretboardRegion;
	positions: AnalyzedFretPosition[];
	coverageScore: number;
	rootCoverage: number;
	structuralCoverage: number;
}

export const DEFAULT_REGION_WIDTH = 5;

/**
 * Builds a region of `width` frets centered on `anchorFret`, clipped to
 * `[0, fretCount]`. Clipping shifts the window rather than shrinking it
 * where there's room, so regions near the nut or the top of the neck stay
 * the same size as everywhere else.
 */
export function createFretboardRegion(
	anchorFret: number,
	width: number,
	fretCount: number,
	anchor?: FretPosition
): FretboardRegion {
	const half = Math.floor((width - 1) / 2);
	let minFret = anchorFret - half;
	let maxFret = minFret + width - 1;

	if (minFret < 0) {
		maxFret += -minFret;
		minFret = 0;
	}
	if (maxFret > fretCount) {
		minFret -= maxFret - fretCount;
		maxFret = fretCount;
	}
	minFret = Math.max(0, minFret);
	maxFret = Math.min(fretCount, maxFret);

	return { id: `region-${minFret}-${maxFret}`, minFret, maxFret, anchor };
}

/** Named weights for region ranking — kept explicit and centralized, not magic numbers. */
const REGION_WEIGHTS = {
	root: 0.45,
	structural: 0.3,
	stable: 0.15,
	extension: 0.1,
	/** Subtracted per fret of width — a mild preference for compactness among equally-covering regions. */
	compactnessPerFret: 0.015
};

function distinctStringCoverage(
	positions: AnalyzedFretPosition[],
	role: AnalyzedFretPosition['role'],
	stringCount: number
): number {
	if (stringCount === 0) return 0;
	const strings = new Set(positions.filter((p) => p.role === role).map((p) => p.stringIndex));
	return Math.min(1, strings.size / stringCount);
}

/**
 * Analyzes how useful `region` is for the harmony already computed in
 * `analyzedPositions` (the full-neck result from `analyzeFretboard`).
 */
export function analyzeLocalField(
	region: FretboardRegion,
	analyzedPositions: AnalyzedFretPosition[]
): LocalFieldAnalysis {
	const stringCount = new Set(analyzedPositions.map((p) => p.stringIndex)).size;
	const positions = analyzedPositions.filter(
		(p) => p.fret >= region.minFret && p.fret <= region.maxFret
	);

	const rootCoverage = distinctStringCoverage(positions, 'root', stringCount);
	const structuralCoverage = distinctStringCoverage(positions, 'structural', stringCount);
	const stableCoverage = distinctStringCoverage(positions, 'stable', stringCount);
	const extensionCoverage = distinctStringCoverage(positions, 'extension', stringCount);
	const width = region.maxFret - region.minFret + 1;

	const coverageScore = Math.max(
		0,
		REGION_WEIGHTS.root * rootCoverage +
			REGION_WEIGHTS.structural * structuralCoverage +
			REGION_WEIGHTS.stable * stableCoverage +
			REGION_WEIGHTS.extension * extensionCoverage -
			REGION_WEIGHTS.compactnessPerFret * width
	);

	return { region, positions, coverageScore, rootCoverage, structuralCoverage };
}

/**
 * Slides an overlapping window (50% step) across the whole neck and ranks
 * every distinct region by usefulness. Overlap is deliberate — it's what
 * lets adjacent regions share reachable tones (see module doc).
 */
export function findUsefulLocalFields(
	analyzedPositions: AnalyzedFretPosition[],
	fretCount: number,
	width: number = DEFAULT_REGION_WIDTH
): LocalFieldAnalysis[] {
	const step = Math.max(1, Math.floor(width / 2));
	const seen = new Set<string>();
	const regions: FretboardRegion[] = [];

	for (let anchorFret = 0; anchorFret <= fretCount; anchorFret += step) {
		const region = createFretboardRegion(anchorFret, width, fretCount);
		if (!seen.has(region.id)) {
			seen.add(region.id);
			regions.push(region);
		}
	}

	return regions
		.map((region) => analyzeLocalField(region, analyzedPositions))
		.sort((a, b) => b.coverageScore - a.coverageScore);
}
