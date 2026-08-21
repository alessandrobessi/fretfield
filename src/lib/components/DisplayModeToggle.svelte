<script lang="ts">
	import { fretfield, type DisplayMode } from '$lib/stores/fretfield.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	const MODES: { id: DisplayMode; label: string }[] = [
		{ id: 'intervals', label: 'Intervals' },
		{ id: 'notes', label: 'Notes' },
		{ id: 'both', label: 'Both' }
	];

	const activeIndex = $derived(MODES.findIndex((mode) => mode.id === fretfield.displayMode));

	// Roving tabindex (AGENTS.md §17/roadmap Phase 20): Tab reaches this group
	// in one stop; Left/Right move focus AND select, matching the same
	// immediate-switch behavior a click already has.
	function handleKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activeIndex, MODES.length);
		if (next === null) return;
		event.preventDefault();
		fretfield.setDisplayMode(MODES[next].id);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}
</script>

<div
	class="display-mode-toggle"
	role="radiogroup"
	aria-label="Display mode"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	{#each MODES as mode, index (mode.id)}
		<button
			type="button"
			role="radio"
			aria-checked={fretfield.displayMode === mode.id}
			class:active={fretfield.displayMode === mode.id}
			tabindex={index === activeIndex ? 0 : -1}
			onclick={() => fretfield.setDisplayMode(mode.id)}
		>
			{mode.label}
		</button>
	{/each}
</div>

<style>
	.display-mode-toggle {
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
