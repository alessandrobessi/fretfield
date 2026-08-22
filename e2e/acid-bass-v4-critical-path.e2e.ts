import { expect, test } from '@playwright/test';

/**
 * Acid Bass Intelligence V4 M22's own required critical-path coverage: one
 * test walking the whole generated-bassline workflow end to end -- select
 * root, select progression, enable Bass, switch to Generated, choose a
 * style, request a new variation, play, and inspect a generated note.
 *
 * M22's own spec text also lists "enter Shadow or Learn This Line" as a
 * critical-path step -- by explicit user decision, M19 (GrooveTransport
 * one-shot playback), M20 (Learn This Line + Live Input), and M21 (Shadow
 * Mode) were skipped this pass (M18's pure `$lib/bass-training/` domain
 * exists, but nothing wires it into the UI or audio yet), so there is no
 * Shadow/Learn This Line entry point to exercise here. This test covers
 * every other step of the critical path against what's actually built.
 */

test('critical path: root -> progression -> enable Bass -> Generated -> choose style -> New Variation -> play -> inspect a generated note', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();

	// Select root and progression.
	await page.getByLabel('Scale Practice root').selectOption({ label: 'C' });
	await page.getByLabel('Progression').selectOption({ label: '12-Bar Dominant Blues' });
	await expect(page.getByText('C7 · Mixolydian')).toBeVisible();

	// A fast, count-in-free transport so playback below settles quickly.
	await page.getByLabel('Count-in').selectOption({ label: 'Off' });
	await page.getByLabel('Metronome BPM').fill('240');
	await page.keyboard.press('Tab');

	// Enable Bass.
	await page.getByRole('button', { name: 'Bass', exact: true }).click();
	const bassToggle = page.getByRole('button', { name: /^Bass (On|Off)$/ });
	if ((await bassToggle.textContent())?.includes('Off')) {
		await bassToggle.click();
	}
	await expect(bassToggle).toHaveText('Bass On');

	// Switch to Generated mode.
	await page.getByRole('button', { name: 'Edit Groove' }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
	await page.getByRole('button', { name: 'Generated', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Generated', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Recommended styles should already be showing for a dominant-heavy
	// progression (M13) -- confirms the harmonic context is really flowing
	// through, not just that the picker renders.
	await expect(page.getByText('Recommended:')).toBeVisible();

	// Choose a style.
	const styleGroup = page.getByRole('group', { name: 'Style', exact: true });
	await styleGroup.getByRole('button', { name: 'Walking', exact: true }).click();
	await expect(styleGroup.getByRole('button', { name: 'Walking', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Request a new variation and confirm the generated line actually changes.
	const stepGrid = page.getByRole('group', { name: /^Bar 1 steps$/ });
	const beforeVariation = await stepGrid.innerText();
	await page.getByRole('button', { name: 'New Variation' }).click();
	await expect(stepGrid).toBeVisible();
	const afterVariation = await stepGrid.innerText();
	expect(afterVariation).not.toBe(beforeVariation);

	// Play.
	await page.getByRole('button', { name: 'Play' }).click();
	const bassPanel = page.getByRole('region', { name: 'Acid Bass', exact: true });
	await expect(bassPanel.getByText('Playing', { exact: true })).toBeVisible({ timeout: 3000 });
	await page.waitForTimeout(1000);
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	// Inspect a generated note -- step 1 (the downbeat) is always active
	// (rhythm.ts's own anchor rule).
	await page
		.getByRole('group', { name: /^Bar 1 steps$/ })
		.getByRole('button', { name: /^Step 1,/ })
		.click();
	await expect(page.getByText('Note', { exact: true })).toBeVisible();
	await expect(page.getByText('Interval', { exact: true })).toBeVisible();
	await expect(page.getByText('Function', { exact: true })).toBeVisible();
	await expect(page.getByText('Position', { exact: true })).toBeVisible();
	await expect(page.getByText(/String \d+ · Fret \d+/)).toBeVisible();
});
