<script lang="ts">
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { listScales } from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);

	function handleRootChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setExploreScaleRoot(value === '' ? null : (Number(value) as PitchClass));
	}

	function handleScaleChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setExploreScaleId(value === '' ? null : value);
	}
</script>

<div class="scale-explorer">
	<div class="controls">
		<label class="field">
			<span class="field-label">Root</span>
			<select
				aria-label="Scale root"
				value={fretfield.exploreScaleRoot ?? ''}
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
				aria-label="Scale"
				value={fretfield.exploreScaleId ?? ''}
				onchange={handleScaleChange}
			>
				<option value="">—</option>
				{#each listScales() as scale (scale.id)}
					<option value={scale.id}>{scale.label}</option>
				{/each}
			</select>
		</label>
	</div>
	{#if fretfield.exploreScaleRoot === null || fretfield.exploreScaleId === null}
		<p class="empty">Choose a root and a scale to see it highlighted on the neck.</p>
	{/if}
</div>

<style>
	.scale-explorer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
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
		padding: 0.4rem 0.5rem;
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

	.empty {
		margin: 0;
		opacity: 0.6;
		font-size: 0.9rem;
	}
</style>
