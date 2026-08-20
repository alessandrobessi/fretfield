import { getProgressionTemplate, type ProgressionTemplate } from '$lib/music/progressions';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-saved-progressions';

/** User-built chord-quality sequences, alongside the 5 curated templates in progressions.ts. */
export const savedProgressions = createSavedCollectionStore<ProgressionTemplate>(STORAGE_KEY);

/**
 * Merges the custom list with the curated one — `getProgressionTemplate`
 * itself stays untouched (progressions.spec.ts already asserts it throws on
 * an unknown id), so this is the one place that needs to treat "unresolvable"
 * as a normal, non-throwing outcome: `fretfield.svelte.ts`'s
 * `resolvedProgression` is a `$derived.by` that every Progression-mode
 * render depends on, so a thrown error here would break the whole page.
 */
export function resolveProgressionTemplate(
	id: string,
	custom: readonly ProgressionTemplate[]
): ProgressionTemplate | null {
	const customMatch = custom.find((template) => template.id === id);
	if (customMatch) return customMatch;
	try {
		return getProgressionTemplate(id);
	} catch {
		return null;
	}
}
