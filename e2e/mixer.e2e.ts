import { expect, test } from '@playwright/test';

/**
 * The Mixer strip (Drums/Chords/Bass channel faders, user-requested,
 * 2026-08) -- an always-visible row in the Band panel, above the Drums/
 * Harmony/Bass/Editor tabs. No real-audio assertions here, matching this
 * app's existing testing boundary (see `drum-machine.e2e.ts`'s own header
 * comment) -- only UI/state and that live playback survives fader moves.
 */

async function openScalePractice(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
}

test.describe('Mixer', () => {
	test('all three faders are visible regardless of which Band tab is active', async ({ page }) => {
		await openScalePractice(page);

		for (const tab of ['Drums', 'Harmony', 'Bass', 'Editor']) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			await expect(page.getByLabel('Drums volume')).toBeVisible();
			await expect(page.getByLabel('Chords volume')).toBeVisible();
			await expect(page.getByLabel('Bass volume')).toBeVisible();
		}
	});

	test('Drums/Chords default to full (100%) on a fresh session; Bass keeps its own existing default', async ({
		page
	}) => {
		await openScalePractice(page);

		await expect(page.getByLabel('Drums volume')).toHaveValue('100');
		await expect(page.getByLabel('Chords volume')).toHaveValue('100');
		// Bass has no dedicated Mixer field of its own -- it reads
		// groove.acidBass.patch.output.volume, whose own default (70, set in
		// acid-bass/pattern.ts) predates the Mixer and is unrelated to it.
		await expect(page.getByLabel('Bass volume')).toHaveValue('70');
	});

	test("the Bass fader is the same control as Acid Bass's own OUTPUT > Volume knob", async ({
		page
	}) => {
		await openScalePractice(page);

		await page.getByLabel('Bass volume').fill('55');
		await page.keyboard.press('Tab');

		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveAttribute(
			'aria-valuenow',
			'55'
		);
	});

	test('Drums/Chords/Bass volumes all persist across a reload', async ({ page }) => {
		await openScalePractice(page);

		await page.getByLabel('Drums volume').fill('20');
		await page.keyboard.press('Tab');
		await page.getByLabel('Chords volume').fill('35');
		await page.keyboard.press('Tab');
		await page.getByLabel('Bass volume').fill('80');
		await page.keyboard.press('Tab');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByLabel('Drums volume')).toHaveValue('20');
		await expect(page.getByLabel('Chords volume')).toHaveValue('35');
		await expect(page.getByLabel('Bass volume')).toHaveValue('80');
	});

	test('moving every fader during real playback does not stop the transport', async ({ page }) => {
		await openScalePractice(page);

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		await page.getByLabel('Drums volume').fill('10');
		await page.keyboard.press('Tab');
		await page.getByLabel('Chords volume').fill('60');
		await page.keyboard.press('Tab');
		await page.getByLabel('Bass volume').fill('40');
		await page.keyboard.press('Tab');

		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});
