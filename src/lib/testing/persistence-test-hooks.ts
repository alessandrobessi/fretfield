import { browser } from '$app/environment';
import { DEFAULT_LIFETIME_STATS, type PracticeLifetimeStats } from '$lib/practice/history-types';
import { MODE_STORAGE_KEY } from '$lib/stores/fretfield.svelte';
import { STORAGE_KEY as DESTINATION_KEY } from '$lib/stores/navigation.svelte';
import { STORAGE_KEY as PRACTICE_SESSION_KEY } from '$lib/stores/practice.svelte';
import {
	practiceHistory,
	STORAGE_KEY as PRACTICE_HISTORY_KEY
} from '$lib/stores/practice-history.svelte';
import { STORAGE_KEY as SCALE_PRACTICE_KEY } from '$lib/stores/scale-practice.svelte';
import { writeJSON } from '$lib/utils/local-storage';

const ALL_KEYS = [
	PRACTICE_SESSION_KEY,
	SCALE_PRACTICE_KEY,
	DESTINATION_KEY,
	PRACTICE_HISTORY_KEY,
	MODE_STORAGE_KEY
];

/**
 * The same injectable-seam idea as `live-input-test-hooks.ts`/
 * `practice-test-hooks.ts`, for Local Practice Persistence: `clearAll` gives
 * each e2e test a clean slate without relying on Playwright's own storage
 * isolation (useful when a test wants to assert "first-time user" behavior
 * mid-run); `seedHistory` writes streak/stats state directly, since waiting
 * out real calendar days isn't a real testing option.
 */
export interface PersistenceTestHooks {
	clearAll(): void;
	seedHistory(partial: Partial<PracticeLifetimeStats>): void;
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
		},
		seedHistory(partial) {
			const stats: PracticeLifetimeStats = { ...DEFAULT_LIFETIME_STATS, ...partial };
			writeJSON(PRACTICE_HISTORY_KEY, stats);
			practiceHistory.stats = stats;
		}
	};
}
