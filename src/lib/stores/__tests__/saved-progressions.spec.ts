import { describe, expect, it } from 'vitest';
import type { ProgressionTemplate } from '../../music/progressions';
import type { SavedItem } from '../saved-collection.svelte';
import { resolveProgressionTemplate } from '../saved-progressions.svelte';

const CUSTOM: SavedItem<ProgressionTemplate> = {
	id: 'custom-1',
	name: 'My Progression',
	createdAt: '2026-01-01T00:00:00.000Z',
	data: {
		id: 'unused-inner-id',
		label: 'My Progression',
		mode: 'major',
		degrees: [
			{ fromTonic: '1', chordId: 'major' },
			{ fromTonic: 'b7', chordId: 'dominant-7' }
		]
	}
};

describe('resolveProgressionTemplate', () => {
	it('resolves a curated template id', () => {
		const resolved = resolveProgressionTemplate('major-ii-v-i', []);
		expect(resolved).not.toBeNull();
		expect(resolved?.id).toBe('major-ii-v-i');
	});

	it('resolves a custom (saved) template by the SavedItem wrapper id, not the inner ProgressionTemplate.id', () => {
		const resolved = resolveProgressionTemplate('custom-1', [CUSTOM]);
		expect(resolved).toEqual(CUSTOM.data);
	});

	it('prefers a custom match over a same-named curated one, if both exist', () => {
		const resolved = resolveProgressionTemplate('major-ii-v-i', [
			{ ...CUSTOM, id: 'major-ii-v-i' }
		]);
		expect(resolved).toEqual(CUSTOM.data);
	});

	it('returns null for an unknown id instead of throwing', () => {
		expect(() => resolveProgressionTemplate('not-a-real-id', [])).not.toThrow();
		expect(resolveProgressionTemplate('not-a-real-id', [])).toBeNull();
	});
});
