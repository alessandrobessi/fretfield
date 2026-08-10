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
		<div class="fret-row markers" aria-hidden="true">
			<span class="row-spacer"></span>
			{#each frets as fret (fret)}
				<span class="fret-cell-slot">
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
		<div class="fret-row numbers" aria-hidden="true">
			<span class="row-spacer"></span>
			{#each frets as fret (fret)}
				<span
					class="fret-cell-slot"
					class:marker-fret={SINGLE_MARKER_FRETS.has(fret) || DOUBLE_MARKER_FRETS.has(fret)}
				>
					{fret}
				</span>
			{/each}
		</div>
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
		background: var(--fretboard-bg, #ede8fb);
		padding: 0.5rem 0;
		border-radius: 10px;
	}

	.fret-row {
		display: flex;
	}

	.fret-row.numbers {
		padding-top: 0.35rem;
	}

	.row-spacer {
		width: 2rem;
		flex: 0 0 auto;
	}

	.fret-cell-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		width: 3.25rem;
		flex: 0 0 auto;
		height: 1rem;
		font-size: 0.75rem;
		color: var(--fret-number, #7c6aa8);
	}

	.fret-cell-slot.marker-fret {
		font-weight: 700;
		color: var(--nut, #7c3aed);
	}

	.marker-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--fret-marker, #b6a8e6);
	}
</style>
