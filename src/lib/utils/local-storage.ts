/**
 * Small shared read/write pair for the localStorage pattern this codebase
 * already used once, inline, in `onboarding.svelte.ts` (guarded
 * `typeof localStorage`, `JSON.parse`/`setItem` wrapped in try/catch,
 * falling back silently rather than throwing) — extracted now that Local
 * Practice Persistence needs the same shape in four more places.
 */

export function readJSON<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw !== null ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

export function writeJSON<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage can fail (quota, private browsing, disabled) — losing the
		// persistence layer isn't worth surfacing as an error to the player.
	}
}
