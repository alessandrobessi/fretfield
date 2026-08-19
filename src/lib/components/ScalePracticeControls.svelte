<script lang="ts">
	import PositionRangeInputs from '$lib/components/shared/PositionRangeInputs.svelte';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import type { FretRange } from '$lib/music/fret-range';
	import { listScales } from '$lib/music/scales';
	import { DEFAULT_FRET_COUNT } from '$lib/music/tuning';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);

	// This component only mounts while the Scale Practice tab is active (see
	// +page.svelte), so a plain effect-cleanup is enough to stop the
	// metronome click the moment the user switches to another tab.
	$effect(() => {
		return () => scalePractice.stop();
	});

	// Distinguishes "pick a root/scale" from "your zone doesn't reach any note
	// of this scale" — both leave `scalePositions` empty, but they need
	// different guidance.
	const zoneExcludesScale = $derived(
		scalePractice.root !== null &&
			scalePractice.scaleId !== null &&
			scalePractice.scalePositions.length === 0
	);

	function handleRootChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setRoot(value === '' ? null : (Number(value) as PitchClass));
	}

	function handleScaleChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setScaleId(value === '' ? null : value);
	}

	function handleZoneChange(range: FretRange): void {
		scalePractice.setZone(range.minFret, range.maxFret);
	}

	function handleBpmChange(event: Event): void {
		scalePractice.setBpm(Number((event.currentTarget as HTMLInputElement).value));
	}

	function toggleMetronome(): void {
		if (scalePractice.running) {
			scalePractice.stop();
		} else {
			scalePractice.start();
		}
	}
</script>

<div class="scale-practice-controls">
	<div class="top-row">
		<span class="field-label">Scale Practice</span>
	</div>

	<div class="fields">
		<label class="field">
			<span class="field-label">Root</span>
			<select
				aria-label="Scale Practice root"
				value={scalePractice.root ?? ''}
				onchange={handleRootChange}
			>
				<option value="">—</option>
				{#each ALL_ROOTS as pitchClass (pitchClass)}
					<option value={pitchClass}>{defaultNoteName(pitchClass)}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span class="field-label">Scale</span>
			<select
				aria-label="Scale Practice scale"
				value={scalePractice.scaleId ?? ''}
				onchange={handleScaleChange}
			>
				<option value="">—</option>
				{#each listScales() as scale (scale.id)}
					<option value={scale.id}>{scale.label}</option>
				{/each}
			</select>
		</label>
		<PositionRangeInputs
			range={scalePractice.zone}
			fretCount={DEFAULT_FRET_COUNT}
			label="Zone"
			onChange={handleZoneChange}
		/>
	</div>

	{#if zoneExcludesScale}
		<p class="hint">No notes of this scale fall inside the chosen zone — widen it.</p>
	{:else if !liveInput.enabled}
		<p class="hint">Enable Live Input above to see the notes you play highlighted.</p>
	{/if}

	<div class="metronome">
		<span class="field-label">Metronome</span>
		<label class="field">
			<span class="field-label">Tempo</span>
			<input
				type="number"
				aria-label="Metronome BPM"
				min="30"
				max="240"
				value={scalePractice.bpm}
				onchange={handleBpmChange}
			/>
		</label>
		<button
			type="button"
			class="toggle"
			class:active={scalePractice.running}
			onclick={toggleMetronome}
		>
			{scalePractice.running ? 'Stop Metronome' : 'Start Metronome'}
		</button>
		{#if scalePractice.running}
			<span class="beat-readout">♩ = {scalePractice.bpm}</span>
		{/if}
	</div>
</div>

<style>
	.scale-practice-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	.fields {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	select,
	input[type='number'] {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: pointer;
	}

	input[type='number'] {
		width: 4.5rem;
		cursor: text;
	}

	select:hover,
	input[type='number']:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible,
	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
	}

	/*
	 * Visually separated from the root/scale/zone fields above — those drive
	 * what's highlighted on the fretboard and take effect immediately; this
	 * is the only thing Start/Stop touches (product request: make it
	 * unambiguous that the button is just a metronome toggle).
	 */
	.metronome {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.toggle {
		font: inherit;
		font-weight: 700;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--practice-target-accent, #10b981);
		background: transparent;
		color: var(--practice-target-accent, #10b981);
		cursor: pointer;
	}

	.toggle.active {
		background: var(--practice-target-accent, #10b981);
		color: #fff;
	}

	.toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.beat-readout {
		font-size: 0.85rem;
		font-weight: 600;
		opacity: 0.85;
	}
</style>
