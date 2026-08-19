/**
 * Lifetime practice history — deliberately lightweight (roadmap's "local
 * persistence" item, scoped down to streaks/counters, not a full per-
 * exercise session log): a handful of running totals, a deduped set of
 * calendar days practiced (for streak math), and which presets have been
 * opened at least once. `totalExercisesCompleted` counts attempts whose
 * result was 'exact'/'strong-alternative' directly, the same lightweight
 * approximation rather than deduping by exercise id across reloads (that
 * would mean storing an ever-growing id set for a marginal accuracy gain).
 */
export interface PracticeLifetimeStats {
	totalAttempts: number;
	totalCorrect: number;
	totalStrongAlternatives: number;
	totalExercisesCompleted: number;
	presetsPracticed: string[];
	practicedDates: string[];
	lastPracticedAt: string | null;
}

export const DEFAULT_LIFETIME_STATS: PracticeLifetimeStats = {
	totalAttempts: 0,
	totalCorrect: 0,
	totalStrongAlternatives: 0,
	totalExercisesCompleted: 0,
	presetsPracticed: [],
	practicedDates: [],
	lastPracticedAt: null
};

/** Local calendar date (not `toISOString()`, which is UTC and would misattribute a late-night session to the wrong day for the player). */
export function localDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function previousDateKey(key: string): string {
	const [year, month, day] = key.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() - 1);
	return localDateKey(date);
}

/**
 * Consecutive calendar days ending today or yesterday — "still alive" if
 * today hasn't been practiced yet, the same forgiving convention most habit
 * trackers use rather than zeroing out the moment midnight passes.
 */
export function computeStreak(practicedDates: readonly string[], today: string): number {
	const dates = new Set(practicedDates);
	let cursor = dates.has(today) ? today : previousDateKey(today);
	if (!dates.has(cursor)) return 0;

	let streak = 0;
	while (dates.has(cursor)) {
		streak += 1;
		cursor = previousDateKey(cursor);
	}
	return streak;
}
