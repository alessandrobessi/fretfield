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
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--nut, #e3ac18);
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.5rem 0.6rem;
		background: var(--surface, #262521);
		color: var(--fg, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	select:hover {
		border-color: var(--nut, #e3ac18);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}
</style>
