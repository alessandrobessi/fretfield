<script lang="ts">
	import { fretfield, type AnalysisMode } from '$lib/stores/fretfield.svelte';

	const MODES: { id: AnalysisMode; label: string }[] = [
		{ id: 'chord-tones', label: 'Chord Tones' },
		{ id: 'field', label: 'Harmonic Field' }
	];
</script>

<div class="analysis-mode-toggle" role="radiogroup" aria-label="Analysis mode">
	{#each MODES as mode (mode.id)}
		<button
			type="button"
			role="radio"
			aria-checked={fretfield.analysisMode === mode.id}
			class:active={fretfield.analysisMode === mode.id}
			onclick={() => fretfield.setAnalysisMode(mode.id)}
		>
			{mode.label}
		</button>
	{/each}
</div>

<style>
	.analysis-mode-toggle {
		display: inline-flex;
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 999px;
		overflow: hidden;
		background: var(--fret-bg, #fff);
	}

	button {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.5rem 0.9rem;
		background: transparent;
		color: var(--fret-fg, #241a3d);
		border: none;
		cursor: pointer;
	}

	button.active {
		background: linear-gradient(135deg, var(--hero-from, #7c3aed), var(--hero-to, #ec4899));
		color: #fff;
	}

	button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: -3px;
	}
</style>
