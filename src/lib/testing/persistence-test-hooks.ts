import { browser } from '$app/environment';
import { STORAGE_KEY as DESTINATION_KEY } from '$lib/stores/navigation.svelte';
import { STORAGE_KEY as SAVED_GROOVES_KEY } from '$lib/stores/saved-grooves.svelte';
import { STORAGE_KEY as SCALE_PRACTICE_KEY } from '$lib/stores/scale-practice.svelte';

const ALL_KEYS = [SCALE_PRACTICE_KEY, DESTINATION_KEY, SAVED_GROOVES_KEY];

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`, for Local
 * Practice Persistence: `clearAll` gives each e2e test a clean slate without
 * relying on Playwright's own storage isolation (useful when a test wants to
 * assert "first-time user" behavior mid-run).
 */
export interface PersistenceTestHooks {
	clearAll(): void;
}

declare global {
	interface Window {
		__fretfieldPersistenceTestHooks__?: PersistenceTestHooks;
	}
}

export function installPersistenceTestHooks(): void {
	if (!browser) return;

	window.__fretfieldPersistenceTestHooks__ = {
		clearAll() {
			for (const key of ALL_KEYS) localStorage.removeItem(key);
		}
	};
}
