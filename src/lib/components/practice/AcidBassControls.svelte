<script lang="ts">
	import type { AcidWave } from '$lib/acid-bass/types';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	function handleToneChange(event: Event): void {
		scalePractice.setAcidBassTone(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleResonanceChange(event: Event): void {
		scalePractice.setAcidBassResonance(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleMotionChange(event: Event): void {
		scalePractice.setAcidBassMotion(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleDecayChange(event: Event): void {
		scalePractice.setAcidBassDecay(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleDriveChange(event: Event): void {
		scalePractice.setAcidBassDrive(Number((event.currentTarget as HTMLInputElement).value));
	}

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
				class:active={scalePractice.groove.acidBass.patch.wave === wave.id}
				aria-pressed={scalePractice.groove.acidBass.patch.wave === wave.id}
				onclick={() => scalePractice.setAcidBassWave(wave.id)}
			>
				{wave.label}
			</button>
		{/each}
	</div>

	<label class="field">
		<span class="field-label">Tone</span>
		<span class="slider-control">
			<input
				type="range"
				aria-label="Tone"
				min="0"
				max="100"
				value={scalePractice.groove.acidBass.patch.tone}
				onchange={handleToneChange}
			/>
			<span class="slider-readout">{scalePractice.groove.acidBass.patch.tone}%</span>
		</span>
	</label>

	<label class="field">
		<span class="field-label">Resonance</span>
		<span class="slider-control">
			<input
				type="range"
				aria-label="Resonance"
				min="0"
				max="100"
				value={scalePractice.groove.acidBass.patch.resonance}
				onchange={handleResonanceChange}
			/>
			<span class="slider-readout">{scalePractice.groove.acidBass.patch.resonance}%</span>
		</span>
	</label>

	<label class="field">
		<span class="field-label">Motion</span>
		<span class="slider-control">
			<input
				type="range"
				aria-label="Motion"
				min="0"
				max="100"
				value={scalePractice.groove.acidBass.patch.motion}
				onchange={handleMotionChange}
			/>
			<span class="slider-readout">{scalePractice.groove.acidBass.patch.motion}%</span>
		</span>
	</label>

	<label class="field">
		<span class="field-label">Decay</span>
		<span class="slider-control">
			<input
				type="range"
				aria-label="Decay"
				min="0"
				max="100"
				value={scalePractice.groove.acidBass.patch.decay}
				onchange={handleDecayChange}
			/>
			<span class="slider-readout">{scalePractice.groove.acidBass.patch.decay}%</span>
		</span>
	</label>

	<label class="field">
		<span class="field-label">Drive</span>
		<span class="slider-control">
			<input
				type="range"
				aria-label="Drive"
				min="0"
				max="100"
				value={scalePractice.groove.acidBass.patch.drive}
				onchange={handleDriveChange}
			/>
			<span class="slider-readout">{scalePractice.groove.acidBass.patch.drive}%</span>
		</span>
	</label>
</div>

<style>
	.acid-bass-controls {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.wave-picker {
		display: flex;
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 999px;
		overflow: hidden;
		background: var(--fret-bg, #fff);
	}

	.wave-button {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.4rem 0.8rem;
		background: transparent;
		color: var(--fret-fg, #241a3d);
		border: none;
		cursor: pointer;
	}

	.wave-button.active {
		background: var(--nut, #7c3aed);
		color: #fff;
	}

	.wave-button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: -3px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	.slider-control {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.slider-readout {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		min-width: 2.5em;
	}

	input[type='range']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}
</style>
