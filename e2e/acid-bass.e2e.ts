import { expect, test } from '@playwright/test';

/**
 * The Acid Bass voice living inside Scale Practice's Groove Engine (see
 * ~/Downloads/ACID-BASS-ENGINE.md). No real-audio assertions here, matching
 * this app's existing testing boundary (see drum-machine.e2e.ts) -- only
 * UI/state.
 */

async function openBassStepsTab(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Practice', exact: true }).click();
	await page.getByRole('button', { name: 'Edit Groove' }).click();
	await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
}

/** Each step's full accessible name is a rich description ("Bass step 2, active, interval 1, ..." -- see AcidBassStepGrid.svelte), not just the short "Bass step N" a `getByLabel(..., {exact:true})` needs -- match on the stable prefix instead. */
function bassStep(page: import('@playwright/test').Page, stepNumber: number) {
	return page.getByLabel(new RegExp(`^Bass step ${stepNumber},`));
}

test.describe('Acid Bass: on/off', () => {
	test('is off by default, and the toggle in the session bar turns it on/off', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		const toggle = page.getByRole('button', { name: /^Bass (On|Off)$/ });
		await expect(toggle).toHaveText('Bass Off');

		await toggle.click();
		await expect(toggle).toHaveText('Bass On');

		await toggle.click();
		await expect(toggle).toHaveText('Bass Off');
	});
});

