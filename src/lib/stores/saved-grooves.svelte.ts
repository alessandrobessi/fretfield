import type { GroovePattern } from '$lib/audio/groove';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-saved-grooves';

/** Custom drum patterns built in DrumMachineControls.svelte, alongside the 5 curated genre presets. */
export const savedGrooves = createSavedCollectionStore<GroovePattern>(STORAGE_KEY);
