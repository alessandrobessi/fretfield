<script lang="ts">
	import { listChords } from '$lib/music/chords';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	function handleChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		fretfield.setChord(event.currentTarget.value);
	}
</script>

<label class="chord-selector">
	<span class="field-label">Chord</span>
	<select value={fretfield.chordId} onchange={handleChange}>
		{#each listChords() as chord (chord.id)}
			<option value={chord.id}>{chord.label}</option>
		{/each}
	</select>
</label>

<style>
	.chord-selector {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	.field-label {
		font-weight: 700;
		color: var(--nut, #7c3aed);
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.5rem 0.6rem;
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
</style>
