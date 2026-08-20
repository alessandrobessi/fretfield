import type { PracticePreset } from '$lib/practice/preset-library';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-saved-presets';

/** User-saved "current setup" snapshots, alongside the 15 curated presets in preset-library.ts — see captureCurrentPreset(). */
export const savedPresets =
	createSavedCollectionStore<Omit<PracticePreset, 'id' | 'title' | 'description'>>(STORAGE_KEY);
