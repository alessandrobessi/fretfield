<script lang="ts">
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import BassString from './BassString.svelte';

	const STRING_NAMES = ['E', 'A', 'D', 'G'];
	const SINGLE_MARKER_FRETS = new Set([3, 5, 7, 9, 15, 17, 19]);
	const DOUBLE_MARKER_FRETS = new Set([12]);

	const frets = $derived(Array.from({ length: fretfield.fretCount + 1 }, (_, fret) => fret));
	// Render high string (G) at the top, matching conventional tab/fretboard diagrams.
	const stringIndexesTopToBottom = $derived(
		Array.from({ length: fretfield.tuning.length }, (_, i) => fretfield.tuning.length - 1 - i)
	);
</script>

<div class="fretboard-scroll">
	<div class="fretboard" role="group" aria-label="Bass fretboard, E A D G tuning">
		<div class="fret-markers" aria-hidden="true">
			<span class="marker-spacer"></span>
			{#each frets as fret (fret)}
				<span class="fret-marker-cell">
					{#if SINGLE_MARKER_FRETS.has(fret)}
						<span class="marker-dot"></span>
					{:else if DOUBLE_MARKER_FRETS.has(fret)}
						<span class="marker-dot"></span><span class="marker-dot"></span>
					{/if}
				</span>
			{/each}
		</div>
		{#each stringIndexesTopToBottom as stringIndex (stringIndex)}
			<BassString
				stringName={STRING_NAMES[stringIndex]}
				positions={fretfield.positionsByString[stringIndex]}
				displayMode={fretfield.displayMode}
				onSelect={(position) => fretfield.selectRoot(position)}
			/>
		{/each}
	</div>
</div>

<style>
	.fretboard-scroll {
		overflow-x: auto;
		max-width: 100%;
	}

	.fretboard {
		display: inline-flex;
		flex-direction: column;
		background: var(--fretboard-bg, #12100e);
		padding: 0.5rem 0;
		border-radius: 6px;
	}

	.fret-markers {
		display: flex;
	}

	.marker-spacer {
		width: 2rem;
		flex: 0 0 auto;
	}

	.fret-marker-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		width: 2.75rem;
		flex: 0 0 auto;
		height: 1rem;
	}

	.marker-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--fret-marker, #555);
	}
</style>
