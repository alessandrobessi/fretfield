import type { ChordDefinition, ChordFamily } from './chords';
import { type FretPosition, createFretboard } from './fretboard';
import { ALL_INTERVALS, type IntervalId, intervalFromRoot, intervalSemitones } from './intervals';
import type { PitchClass } from './pitch';
import type { Tuning } from './tuning';

/**
 * Full semantic role vocabulary from BLUEPRINT.md §5.2. 'root', 'structural',
 * and 'stable' come from a chord's own formula (chords.ts); the remaining six
 * are Harmonic Field roles classified below.
 */
export type HarmonicRole =
	| 'root'
	| 'structural'
	| 'stable'
	| 'extension'
	| 'color'
	| 'tension'
	| 'alteration'
	| 'chromatic-approach'
	| 'avoid';

/**
 * Per-chord-family default role for an interval that is *not* part of the
 * chord's own formula (`required`). This is deliberately keyed by family —
 * never a single flat interval→role table — per AGENTS.md §6: the same
 * interval means different things over different harmonic contexts (e.g.
 * `b3`/`#9` is a recognized dominant tension, but the same pitch is simply
 * dissonant against a minor chord's own required `b3`).
 *
 * Calibrated against BLUEPRINT.md §4's worked C7 example (the one place the
 * product spec gives a complete, authoritative 12-interval field) and
 * AGENTS.md §6's explicit wording ("4/11 may create significant *tension*
 * over a major chord..." — not "avoid"). `avoid` is reserved for tones with
 * no recognized idiomatic use in that family, matching AGENTS.md §22's
 * "no wrong note" framing: label context-dependent tension carefully rather
 * than reaching for "avoid" by default.
 */
const FAMILY_DEFAULT_ROLES: Record<ChordFamily, Partial<Record<IntervalId, HarmonicRole>>> = {
	major: {
		b2: 'avoid', // b9 with no dominant function — no recognized idiom over plain major
		'2': 'extension', // 9 — add9/maj9 are extremely common
		b3: 'color', // blues "minor 3rd over major" device
		'4': 'tension', // 11 clashes against the required major 3rd (AGENTS.md §6's own example)
		'#4': 'extension', // #11 — lydian color, maj7#11 is a jazz staple
		b6: 'avoid', // b13 with no dominant function, and a half-step against the required 5th
		'6': 'extension', // 13 — very common, consonant
		b7: 'color', // implies a dominant/mixolydian leaning over a bare major triad
		'7': 'extension' // only reachable for the bare triad; defines maj7 quality
	},
	minor: {
		b2: 'avoid', // no recognized idiom over plain (aeolian/dorian) minor
		'2': 'extension', // 9 — m9 chords, dorian
		'3': 'avoid', // clashes directly against the required b3, no recognized idiom
		'4': 'extension', // 11 — very available, no clashing 3rd to fight
		'#4': 'color', // dorian-#4 / melodic-minor-iv color, not universally diatonic
		b6: 'tension', // aeolian 6th, but a half-step against the required 5th
		'6': 'extension', // dorian 13th — m13 chords, extremely common despite sitting near b7
		b7: 'extension', // only reachable for the bare triad; dorian/aeolian 7th
		'7': 'alteration' // minor-major7 — a recognized, deliberate altered chord color
	},
	dominant: {
		b2: 'tension', // b9 — BLUEPRINT: "strong altered tension"
		'2': 'extension', // 9
		b3: 'tension', // #9 — BLUEPRINT: "altered/blues tension"
		'4': 'tension', // 11 — BLUEPRINT: "tension" (natural, but clashes against the 3rd)
		'#4': 'tension', // #11 — BLUEPRINT: "altered tension"
		b6: 'tension', // b13 — BLUEPRINT: "altered tension"
		'6': 'color', // 13 — BLUEPRINT: "color"
		'7': 'chromatic-approach' // BLUEPRINT: leading tone a half-step below the root
	},
	suspended: {
		b2: 'avoid',
		'2': 'extension', // add9 over sus2/sus4 alike
		b3: 'avoid', // default for sus2 (clashes against its required 2); overridden for sus4
		'3': 'color', // default for sus2 (mild color a whole step above its required 2); overridden for sus4
		'4': 'extension', // add4 over sus2; structural for sus4 itself
		'#4': 'color',
		b6: 'avoid', // clashes against the required 5th, no recognized idiom
		'6': 'extension', // 13sus is common
		b7: 'extension', // 7sus is ubiquitous
		'7': 'color' // maj7 over a sus chord is rare/exotic rather than idiomatic
	},
	diminished: {
		b2: 'avoid',
		'2': 'extension', // half-whole diminished scale 9th
		'3': 'avoid', // clashes against the required b3
		'4': 'color', // half-whole diminished scale tone
		'5': 'avoid', // clashes against the required #4/b5, no recognized idiom
		b6: 'color', // default; diminished-7 overrides to 'avoid' (see CHORD_ROLE_OVERRIDES)
		'6': 'color', // only reachable for triad/m7b5; genre-dependent
		b7: 'avoid', // only reachable for triad/dim7; no recognized idiom
		'7': 'chromatic-approach' // leading tone a half-step below the root, same as dominant
	},
	augmented: {
		b2: 'avoid',
		'2': 'extension', // whole-tone scale 9th — C+9 is a known color
		b3: 'avoid', // clashes against the required major 3rd
		'4': 'avoid', // outside the whole-tone palette; clashes against the required 3rd
		'5': 'avoid', // clashes against the required b6/#5
		'#4': 'extension', // whole-tone scale tone (#11)
		'6': 'color', // outside the whole-tone palette but occasionally used
		b7: 'extension', // whole-tone scale tone — 7#5 chords are common
		'7': 'alteration' // augmented-major7 — a recognized altered chord color
	}
};

