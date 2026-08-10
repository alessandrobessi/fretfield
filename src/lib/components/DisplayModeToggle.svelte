<script lang="ts">
	import { fretfield, type DisplayMode } from '$lib/stores/fretfield.svelte';

	const MODES: { id: DisplayMode; label: string }[] = [
		{ id: 'intervals', label: 'Intervals' },
		{ id: 'notes', label: 'Notes' },
		{ id: 'both', label: 'Both' }
	];
</script>

<div class="display-mode-toggle" role="radiogroup" aria-label="Display mode">
	{#each MODES as mode (mode.id)}
		<button
			type="button"
			role="radio"
			aria-checked={fretfield.displayMode === mode.id}
			class:active={fretfield.displayMode === mode.id}
			onclick={() => fretfield.setDisplayMode(mode.id)}
		>
			{mode.label}
		</button>
	{/each}
</div>

<style>
	.display-mode-toggle {
		display: inline-flex;
		border: 1px solid var(--fret-border, #3a3a3a);
		border-radius: 4px;
		overflow: hidden;
	}

	button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.75rem;
		background: var(--fret-bg, #1c1c1c);
		color: var(--fret-fg, #ddd);
		border: none;
		border-right: 1px solid var(--fret-border, #3a3a3a);
		cursor: pointer;
	}

	button:last-child {
		border-right: none;
	}

	button.active {
		background: var(--focus-ring, #4da3ff);
		color: #06121f;
		font-weight: 600;
	}

	button:focus-visible {
		outline: 3px solid var(--focus-ring, #4da3ff);
		outline-offset: -3px;
	}
</style>
