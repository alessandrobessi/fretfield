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
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		overflow: hidden;
		background: var(--surface, #262521);
	}

	button {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.5rem 0.9rem;
		background: transparent;
		color: var(--fg, #f1e6c5);
		border: none;
		cursor: pointer;
	}

	button.active {
		background: var(--ff-yellow, #e3ac18);
		color: var(--ff-black, #151411);
	}

	button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: -3px;
	}
</style>
