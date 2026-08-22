import { expect, test } from '@playwright/test';

/**
 * Coverage for the hardware-component primitives added by the visual
 * rebrand (~/Downloads/FRETFIELD-REBRAND.md) that don't already have a home
 * in an existing feature's own e2e file: Knob's keyboard bounds, and the
 * playhead pulse's `prefers-reduced-motion` static equivalent (spec §10/§19
 * -- every animated state needs one). Knob's basic keyboard-adjustment path
 * is already covered in context in acid-bass.e2e.ts; this file only adds
 * what that coverage doesn't.
 */

test.describe('Rebrand: Knob keyboard bounds', () => {
	test('Home/End jump to min/max, and the value is exposed via aria-valuenow', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		const tone = page.getByRole('slider', { name: 'Cutoff' });
		await tone.focus();

		await tone.press('End');
		await expect(tone).toHaveAttribute('aria-valuenow', '100');

		await tone.press('Home');
		await expect(tone).toHaveAttribute('aria-valuenow', '0');

		await tone.press('ArrowRight');
		await expect(tone).toHaveAttribute('aria-valuenow', '1');

		await tone.press('ArrowLeft');
		await expect(tone).toHaveAttribute('aria-valuenow', '0');
	});
});

test.describe('Rebrand: reduced-motion playhead', () => {
	test('the current step still gets a distinct red state with motion disabled', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });
		await page.getByLabel('Metronome BPM').fill('240');
		await page.keyboard.press('Tab');

		await page.getByRole('button', { name: 'Editor', exact: true }).click();
		await page.getByRole('button', { name: 'Play' }).click();
		const current = page.locator('.step.current').first();
		await expect(current).toBeVisible({ timeout: 3000 });

		// The pulse keyframes themselves become a no-op under reduced-motion
		// (global rule in app.css), but .step.current's own border/box-shadow
		// color is a static property, not an animation -- it must still read
		// as "this one" without relying on the pulse at all.
		await expect(current).toHaveCSS('border-color', 'rgb(227, 72, 50)');

		await page.getByRole('button', { name: 'Stop' }).click();
	});
});
