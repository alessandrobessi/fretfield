<script lang="ts">
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const activeIndex = $derived(
		fretfield.rankedRegions.findIndex((r) => r.region.id === fretfield.activeRegion?.id)
	);
	const activeAnalysis = $derived(activeIndex >= 0 ? fretfield.rankedRegions[activeIndex] : null);
	const rank = $derived(activeIndex >= 0 ? activeIndex + 1 : null);
</script>

<div class="local-field-controls">
	<div class="heading">
		<h2>Local Fields</h2>
		<p>Where on the neck should I play it?</p>
	</div>

	{#if fretfield.root === null}
		<p class="empty">Choose a root to see useful regions of the neck.</p>
	{:else}
		<div class="nav">
			<button type="button" onclick={() => fretfield.previousRegion()}>◂ Previous</button>
			<div class="summary">
				{#if activeAnalysis}
					<span class="range"
						>Frets {activeAnalysis.region.minFret}–{activeAnalysis.region.maxFret}</span
					>
					{#if rank}<span class="rank">#{rank} of {fretfield.rankedRegions.length}</span>{/if}
				{:else}
					<span class="range">No region selected</span>
				{/if}
			</div>
			<button type="button" onclick={() => fretfield.nextRegion()}>Next ▸</button>
			<button
				type="button"
				class="anchor"
				onclick={() => fretfield.anchorRegionToSelectedRoot()}
				disabled={fretfield.selectedRootPosition === null}
			>
				Anchor to root
			</button>
			<button type="button" class="clear" onclick={() => fretfield.clearRegion()}> Clear </button>
		</div>

		{#if activeAnalysis}
			<dl class="coverage">
				<div>
					<dt>Root</dt>
					<dd>{Math.round(activeAnalysis.rootCoverage * 100)}%</dd>
				</div>
				<div>
					<dt>Structural</dt>
					<dd>{Math.round(activeAnalysis.structuralCoverage * 100)}%</dd>
				</div>
			</dl>
		{/if}
	{/if}
</div>

<style>
	.local-field-controls {
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.heading {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.heading h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.heading p {
		margin: 0;
		opacity: 0.65;
		font-size: 0.9rem;
	}

	.empty {
		margin: 0;
		opacity: 0.6;
		font-size: 0.9rem;
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.nav button {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.45rem 0.8rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 999px;
		cursor: pointer;
	}

	.nav button:hover {
		border-color: var(--nut, #7c3aed);
	}

	.nav button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.nav button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.nav button.clear {
		color: var(--role-avoid, #78716c);
	}

	.summary {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-weight: 600;
	}

	.rank {
		opacity: 0.6;
		font-weight: 500;
		font-size: 0.85rem;
	}

	.coverage {
		display: flex;
		gap: 1.5rem;
		margin: 0;
		font-size: 0.85rem;
	}

	.coverage div {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.coverage dt {
		opacity: 0.65;
	}

	.coverage dd {
		margin: 0;
		font-weight: 700;
	}
</style>
