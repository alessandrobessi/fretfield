<script lang="ts">
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import ChordSelector from './ChordSelector.svelte';
	import DisplayModeToggle from './DisplayModeToggle.svelte';

	const rootLabel = $derived(fretfield.root === null ? '—' : defaultNoteName(fretfield.root));
	const chordLabel = $derived(getChordDefinition(fretfield.chordId).label);
</script>

<div class="harmony-controls">
	<div class="status" aria-live="polite">
		<span><span class="field-label">Root:</span> {rootLabel}</span>
		<span><span class="field-label">Chord:</span> {chordLabel}</span>
	</div>
	<div class="controls">
		<ChordSelector />
		<DisplayModeToggle />
	</div>
</div>

<style>
	.harmony-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.status {
		display: flex;
		gap: 1.5rem;
		font-size: 1rem;
	}

	.field-label {
		font-weight: 600;
		margin-right: 0.25rem;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
	}
</style>
