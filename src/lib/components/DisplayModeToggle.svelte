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
