import type { FretRange } from '$lib/music/fret-range';
import type { IntervalId } from '$lib/music/intervals';
import { normalizePitchClass, type PitchClass } from '$lib/music/pitch';
import { fretfield, type PathPreset } from '$lib/stores/fretfield.svelte';
import { navigation } from '$lib/stores/navigation.svelte';
import { practice } from '$lib/stores/practice.svelte';
import { practiceHistory } from '$lib/stores/practice-history.svelte';
import { scalePractice } from '$lib/stores/scale-practice.svelte';
import type { HintLevel, PracticeMode } from './types';

/** Everything a preset can open into — the four Guided Practice modes plus Scale Practice. */
export type PracticeActivity = PracticeMode | 'scales';

/**
 * A curated, one-click practice session — reduces the "configure five
 * fields before you can start" burden Phase 10 of the roadmap calls out.
 * Every field here maps directly onto an existing setter (`fretfield`,
 * `practice`, `scalePractice`) — a preset is just "call these setters, then
 * start," never a new practice mechanic of its own.
 */
export interface PracticePreset {
	id: string;
	title: string;
	description: string;
	activity: PracticeActivity;
	context: {
		root: PitchClass;
		chordId?: string;
		progressionTemplateId?: string;
		scaleId?: string;
		pathPreset?: PathPreset;
	};
	/** Constrains the neck for Follow Path (via Local Field only) or sets Scale Practice's zone directly. */
	position?: FretRange;
	hintLevel?: HintLevel;
	/** Pins the exercise's target instead of letting it randomize — most presets name a specific interval in their title, so the target should match rather than vary. */
	targetInterval?: IntervalId;
}

const C: PitchClass = normalizePitchClass(0);
const D: PitchClass = normalizePitchClass(2);
const E: PitchClass = normalizePitchClass(4);
const G: PitchClass = normalizePitchClass(7);
const A: PitchClass = normalizePitchClass(9);

