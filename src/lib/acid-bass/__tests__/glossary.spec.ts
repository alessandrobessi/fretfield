import { describe, expect, it } from 'vitest';

import { ACID_BASS_GLOSSARY } from '../glossary';

describe('ACID_BASS_GLOSSARY', () => {
	it('has at least one section, and every section has at least one entry', () => {
		expect(ACID_BASS_GLOSSARY.length).toBeGreaterThan(0);
		for (const section of ACID_BASS_GLOSSARY) {
			expect(section.entries.length).toBeGreaterThan(0);
		}
	});

	it('every section title is unique', () => {
		const titles = ACID_BASS_GLOSSARY.map((section) => section.title);
		expect(new Set(titles).size).toBe(titles.length);
	});

	it('every entry has a non-empty term and description', () => {
		for (const section of ACID_BASS_GLOSSARY) {
			for (const entry of section.entries) {
				expect(entry.term.trim().length).toBeGreaterThan(0);
				expect(entry.description.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it('within a section, every term is unique', () => {
		for (const section of ACID_BASS_GLOSSARY) {
			const terms = section.entries.map((entry) => entry.term);
			expect(new Set(terms).size).toBe(terms.length);
		}
	});
});
