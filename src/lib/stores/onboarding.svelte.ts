import { SvelteSet } from 'svelte/reactivity';

/**
 * Contextual first-run hints (Phase 11 of the 1.0 restructure) — deliberately
 * not a tutorial carousel. Each step is dismissed permanently, on its own,
 * once the interaction it's pointing at actually happens, and never
 * reappears after — teach through doing, not through a modal the user has
 * to click past before touching anything.
 */
export type OnboardingStep = 'explore-intro' | 'explore-guidance' | 'practice-intro';

const STORAGE_KEY = 'fretfield-onboarding-seen';

function loadSeen(): SvelteSet<OnboardingStep> {
	if (typeof localStorage === 'undefined') return new SvelteSet();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? new SvelteSet(JSON.parse(raw)) : new SvelteSet();
	} catch {
		return new SvelteSet();
	}
}

class OnboardingStore {
	private readonly seen = loadSeen();

	hasSeen(step: OnboardingStep): boolean {
		return this.seen.has(step);
	}

	markSeen(step: OnboardingStep): void {
		if (this.seen.has(step)) return;
		this.seen.add(step);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
		}
	}
}

export const onboarding = new OnboardingStore();
