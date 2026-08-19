<script lang="ts">
	import ScaleBlockControls from '$lib/components/ScaleBlockControls.svelte';
	import ScaleBlockLegend from '$lib/components/ScaleBlockLegend.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
</script>

<div class="custom-scale-map">
	<button type="button" class="back" onclick={() => fretfield.setMode('progression-scales')}>
		← Back to suggested scales
	</button>
	<ScaleBlockControls />
	<ScaleBlockLegend />
</div>

<style>
	.custom-scale-map {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.back {
		align-self: flex-start;
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.back:hover {
		border-color: var(--nut, #7c3aed);
	}

	.back:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
