import { coerceGroove } from '$lib/groove/migrate';
import type { Groove } from '$lib/groove/types';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-saved-grooves';

/** Custom grooves built in GrooveEditor.svelte, alongside the curated genre presets -- `coerceGroove` migrates anything saved under the pre-Groove-Engine single-pattern shape. */
export const savedGrooves = createSavedCollectionStore<Groove>(STORAGE_KEY, coerceGroove);
