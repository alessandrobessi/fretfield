import { describe, expect, it } from 'vitest';

import { ACID_BASS_GLOSSARY, GENERATED_BASSLINE_GLOSSARY, type GlossarySection } from '../glossary';

/** Same four data-integrity checks for any `GlossarySection[]` -- reused for both glossaries below rather than duplicating each assertion body. */
function describeGlossaryIntegrity(name: string, glossary: GlossarySection[]): void {
	describe(name, () => {
		it('has at least one section, and every section has at least one entry', () => {
			expect(glossary.length).toBeGreaterThan(0);
			for (const section of glossary) {
				expect(section.entries.length).toBeGreaterThan(0);
			}
		});

		it('every section title is unique', () => {
			const titles = glossary.map((section) => section.title);
			expect(new Set(titles).size).toBe(titles.length);
		});

		it('every entry has a non-empty term and description', () => {
			for (const section of glossary) {
				for (const entry of section.entries) {
					expect(entry.term.trim().length).toBeGreaterThan(0);
					expect(entry.description.trim().length).toBeGreaterThan(0);
				}
			}
		});

		it('within a section, every term is unique', () => {
			for (const section of glossary) {
				const terms = section.entries.map((entry) => entry.term);
				expect(new Set(terms).size).toBe(terms.length);
			}
		});
	});
}

describeGlossaryIntegrity('ACID_BASS_GLOSSARY', ACID_BASS_GLOSSARY);
describeGlossaryIntegrity('GENERATED_BASSLINE_GLOSSARY', GENERATED_BASSLINE_GLOSSARY);
