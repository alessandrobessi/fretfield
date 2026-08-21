<script lang="ts">
	import { fretfield, type AnalysisMode } from '$lib/stores/fretfield.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	const MODES: { id: AnalysisMode; label: string }[] = [
		{ id: 'chord-tones', label: 'Chord Tones' },
		{ id: 'field', label: 'Harmonic Field' }
	];

	const activeIndex = $derived(MODES.findIndex((mode) => mode.id === fretfield.analysisMode));

	function handleKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activeIndex, MODES.length);
		if (next === null) return;
		event.preventDefault();
		fretfield.setAnalysisMode(MODES[next].id);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}
</script>

<div
	class="analysis-mode-toggle"
	role="radiogroup"
	aria-label="Analysis mode"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	{#each MODES as mode, index (mode.id)}
		<button
			type="button"
			role="radio"
			aria-checked={fretfield.analysisMode === mode.id}
			class:active={fretfield.analysisMode === mode.id}
			tabindex={index === activeIndex ? 0 : -1}
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
		background: var(--nut, #7c3aed);
		color: #fff;
	}

	button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: -3px;
	}
</style>