/**
 * Sparse per-chord overrides for the handful of cases where family-level
 * granularity genuinely isn't precise enough — e.g. sus2 and sus4 disagree
 * on which "missing" third clashes with their own structural tone.
 */
const CHORD_ROLE_OVERRIDES: Record<string, Partial<Record<IntervalId, HarmonicRole>>> = {
	sus4: { '3': 'avoid', b3: 'color' },
	'diminished-7': { b6: 'avoid' } // half-step against the chord's own required natural 6th (bb7)
};

const FALLBACK_ROLE: HarmonicRole = 'color';

/**
 * Classifies a single interval's role over `chord`. Never a universal
 * interval→role table (AGENTS.md §6): the role always depends on whether —
 * and how — this specific chord (and its family) uses the interval.
 */
export function analyzeInterval(chord: ChordDefinition, interval: IntervalId): HarmonicRole {
	if (interval === '1') {
		return 'root';
	}
	if (chord.required.includes(interval)) {
		return chord.structuralIntervals.includes(interval) ? 'structural' : 'stable';
	}
	const override = CHORD_ROLE_OVERRIDES[chord.id]?.[interval];
	if (override) {
		return override;
	}
	return FAMILY_DEFAULT_ROLES[chord.family][interval] ?? FALLBACK_ROLE;
}

/** Whether `interval` is part of `chord`'s own formula. */
export function isChordTone(chord: ChordDefinition, interval: IntervalId): boolean {
	return interval === '1' || chord.required.includes(interval);
}

interface RoleScore {
	stability: number;
	tension: number;
}

/**
 * Internal modeling numbers (AGENTS.md §21) used for opacity/emphasis/
 * ordering — never presented in the UI as objective percentages.
 */
const ROLE_SCORES: Record<HarmonicRole, RoleScore> = {
	root: { stability: 1, tension: 0 },
	structural: { stability: 0.85, tension: 0.1 },
	stable: { stability: 0.8, tension: 0.05 },
	extension: { stability: 0.6, tension: 0.2 },
	color: { stability: 0.5, tension: 0.3 },
	tension: { stability: 0.3, tension: 0.7 },
	alteration: { stability: 0.35, tension: 0.65 },
	'chromatic-approach': { stability: 0.2, tension: 0.5 },
	avoid: { stability: 0.1, tension: 0.85 }
};

export function roleStability(role: HarmonicRole): number {
	return ROLE_SCORES[role].stability;
}

/** b9 over a dominant chord is a marginally stronger tension than its siblings (BLUEPRINT: "strong"). */
export function roleTension(role: HarmonicRole, interval: IntervalId): number {
	const base = ROLE_SCORES[role].tension;
	if (role === 'tension' && interval === 'b2') {
		return Math.min(1, base + 0.15);
	}
	return base;
}

/** Short, UI-safe domain phrase per role — concise musical language, not a "wrong note" verdict (AGENTS.md §21-22). */
export function roleCharacter(role: HarmonicRole): string {
	switch (role) {
		case 'root':
			return 'Root';
		case 'structural':
			return 'Structural — defines chord quality';
		case 'stable':
			return 'Stable chord tone';
		case 'extension':
			return 'Available extension';
		case 'color':
			return 'Color — genre-dependent';
		case 'tension':
			return 'Tension';
		case 'alteration':
			return 'Altered chord color';
		case 'chromatic-approach':
			return 'Chromatic approach tone';
		case 'avoid':
			return 'Dissonant against this harmony';
	}
}

/**
 * The chord tone(s) nearest `interval` by semitone distance — a simple,
 * mechanical notion of "where this tone wants to resolve" within the
 * current harmony. Only meaningful for non-stable roles; the caller decides
 * whether to surface it.
 */
export function typicalResolutions(chord: ChordDefinition, interval: IntervalId): IntervalId[] {
	const from = intervalSemitones(interval);
	const candidates = chord.required.filter((id) => id !== interval);
	const distance = (id: IntervalId): number => {
		const diff = intervalSemitones(id) - from;
		const normalized = ((diff % 12) + 12) % 12;
		return Math.min(normalized, 12 - normalized);
	};
	return candidates
		.slice()
		.sort((a, b) => distance(a) - distance(b))
		.slice(0, 2);
}

export interface AnalyzedFretPosition extends FretPosition {
	interval: IntervalId;
	chordTone: boolean;
	role: HarmonicRole;
	stability: number;
	tension: number;
	typicalResolutions: IntervalId[];
}

export interface AnalyzeFretboardOptions {
	tuning: Tuning;
	fretCount: number;
	root: PitchClass;
	chord: ChordDefinition;
}

/** The single entry point the UI calls — computed once per state change. */
export function analyzeFretboard(options: AnalyzeFretboardOptions): AnalyzedFretPosition[] {
	const { tuning, fretCount, root, chord } = options;
	return createFretboard(tuning, fretCount).map((position) => {
		const interval = intervalFromRoot(root, position.pitchClass);
		const role = analyzeInterval(chord, interval);
		const chordTone = isChordTone(chord, interval);
		return {
			...position,
			interval,
			chordTone,
			role,
			stability: roleStability(role),
			tension: roleTension(role, interval),
			typicalResolutions: chordTone ? [] : typicalResolutions(chord, interval)
		};
	});
}

/** All twelve canonical intervals — re-exported for callers that want the full field (e.g. tests, future modes). */
export const ALL_ROLE_INTERVALS: readonly IntervalId[] = ALL_INTERVALS;