const PRESET_LIST: PracticePreset[] = [
	// Essential
	{
		id: 'find-the-thirds',
		title: 'Find the Thirds',
		description: 'Locate the 3rd of a C major chord, anywhere on the neck.',
		activity: 'find-interval',
		context: { root: C, chordId: 'major' },
		targetInterval: '3'
	},
	{
		id: 'find-the-sevenths',
		title: 'Find the Sevenths',
		description: 'Locate the b7 of a C dominant 7 chord.',
		activity: 'find-interval',
		context: { root: C, chordId: 'dominant-7' },
		targetInterval: 'b7'
	},
	{
		id: 'root-third-fifth',
		title: 'Root–Third–Fifth',
		description: 'Find the core chord tones of a C major triad.',
		activity: 'find-chord-tone',
		context: { root: C, chordId: 'major' }
	},
	{
		id: 'dominant-guide-tones',
		title: 'Dominant Guide Tones',
		description: 'Find the 3rd of a C dominant 7 chord — the tone that defines its quality.',
		activity: 'find-chord-tone',
		context: { root: C, chordId: 'dominant-7' },
		targetInterval: '3'
	},
	{
		id: 'ii-v-i-resolutions',
		title: 'ii–V–I Resolutions',
		description: 'Resolve notes through a major ii–V–I in C.',
		activity: 'resolve-note',
		context: { root: C, progressionTemplateId: 'major-ii-v-i' }
	},
	{
		id: 'minor-ii-v-i-resolutions',
		title: 'Minor ii–V–I Resolutions',
		description: 'Resolve notes through a minor ii–V–i in C.',
		activity: 'resolve-note',
		context: { root: C, progressionTemplateId: 'minor-ii-v-i' }
	},

	// Voice Leading
	{
		id: 'closest-chord-tone',
		title: 'Closest Chord Tone',
		description: 'Follow a ii–V–I path that always takes the smallest possible step.',
		activity: 'follow-path',
		context: { root: C, progressionTemplateId: 'major-ii-v-i', pathPreset: 'minimal-movement' }
	},
	{
		id: 'guide-tone-movement',
		title: 'Guide-Tone Movement',
		description: 'Follow a ii–V–I path built from 3rds and 7ths.',
		activity: 'follow-path',
		context: { root: C, progressionTemplateId: 'major-ii-v-i', pathPreset: 'guide-tones' }
	},
	{
		id: 'stay-within-five-frets',
		title: 'Stay Within Five Frets',
		description: 'Follow a ii–V–I path constrained to a single five-fret position.',
		activity: 'follow-path',
		context: { root: C, progressionTemplateId: 'major-ii-v-i', pathPreset: 'balanced' },
		position: { minFret: 0, maxFret: 5 }
	},
	{
		id: 'navigate-without-roots',
		// No engine primitive excludes root-position targets specifically yet
		// — a guide-tone path (3rds/7ths) is the closest existing proxy, since
		// it rarely lands on the root anyway.
		title: 'Navigate Without Roots',
		description:
			'Follow a guide-tone path through a ii–V–I — naturally avoids leaning on the root.',
		activity: 'follow-path',
		context: { root: C, progressionTemplateId: 'major-ii-v-i', pathPreset: 'guide-tones' }
	},

	// Scales
	{
		id: 'major-scale-one-position',
		title: 'Major Scale in One Position',
		description: 'C Ionian, confined to the first five frets.',
		activity: 'scales',
		context: { root: C, scaleId: 'ionian' },
		position: { minFret: 0, maxFret: 5 }
	},
	{
		id: 'dorian-across-the-neck',
		title: 'Dorian Across the Neck',
		description: 'D Dorian across the full fretboard.',
		activity: 'scales',
		context: { root: D, scaleId: 'dorian' },
		position: { minFret: 0, maxFret: 20 }
	},
	{
		id: 'mixolydian-over-dominant',
		title: 'Mixolydian over Dominant',
		description: 'G Mixolydian, the classic dominant-chord scale.',
		activity: 'scales',
		context: { root: G, scaleId: 'mixolydian' }
	},
	{
		id: 'minor-pentatonic',
		title: 'Minor Pentatonic',
		description: 'A minor pentatonic, the first scale most bassists learn.',
		activity: 'scales',
		context: { root: A, scaleId: 'minor-pentatonic' }
	},
	{
		id: 'blues-scale',
		title: 'Blues Scale',
		description: 'E blues scale — minor pentatonic plus the blue note.',
		activity: 'scales',
		context: { root: E, scaleId: 'blues' }
	}
];

export function listPracticePresets(): readonly PracticePreset[] {
	return PRESET_LIST;
}

/** Configures every relevant store field from `preset`, then starts the session it describes. */
export function openPreset(preset: PracticePreset): void {
	practiceHistory.recordPresetPracticed(preset.id);

	fretfield.setRootPitchClass(preset.context.root);

	if (preset.position) {
		fretfield.setRegion({
			id: `region-${preset.position.minFret}-${preset.position.maxFret}`,
			minFret: preset.position.minFret,
			maxFret: preset.position.maxFret
		});
	}

	if (preset.hintLevel) {
		practice.setHintLevel(preset.hintLevel);
	}

	if (preset.activity === 'scales') {
		scalePractice.setRoot(preset.context.root);
		if (preset.context.scaleId) scalePractice.setScaleId(preset.context.scaleId);
		if (preset.position) scalePractice.setZone(preset.position.minFret, preset.position.maxFret);
		fretfield.setMode('scale-practice');
		return;
	}

	if (preset.context.chordId) fretfield.setChord(preset.context.chordId);
	if (preset.context.progressionTemplateId) {
		fretfield.setProgressionTemplate(preset.context.progressionTemplateId);
	}
	if (preset.context.pathPreset) fretfield.setPathPreset(preset.context.pathPreset);
	if (preset.position) practice.setLocalFieldOnly(true);

	// practice.start()'s buildContext() reads fretfield.selectedPath, which
	// only computes once fretfield.mode is 'paths' -- normally true already
	// because the user got here by using the Paths lens, but a preset can
	// jump straight to Follow Path with no such history, so the mode has to
	// be set explicitly before start(), not left to its own post-hoc sync.
	if (preset.activity === 'follow-path') fretfield.setMode('paths');

	practice.start(preset.activity, { interval: preset.targetInterval });
	navigation.setDestination('explore');
}
