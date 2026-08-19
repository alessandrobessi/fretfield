import { describe, expect, it } from 'vitest';
import { computeStreak, localDateKey } from '../history-types';

describe('localDateKey', () => {
	it('formats a local calendar date as YYYY-MM-DD', () => {
		expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
		expect(localDateKey(new Date(2026, 10, 23))).toBe('2026-11-23');
	});
});

describe('computeStreak', () => {
	it('is zero with no history', () => {
		expect(computeStreak([], '2026-08-10')).toBe(0);
	});

	it('is zero when neither today nor yesterday was practiced', () => {
		expect(computeStreak(['2026-08-01'], '2026-08-10')).toBe(0);
	});

	it('counts a streak ending exactly today', () => {
		expect(computeStreak(['2026-08-08', '2026-08-09', '2026-08-10'], '2026-08-10')).toBe(3);
	});

	it('stays alive when the streak ends yesterday and today has not happened yet', () => {
		expect(computeStreak(['2026-08-08', '2026-08-09'], '2026-08-10')).toBe(2);
	});

	it('stops at a gap rather than counting through it', () => {
		expect(
			computeStreak(['2026-08-06', '2026-08-08', '2026-08-09', '2026-08-10'], '2026-08-10')
		).toBe(3);
	});

	it('ignores date order and duplicate entries', () => {
		expect(
			computeStreak(['2026-08-10', '2026-08-08', '2026-08-09', '2026-08-09'], '2026-08-10')
		).toBe(3);
	});
});
