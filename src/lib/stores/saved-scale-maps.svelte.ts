import type { ChordBlock } from '$lib/stores/fretfield.svelte';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-saved-scale-maps';

/** Named, reusable Custom Scale Map configurations — see ScaleBlockControls.svelte's "Save as…"/"My Scale Maps" UI and fretfield.loadChordBlocks(). */
export const savedScaleMaps = createSavedCollectionStore<ChordBlock[]>(STORAGE_KEY);
