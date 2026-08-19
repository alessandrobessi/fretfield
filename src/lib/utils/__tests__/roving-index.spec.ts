import { describe, expect, it } from 'vitest';
import { nextRovingIndex } from '../roving-index';

describe('nextRovingIndex', () => {
	it('moves forward on ArrowRight/ArrowDown', () => {
		expect(nextRovingIndex('ArrowRight', 0, 3)).toBe(1);
		expect(nextRovingIndex('ArrowDown', 0, 3)).toBe(1);
	});

	it('moves backward on ArrowLeft/ArrowUp', () => {
		expect(nextRovingIndex('ArrowLeft', 1, 3)).toBe(0);
		expect(nextRovingIndex('ArrowUp', 1, 3)).toBe(0);
	});

	it('wraps forward past the last index', () => {
		expect(nextRovingIndex('ArrowRight', 2, 3)).toBe(0);
	});

	it('wraps backward past the first index', () => {
		expect(nextRovingIndex('ArrowLeft', 0, 3)).toBe(2);
	});

	it('jumps to the first index on Home', () => {
		expect(nextRovingIndex('Home', 2, 3)).toBe(0);
	});

	it('jumps to the last index on End', () => {
		expect(nextRovingIndex('End', 0, 3)).toBe(2);
	});

	it('returns null for keys the group does not handle', () => {
		expect(nextRovingIndex('Enter', 0, 3)).toBeNull();
		expect(nextRovingIndex('a', 0, 3)).toBeNull();
	});

	it('handles a single-item group without throwing', () => {
		expect(nextRovingIndex('ArrowRight', 0, 1)).toBe(0);
		expect(nextRovingIndex('ArrowLeft', 0, 1)).toBe(0);
	});
});
