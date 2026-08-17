<script lang="ts">
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import {
		getScaleDefinition,
		scaleContainsPitchClass,
		scalePitchClasses
	} from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const configuredBlocks = $derived(
		fretfield.chordBlocks
			.map((block, index) => ({ block, index }))
			.filter(
				({ block }) => block.root !== null && block.chordId !== null && block.scaleId !== null
			)
	);

	// Ordered by the first block's own scale degrees (not chromatically) so
	// e.g. a shared root reads first — every pitch class here is by
	// definition already in every other configured block's scale too.
	const commonNoteNames = $derived.by<string[]>(() => {
		if (configuredBlocks.length < 2) return [];
		const [first, ...rest] = configuredBlocks;
		const firstPitchClasses = scalePitchClasses(
			first.block.root!,
			getScaleDefinition(first.block.scaleId!)
		);
		return firstPitchClasses
			.filter((pitchClass) =>
				rest.every(({ block }) =>
					scaleContainsPitchClass(block.root!, getScaleDefinition(block.scaleId!), pitchClass)
				)
			)
			.map(defaultNoteName);
	});
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
{#if configuredBlocks.length >= 2}
	<p class="scale-block-common-notes">
		{#if commonNoteNames.length > 0}
			<span class="common-swatch" aria-hidden="true"></span>
			Common to every block: <strong>{commonNoteNames.join(', ')}</strong>
		{:else}
			No note is in every block's scale.
		{/if}
	</p>
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

	.chip[data-block='4'] {
		background: var(--scale-block-5, #14b8a6);
	}

	.chip[data-block='5'] {
		background: var(--scale-block-6, #84cc16);
	}

	.chip[data-block='6'] {
		background: var(--scale-block-7, #d946ef);
	}

	.chip[data-block='7'] {
		background: var(--scale-block-8, #0ea5e9);
	}

	.scale-block-common-notes {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--fret-fg, #241a3d);
	}

	.common-swatch {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		background: var(--scale-block-common, #10b981);
	}
</style>
