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
		<span class="chip root-chip"><span class="field-label">Root:</span> {rootLabel}</span>
		<span class="chip chord-chip"><span class="field-label">Chord:</span> {chordLabel}</span>
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
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.status {
		display: flex;
		gap: 0.75rem;
		font-size: 1rem;
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
		gap: 1rem;
	}
</style>
