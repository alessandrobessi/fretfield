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
		border-bottom: 1px solid var(--surface-border, #3a382f);
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
		border-radius: var(--ff-radius-control, 4px);
		font-weight: 700;
	}

	/* Root -- yellow (selected/structural), raw token as text against a dark
	   chip background (darkening it further, the old white-bg-era approach,
	   would move contrast the wrong way here -- see the fretboard's own
	   NoteInspector fix). */
	.root-chip {
		background: color-mix(in srgb, var(--role-root, #e3ac18) 16%, var(--surface, #262521));
		color: var(--role-root, #e3ac18);
	}

	/* Chord -- ivory (neutral information, not a structural/live emphasis;
	   per the rebrand's own semantic model, §21). */
	.chord-chip {
		background: var(--surface, #262521);
		color: var(--fg, #f1e6c5);
	}

	.field-label {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		opacity: 0.75;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 1rem;
	}
</style>
