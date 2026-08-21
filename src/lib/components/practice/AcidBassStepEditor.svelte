<script lang="ts">
	import type { AcidBassStep, AcidOctaveOffset } from '$lib/acid-bass/types';
	import { ALL_INTERVALS, intervalLabel, type IntervalId } from '$lib/music/intervals';

	interface Props {
		step: AcidBassStep | null;
		stepIndex: number | null;
		onSetActive: (active: boolean) => void;
		onSetInterval: (interval: IntervalId) => void;
		onSetOctave: (octave: AcidOctaveOffset) => void;
		onToggleAccent: () => void;
		onToggleSlide: () => void;
	}

	const {
		step,
		stepIndex,
		onSetActive,
		onSetInterval,
		onSetOctave,
		onToggleAccent,
		onToggleSlide
	}: Props = $props();

	const OCTAVES: AcidOctaveOffset[] = [-1, 0, 1];

	function octaveButtonLabel(octave: AcidOctaveOffset): string {
		if (octave === 1) return '+1';
		if (octave === -1) return '−1';
		return '0';
	}

	function handleIntervalChange(event: Event): void {
		onSetInterval((event.currentTarget as HTMLSelectElement).value as IntervalId);
	}
</script>

<div class="acid-bass-step-editor">
	{#if step === null || stepIndex === null}
		<p class="hint">Click a Bass step above to edit it.</p>
	{:else}
		<span class="field-label">Bass step {stepIndex + 1}</span>
		<label class="toggle-field">
			<input
				type="checkbox"
				aria-label="Active"
				checked={step.active}
				onchange={(event) => onSetActive((event.currentTarget as HTMLInputElement).checked)}
			/>
			Active
		</label>

		{#if step.active}
			<label class="field">
				<span class="field-label">Interval</span>
				<select aria-label="Interval" value={step.interval} onchange={handleIntervalChange}>
					{#each ALL_INTERVALS as interval (interval)}
						<option value={interval}>{intervalLabel(interval)}</option>
					{/each}
				</select>
			</label>

			<div class="octave-picker" role="group" aria-label="Octave">
				{#each OCTAVES as octave (octave)}
					<button
						type="button"
						class="octave-button"
						class:active={step.octave === octave}
						aria-pressed={step.octave === octave}
						onclick={() => onSetOctave(octave)}
					>
						{octaveButtonLabel(octave)}
					</button>
				{/each}
			</div>

			<label class="toggle-field">
				<input
					type="checkbox"
					aria-label="Accent"
					checked={step.accent}
					onchange={onToggleAccent}
				/>
				Accent
			</label>

			<label class="toggle-field">
				<input type="checkbox" aria-label="Slide" checked={step.slide} onchange={onToggleSlide} />
				Slide
			</label>
		{/if}
	{/if}
</div>

<style>
	.acid-bass-step-editor {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
		min-height: 2.5rem;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
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

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.35rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: pointer;
	}

	select:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.toggle-field {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.octave-picker {
		display: flex;
		gap: 0.3rem;
	}

	.octave-button {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		width: 2.2rem;
		padding: 0.3rem 0;
		border-radius: 6px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
	}

	.octave-button:hover {
		border-color: var(--nut, #7c3aed);
	}

	.octave-button.active {
		border-color: var(--nut, #7c3aed);
		background: var(--nut, #7c3aed);
		color: #fff;
	}

	.octave-button:focus-visible,
	input[type='checkbox']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
