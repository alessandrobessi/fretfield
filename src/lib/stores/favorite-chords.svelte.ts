import { getChordDefinition } from '$lib/music/chords';
import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
import { createSavedCollectionStore } from '$lib/stores/saved-collection.svelte';

export const STORAGE_KEY = 'fretfield-favorite-chords';

export interface FavoriteChord {
	root: PitchClass;
	chordId: string;
}

/** A toggle, not an open-ended save — auto-named from root+chord, never user-renamed (see the Saved Material Library plan's non-goals). */
export const favoriteChords = createSavedCollectionStore<FavoriteChord>(STORAGE_KEY);

export function favoriteChordName(root: PitchClass, chordId: string): string {
	return `${defaultNoteName(root)} ${getChordDefinition(chordId).label}`;
}

export function findFavoriteChord(root: PitchClass, chordId: string) {
	return favoriteChords.items.find(
		(item) => item.data.root === root && item.data.chordId === chordId
	);
}

export function toggleFavoriteChord(root: PitchClass, chordId: string): void {
	const existing = findFavoriteChord(root, chordId);
	if (existing) {
		favoriteChords.remove(existing.id);
	} else {
		favoriteChords.save(favoriteChordName(root, chordId), { root, chordId });
	}
}
