/**
 * A bounded, contiguous span of frets — the one shared shape for every
 * feature that needs a fret-scoped "position" concept. Previously
 * duplicated as `FretboardRegion`'s `{minFret, maxFret}` fields and
 * `scale-practice/types.ts`'s `PracticeZone`; both now build on this
 * instead of redefining the same two fields (see the 1.0 restructure plan,
 * Phase 6). Sharing the *type* doesn't imply sharing *state* — Scale
 * Practice's zone deliberately stays independent of
 * `fretfield.activeRegion` (see stores/scale-practice.svelte.ts) so a
 * running practice session never fights with whatever Local Field region
 * is set elsewhere.
 */
export interface FretRange {
	minFret: number;
	maxFret: number;
}