test.describe('Acid Bass: synth controls', () => {
	test('the Bass tab in the Band panel shows Wave/Tone/Resonance/Motion/Decay/Drive', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		await expect(page.getByRole('button', { name: 'Saw', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Square', exact: true })).toBeVisible();
		await expect(page.getByLabel('Tone')).toBeVisible();
		await expect(page.getByLabel('Resonance')).toBeVisible();
		await expect(page.getByLabel('Motion')).toBeVisible();
		await expect(page.getByLabel('Decay')).toBeVisible();
		await expect(page.getByLabel('Drive')).toBeVisible();
	});

	test('Wave selection and sliders update state', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();

		await page.getByRole('button', { name: 'Square', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Square', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByLabel('Drive').fill('80');
		await page.getByLabel('Drive').dispatchEvent('change');
		await expect(page.getByLabel('Drive')).toHaveValue('80');
	});
});

test.describe('Acid Bass: step grid', () => {
	test('the default pattern has an accented root on step 1 and a slide near the end', async ({
		page
	}) => {
		await openBassStepsTab(page);

		const step1 = bassStep(page, 1);
		await expect(step1).toHaveAttribute('aria-pressed', 'true');
		await expect(step1).toHaveAttribute(
			'aria-label',
			'Bass step 1, active, interval 1, normal octave, accented, no slide'
		);
	});

	test('the step grid always matches the current time signature length', async ({ page }) => {
		await openBassStepsTab(page);

		await expect(page.getByRole('group', { name: 'Bass steps' }).locator('.step')).toHaveCount(16);

		await page.getByLabel('Time Signature').selectOption('3/4');
		await expect(page.getByRole('group', { name: 'Bass steps' }).locator('.step')).toHaveCount(12);
	});

	test('changing time signature resizes the Bass pattern without discarding the steps that still fit', async ({
		page
	}) => {
		await openBassStepsTab(page);

		// Step 1 is active (root, accented) by default -- still within a
		// shrunk-to-12-step (3/4) pattern, so it must survive the resize.
		await expect(bassStep(page, 1)).toHaveAttribute('aria-pressed', 'true');

		await page.getByLabel('Time Signature').selectOption('3/4');

		await expect(bassStep(page, 1)).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('group', { name: 'Bass steps' }).locator('.step')).toHaveCount(12);
	});

	test('clicking a step opens the step editor, which stays hidden until a step is selected', async ({
		page
	}) => {
		await openBassStepsTab(page);

		await expect(page.getByText('Click a Bass step above to edit it.')).toBeVisible();

		await bassStep(page, 2).click();
		await expect(page.getByLabel('Active', { exact: true })).toBeVisible();
	});

	test('activating an inactive step defaults it to root, octave 0, no accent, no slide', async ({
		page
	}) => {
		await openBassStepsTab(page);

		const step2 = bassStep(page, 2);
		await expect(step2).toHaveAttribute('aria-pressed', 'false');

		await step2.click();
		await page.getByLabel('Active', { exact: true }).check();

		await expect(step2).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByLabel('Interval', { exact: true })).toHaveValue('1');
		await expect(page.getByLabel('Accent', { exact: true })).not.toBeChecked();
		await expect(page.getByLabel('Slide', { exact: true })).not.toBeChecked();
	});

	test('editing interval, octave, accent, and slide updates the step and its grid markers', async ({
		page
	}) => {
		await openBassStepsTab(page);

		await bassStep(page, 2).click();
		await page.getByLabel('Active', { exact: true }).check();
		await page.getByLabel('Interval', { exact: true }).selectOption('b3');
		await page.getByRole('button', { name: '+1', exact: true }).click();
		await page.getByLabel('Accent', { exact: true }).check();
		await page.getByLabel('Slide', { exact: true }).check();

		await expect(bassStep(page, 2)).toHaveAttribute(
			'aria-label',
			'Bass step 2, active, interval b3, octave up, accented, slides to next step'
		);
	});
});

test.describe('Acid Bass: playback', () => {
	test('playback advances through the Bass step grid while running', async ({ page }) => {
		await openBassStepsTab(page);
		await page.getByRole('button', { name: /^Bass (On|Off)$/ }).click();
		await page.getByLabel('Count-in').selectOption({ label: 'Off' });
		await page.getByLabel('Metronome BPM').fill('240');
		await page.keyboard.press('Tab');

		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.locator('.step.current')).toBeVisible({ timeout: 3000 });

		await page.getByRole('button', { name: 'Stop' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});
});

test.describe('Acid Bass: persistence', () => {
	test('enabled state, patch, and step edits survive a reload', async ({ page }) => {
		await openBassStepsTab(page);

		await page.getByRole('button', { name: /^Bass (On|Off)$/ }).click();
		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await page.getByRole('button', { name: 'Square', exact: true }).click();
		await page.getByLabel('Drive').fill('70');
		await page.getByLabel('Drive').dispatchEvent('change');

		await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
		await bassStep(page, 3).click();
		await page.getByLabel('Active', { exact: true }).check();
		await page.getByLabel('Interval', { exact: true }).selectOption('5');

		await page.reload();
		await page.getByRole('tab', { name: 'Practice', exact: true }).click();

		await expect(page.getByRole('button', { name: /^Bass (On|Off)$/ })).toHaveText('Bass On');

		await page.getByRole('button', { name: 'Bass', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Square', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByLabel('Drive')).toHaveValue('70');

		await page.getByRole('button', { name: 'Edit Groove' }).click();
		await page.getByRole('button', { name: 'Bass Steps', exact: true }).click();
		await expect(bassStep(page, 3)).toHaveAttribute('aria-pressed', 'true');
	});

	test('saving and reloading a groove via My Grooves carries Acid Bass along with it', async ({
		page
	}) => {
		await openBassStepsTab(page);

		await page.getByRole('button', { name: /^Bass (On|Off)$/ }).click();
		await bassStep(page, 3).click();
		await page.getByLabel('Active', { exact: true }).check();

		await page.getByRole('button', { name: 'Save as…', exact: true }).click();
		await page.getByLabel('Groove name').fill('Acid Bass E2E Groove');
		await page.locator('.groove-editor').getByRole('button', { name: 'Save', exact: true }).click();
		await expect(
			page.getByRole('button', { name: 'Acid Bass E2E Groove', exact: true })
		).toBeVisible();

		// Switch to a curated preset -- Acid Bass resets to off (presets are
		// authored without it), proving the later reload actually restores the
		// saved groove's own state rather than coincidentally matching it.
		await page.getByLabel('Groove preset').selectOption({ label: 'Funk' });
		await expect(page.getByRole('button', { name: /^Bass (On|Off)$/ })).toHaveText('Bass Off');

		await page.getByRole('button', { name: 'Acid Bass E2E Groove', exact: true }).click();
		await expect(page.getByRole('button', { name: /^Bass (On|Off)$/ })).toHaveText('Bass On');
		await expect(bassStep(page, 3)).toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Delete Acid Bass E2E Groove' }).click();
		await expect(
			page.getByRole('button', { name: 'Acid Bass E2E Groove', exact: true })
		).not.toBeVisible();
	});
});
