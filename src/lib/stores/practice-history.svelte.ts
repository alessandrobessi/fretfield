import {
	computeStreak,
	DEFAULT_LIFETIME_STATS,
	localDateKey,
	type PracticeLifetimeStats
} from '$lib/practice/history-types';
import type { PracticeResult } from '$lib/practice/types';
import { readJSON, writeJSON } from '$lib/utils/local-storage';

const STORAGE_KEY = 'fretfield-practice-history';

/**
 * Lifetime counters/streak, independent of any one Guided Practice session
 * (`practice.svelte.ts`'s `session` resets every time a new mode/preset
 * starts — this store never does). Fed by `practice.svelte.ts`'s
 * `handleDetectedNote()` and `preset-library.ts`'s `openPreset()`.
 */
class PracticeHistoryStore {
	stats = $state<PracticeLifetimeStats>(readJSON(STORAGE_KEY, DEFAULT_LIFETIME_STATS));

	readonly currentStreak = $derived.by<number>(() =>
		computeStreak(this.stats.practicedDates, localDateKey(new Date()))
	);

	/** Ignores `'ignored'` results, matching the existing convention in FretCell.svelte/GuidedPracticeControls.svelte. */
	recordAttempt(result: PracticeResult): void {
		if (result === 'ignored') return;

		const now = new Date();
		const today = localDateKey(now);
		const practicedDates = this.stats.practicedDates.includes(today)
			? this.stats.practicedDates
			: [...this.stats.practicedDates, today];

		this.stats = {
			...this.stats,
			totalAttempts: this.stats.totalAttempts + 1,
			totalCorrect: this.stats.totalCorrect + (result === 'exact' ? 1 : 0),
			totalStrongAlternatives:
				this.stats.totalStrongAlternatives + (result === 'strong-alternative' ? 1 : 0),
			totalExercisesCompleted:
				this.stats.totalExercisesCompleted +
				(result === 'exact' || result === 'strong-alternative' ? 1 : 0),
			practicedDates,
			lastPracticedAt: now.toISOString()
		};
		this.persist();
	}

	recordPresetPracticed(presetId: string): void {
		if (this.stats.presetsPracticed.includes(presetId)) return;
		this.stats = {
			...this.stats,
			presetsPracticed: [...this.stats.presetsPracticed, presetId]
		};
		this.persist();
	}

	private persist(): void {
		writeJSON(STORAGE_KEY, this.stats);
	}
}

export const practiceHistory = new PracticeHistoryStore();
