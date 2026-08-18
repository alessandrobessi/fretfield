import type { FretRange } from '$lib/music/fret-range';

/**
 * Scale Practice's own zone state. A `FretRange` by shape, but deliberately
 * never shares `fretfield.svelte.ts`'s `activeRegion` state — a running
 * practice session should never fight with whatever Local Field region is
 * set elsewhere.
 */
export type PracticeZone = FretRange;
