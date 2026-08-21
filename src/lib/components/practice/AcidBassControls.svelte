<script lang="ts">
	import type { AcidWave } from '$lib/acid-bass/types';
	import Knob from '$lib/components/hardware/Knob.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const WAVES: { id: AcidWave; label: string }[] = [
		{ id: 'saw', label: 'Saw' },
		{ id: 'square', label: 'Square' }
	];
</script>

<div class="acid-bass-controls">
	<div class="wave-picker" role="group" aria-label="Wave">
		{#each WAVES as wave (wave.id)}
			<button
				type="button"
				class="wave-button"
				class:active={scalePractice.groove.acidBass.patch.oscillator.mainWave === wave.id}
				aria-pressed={scalePractice.groove.acidBass.patch.oscillator.mainWave === wave.id}
				onclick={() => scalePractice.setAcidBassWave(wave.id)}
			>
				{wave.label}
			</button>
		{/each}
	</div>

	<div class="field">
		<span class="ff-label field-label">Cutoff</span>
		<Knob
			label="Cutoff"
			value={scalePractice.groove.acidBass.patch.filter.cutoff}
			onChange={(value) => scalePractice.setAcidBassCutoff(value)}
		/>
	</div>

	<div class="field">
		<span class="ff-label field-label">Resonance</span>
		<Knob
			label="Resonance"
			value={scalePractice.groove.acidBass.patch.filter.resonance}
			onChange={(value) => scalePractice.setAcidBassResonance(value)}
		/>
	</div>

	<div class="field">
		<span class="ff-label field-label">Env Mod</span>
		<Knob
			label="Env Mod"
			min={-100}
			max={100}
			value={scalePractice.groove.acidBass.patch.filter.envAmount}
			onChange={(value) => scalePractice.setAcidBassEnvAmount(value)}
		/>
	</div>

	<div class="field">
		<span class="ff-label field-label">Decay</span>
		<Knob
			label="Decay"
			value={scalePractice.groove.acidBass.patch.envelope.decay}
			onChange={(value) => scalePractice.setAcidBassDecay(value)}
		/>
	</div>

	<div class="field">
		<span class="ff-label field-label">Drive</span>
		<Knob
			label="Drive"
			value={scalePractice.groove.acidBass.patch.output.drive}
			onChange={(value) => scalePractice.setAcidBassDrive(value)}
		/>
	</div>
</div>

<style>
	.acid-bass-controls {
		display: flex;
		align-items: flex-end;
		gap: 1.1rem;
		flex-wrap: wrap;
	}

	.wave-picker {
		display: flex;
		border: 1px solid var(--ff-black, #151411);
		border-radius: var(--ff-radius-control, 4px);
		overflow: hidden;
		background: var(--ff-black, #151411);
		align-self: center;
	}

	.wave-button {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.4rem 0.8rem;
		background: transparent;
		color: var(--ff-yellow, #e3ac18);
		border: none;
		cursor: pointer;
	}

	.wave-button.active {
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
	}

	.wave-button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: -3px;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
	}

	.field-label {
		color: inherit;
	}
</style>
