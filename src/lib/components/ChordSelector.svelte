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
		font-weight: 600;
	}

	select {
		font: inherit;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #1c1c1c);
		color: var(--fret-fg, #ddd);
		border: 1px solid var(--fret-border, #3a3a3a);
		border-radius: 4px;
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #4da3ff);
		outline-offset: 1px;
	}
</style>
