<script lang="ts">
	import type { ChordPadDelayDivision } from '$lib/chord-pad-fx/types';
	import HardwareButton from '$lib/components/hardware/HardwareButton.svelte';
	import HardwarePanel from '$lib/components/hardware/HardwarePanel.svelte';
	import Knob from '$lib/components/hardware/Knob.svelte';
	import Led from '$lib/components/hardware/Led.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const DELAY_DIVISIONS: ChordPadDelayDivision[] = [
		'1/4',
		'1/8',
		'1/8D',
		'1/8T',
		'1/16',
		'1/16D',
		'1/16T'
	];

	const fx = $derived(scalePractice.groove.chordPadFx);
</script>

{#snippet knobField(
	label: string,
	value: number,
	onChange: (v: number) => void,
	min = 0,
	max = 100
)}
	<div class="field">
		<span class="ff-label field-label">{label}</span>
		<Knob {label} {value} {min} {max} {onChange} />
	</div>
{/snippet}

<div class="chord-pad-fx-controls panel-grid">
	<HardwarePanel title="REVERB" tone="carbon">
		{#snippet header()}
			<Led state={fx.reverb.enabled ? 'active' : 'off'} />
		{/snippet}
		<div class="row">
			<HardwareButton
				variant="secondary"
				pressed={fx.reverb.enabled}
				ariaLabel="Reverb"
				onclick={() => scalePractice.setChordPadReverbEnabled(!fx.reverb.enabled)}
			>
				Reverb {fx.reverb.enabled ? 'On' : 'Off'}
			</HardwareButton>
		</div>
		<div class="row">
			{@render knobField('Size', fx.reverb.size, (v) => scalePractice.setChordPadReverbSize(v))}
			{@render knobField('Damping', fx.reverb.damping, (v) =>
				scalePractice.setChordPadReverbDamping(v)
			)}
			{@render knobField('Mix', fx.reverb.mix, (v) => scalePractice.setChordPadReverbMix(v))}
		</div>
	</HardwarePanel>

	<HardwarePanel title="DELAY" tone="carbon">
		{#snippet header()}
			<Led state={fx.delay.enabled ? 'active' : 'off'} />
		{/snippet}
		<div class="row">
			<HardwareButton
				variant="secondary"
				pressed={fx.delay.enabled}
				ariaLabel="Delay"
				onclick={() => scalePractice.setChordPadDelayEnabled(!fx.delay.enabled)}
			>
				Delay {fx.delay.enabled ? 'On' : 'Off'}
			</HardwareButton>
			<label class="field">
				<span class="ff-label field-label">Division</span>
				<select
					aria-label="Delay Division"
					value={fx.delay.division}
					onchange={(event) =>
						scalePractice.setChordPadDelayDivision(
							(event.currentTarget as HTMLSelectElement).value as ChordPadDelayDivision
						)}
				>
					{#each DELAY_DIVISIONS as division (division)}
						<option value={division}>{division}</option>
					{/each}
				</select>
			</label>
		</div>
		<div class="row">
			{@render knobField('Feedback', fx.delay.feedback, (v) =>
				scalePractice.setChordPadDelayFeedback(v)
			)}
			{@render knobField('Mix', fx.delay.mix, (v) => scalePractice.setChordPadDelayMix(v))}
		</div>
	</HardwarePanel>

	<HardwarePanel title="CHORUS" tone="carbon">
		{#snippet header()}
			<Led state={fx.chorus.enabled ? 'active' : 'off'} />
		{/snippet}
		<div class="row">
			<HardwareButton
				variant="secondary"
				pressed={fx.chorus.enabled}
				ariaLabel="Chorus"
				onclick={() => scalePractice.setChordPadChorusEnabled(!fx.chorus.enabled)}
			>
				Chorus {fx.chorus.enabled ? 'On' : 'Off'}
			</HardwareButton>
		</div>
		<div class="row">
			{@render knobField(
				'Rate',
				fx.chorus.rate,
				(v) => scalePractice.setChordPadChorusRate(v),
				0.1,
				5
			)}
			{@render knobField('Depth', fx.chorus.depth, (v) => scalePractice.setChordPadChorusDepth(v))}
			{@render knobField('Mix', fx.chorus.mix, (v) => scalePractice.setChordPadChorusMix(v))}
		</div>
	</HardwarePanel>
</div>

<style>
	/* Same tighter spacing/auto-fit layout as AcidBassControls.svelte's own
	   .panel-grid -- three panels side by side wherever there's room. */
	.panel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0.5rem;
		align-items: start;
		--ff-panel-gap: 0.6rem;
		--ff-control-gap: 0.5rem;
	}

	.panel-grid > :global(.hardware-panel) {
		min-width: 0;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		min-width: 0;
	}

	.field-label {
		color: inherit;
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--ff-black, #151411);
		color: var(--ff-ivory, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	select:hover {
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}
</style>
