<script lang="ts">
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import { getScaleDefinition } from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const configuredBlocks = $derived(
		fretfield.chordBlocks
			.map((block, index) => ({ block, index }))
			.filter(
				({ block }) => block.root !== null && block.chordId !== null && block.scaleId !== null
			)
	);
</script>

{#if configuredBlocks.length > 0}
	<ul class="scale-block-legend" aria-label="Scale block legend">
		{#each configuredBlocks as { block, index } (block.id)}
			<li>
				<span class="chip" data-block={index} aria-hidden="true">{index + 1}</span>
				{defaultNoteName(block.root!)}{getChordDefinition(block.chordId!).symbol}
				<span class="sep">·</span>
				{getScaleDefinition(block.scaleId!).label}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.scale-block-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.85rem;
	}

	.scale-block-legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
		color: var(--fret-fg, #241a3d);
	}

	.sep {
		opacity: 0.5;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		font-size: 0.65rem;
		font-weight: 700;
		color: #fff;
	}

	.chip[data-block='0'] {
		background: var(--scale-block-1, #3b82f6);
	}

	.chip[data-block='1'] {
		background: var(--scale-block-2, #f43f5e);
	}

	.chip[data-block='2'] {
		background: var(--scale-block-3, #eab308);
	}

	.chip[data-block='3'] {
		background: var(--scale-block-4, #8b5cf6);
	}
</style>
