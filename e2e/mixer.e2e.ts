import { expect, test, type Page } from '@playwright/test';

/**
 * The Mixer (Drums/Chords/Bass channel faders, user-requested, 2026-08) --
 * its own Band panel tab, between Bass and Editor. Originally built as an
 * always-visible strip above every tab (corrected to a dedicated tab per
 * direct user feedback), then as plain `<input type="range">` sliders
 * (corrected again -- "can the sliders be more aligned to the style of the
 * app?" -- to the same rotary `Knob` component every other volume/level
 * control in the app already uses, e.g. Acid Bass's OUTPUT > Volume). No
 * real-audio assertions here, matching this app's existing testing boundary
 * (see `drum-machine.e2e.ts`'s own header comment) -- only UI/state and that
 * live playback survives fader moves.
 */

async function openScalePractice(page: Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
}

async function openMixerTab(page: Page): Promise<void> {
	await openScalePractice(page);
	await page.getByRole('button', { name: 'Mixer', exact: true }).click();
}

/** Sets a 0-100/step-1 Knob to an exact value via keyboard -- Home to floor it at 0, then PageUp (step 10) and ArrowUp (step 1) to reach the target, the same keyboard contract `rebrand.e2e.ts`'s own Knob coverage already exercises. */
async function setKnobValue(page: Page, label: string, value: number): Promise<void> {
	const knob = page.getByRole('slider', { name: label, exact: true });
	await knob.focus();
	await knob.press('Home');
	for (let i = 0; i < Math.floor(value / 10); i++) await knob.press('PageUp');
	for (let i = 0; i < value % 10; i++) await knob.press('ArrowUp');
	await expect(knob).toHaveAttribute('aria-valuenow', String(value));
}

test.describe('Mixer', () => {
	test('lives on its own tab -- not visible on Drums/Harmony/Bass/Editor, only on Mixer', async ({
		page
	}) => {
		await openScalePractice(page);

		for (const tab of ['Drums', 'Harmony', 'Bass', 'Editor']) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			await expect(page.getByRole('slider', { name: 'Drums volume' })).not.toBeVisible();
			await expect(page.getByRole('slider', { name: 'Chords volume' })).not.toBeVisible();
			await expect(page.getByRole('slider', { name: 'Bass volume' })).not.toBeVisible();
		}

		await page.getByRole('button', { name: 'Mixer', exact: true }).click();
		await expect(page.getByRole('slider', { name: 'Drums volume' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Chords volume' })).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Bass volume' })).toBeVisible();
	});

	test('Drums/Chords default to full (100%) on a fresh session; Bass keeps its own existing default', async ({
		page
	}) => {
		await openMixerTab(page);

		await expect(page.getByRole('slider', { name: 'Drums volume' })).toHaveAttribute(
			'aria-valuenow',
			'100'
		);
		await expect(page.getByRole('slider', { name: 'Chords volume' })).toHaveAttribute(
			'aria-valuenow',
			'100'
		);
		// Bass has no dedicated Mixer field of its own -- it reads
		// groove.acidBass.patch.output.volume, whose own default (70, set in
		// acid-bass/pattern.ts) predates the Mixer and is unrelated to it.
		await expect(page.getByRole('slider', { name: 'Bass volume' })).toHaveAttribute(
			'aria-valuenow',
			'70'
		);
	});

	test("the Bass fader is the same control as Acid Bass's own OUTPUT > Volume knob", async ({
		page
	}) => {
		await openMixerTab(page);

		await setKnobValue(page, 'Bass volume', 55);

		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await expect(page.getByRole('slider', { name: 'Volume', exact: true })).toHaveAttribute(
			'aria-valuenow',
			'55'
		);
	});

	test('Drums/Chords/Bass volumes all persist across a reload', async ({ page }) => {
		await openMixerTab(page);

		await setKnobValue(page, 'Drums volume', 20);
		await setKnobValue(page, 'Chords volume', 35);
		await setKnobValue(page, 'Bass volume', 80);

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Mixer', exact: true }).click();

		await expect(page.getByRole('slider', { name: 'Drums volume' })).toHaveAttribute(
			'aria-valuenow',
			'20'
		);
		await expect(page.getByRole('slider', { name: 'Chords volume' })).toHaveAttribute(
			'aria-valuenow',
			'35'
		);
		await expect(page.getByRole('slider', { name: 'Bass volume' })).toHaveAttribute(
			'aria-valuenow',
			'80'
		);
	});

	test('moving every fader during real playback does not stop the transport', async ({ page }) => {
		await openMixerTab(page);

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		await setKnobValue(page, 'Drums volume', 10);
		await setKnobValue(page, 'Chords volume', 60);
		await setKnobValue(page, 'Bass volume', 40);

		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});
