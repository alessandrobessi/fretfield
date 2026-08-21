<script lang="ts">
	import AnalysisModeToggle from '$lib/components/AnalysisModeToggle.svelte';
	import ChordSelector from '$lib/components/ChordSelector.svelte';
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const rootLabel = $derived(fretfield.root === null ? '—' : defaultNoteName(fretfield.root));
	const chordLabel = $derived(getChordDefinition(fretfield.chordId).label);
</script>

<div class="chord-explorer">
	<div class="status" aria-live="polite">
		<span class="chip root-chip"><span class="field-label">Root:</span> {rootLabel}</span>
		<span class="chip chord-chip"><span class="field-label">Chord:</span> {chordLabel}</span>
	</div>
	<div class="controls">
		<ChordSelector />
		<AnalysisModeToggle />
	</div>
</div>

<style>
	.chord-explorer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px dashed var(--fret-border, #ddd3f7);
	}

	.status {
		display: flex;
		gap: 0.6rem;
		font-size: 0.95rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		font-weight: 700;
	}

	.root-chip {
		background: color-mix(in srgb, var(--role-root, #f59e0b) 16%, transparent);
		color: color-mix(in srgb, var(--role-root, #f59e0b) 70%, black);
	}

	.chord-chip {
		background: color-mix(in srgb, var(--hero-from, #7c3aed) 14%, transparent);
		color: var(--hero-from, #7c3aed);
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		opacity: 0.75;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 1rem;
	}
</style>
