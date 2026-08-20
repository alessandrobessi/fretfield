import { readJSON, writeJSON } from '$lib/utils/local-storage';

/** A named, user-created entry in a saved-material library — Scale Maps, Favorite Chords, Progressions, and Presets all share this shape. */
export interface SavedItem<T> {
	id: string;
	name: string;
	createdAt: string;
	data: T;
}

/**
 * Four features this session need identical local-only CRUD (create/rename/
 * delete, no in-place content edits — see the Saved Material Library plan's
 * non-goals) over a named list of user-created items. Rather than four
 * near-identical class+`$state`+`persist()` stores, this factory returns one
 * store instance per call, following the exact shape every store in the
 * Local Practice Persistence work already used (`readJSON`/`writeJSON`,
 * synchronous persist on every mutation, no `$effect`).
 *
 * `migrateData`, when given, runs over every persisted item's `data` on
 * load — lets a store whose saved shape has since evolved (e.g. saved
 * grooves moving to the Groove Engine's multi-pattern model) keep reading
 * items a user saved under the old shape, instead of them silently
 * vanishing.
 */
export function createSavedCollectionStore<T>(
	storageKey: string,
	migrateData?: (raw: unknown) => T
) {
	function loadItems(): SavedItem<T>[] {
		const stored = readJSON<SavedItem<unknown>[]>(storageKey, []);
		if (!migrateData) return stored as SavedItem<T>[];
		return stored.map((item) => ({ ...item, data: migrateData(item.data) }));
	}

	class SavedCollectionStore {
		items = $state<SavedItem<T>[]>(loadItems());

		save(name: string, data: T): SavedItem<T> {
			// A plain, immediately-stringified timestamp, never a mutable Date
			// held in $state (same as practice-history.svelte.ts's own
			// `new Date()` usage) — the lint rule's reactivity detection
			// appears not to see through this factory's generic class.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const createdAt = new Date().toISOString();
			const item: SavedItem<T> = {
				id: crypto.randomUUID(),
				name,
				createdAt,
				data
			};
			this.items = [...this.items, item];
			this.persist();
			return item;
		}

		rename(id: string, name: string): void {
			this.items = this.items.map((item) => (item.id === id ? { ...item, name } : item));
			this.persist();
		}

		remove(id: string): void {
			this.items = this.items.filter((item) => item.id !== id);
			this.persist();
		}

		private persist(): void {
			writeJSON(storageKey, this.items);
		}
	}

	return new SavedCollectionStore();
}
