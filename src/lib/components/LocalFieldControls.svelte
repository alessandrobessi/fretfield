<script lang="ts">
	import PositionRangeInputs from '$lib/components/shared/PositionRangeInputs.svelte';
	import type { FretRange } from '$lib/music/fret-range';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	let showOverlap = $state(false);

	const activeIndex = $derived(
		fretfield.rankedRegions.findIndex((r) => r.region.id === fretfield.activeRegion?.id)
	);
	const activeAnalysis = $derived(activeIndex >= 0 ? fretfield.rankedRegions[activeIndex] : null);
	const rank = $derived(activeIndex >= 0 ? activeIndex + 1 : null);

	const fretCount = fretfield.fretCount;
	const tickFrets = $derived.by(() => {
		const step = 5;
		const ticks: number[] = [];
		for (let fret = 0; fret <= fretCount; fret += step) ticks.push(fret);
		return ticks;
	});

	function percent(fret: number): number {
		return (fret / fretCount) * 100;
	}

	function barStyle(minFret: number, maxFret: number): string {
		const left = percent(minFret);
		const width = percent(maxFret - minFret + 1);
		return `left: ${left}%; width: ${width}%;`;
	}

	const customRange = $derived<FretRange>(
		fretfield.activeRegion ?? { minFret: 0, maxFret: fretCount }
	);

	function handleCustomRangeChange(range: FretRange): void {
		fretfield.setRegion({
			id: `region-${range.minFret}-${range.maxFret}`,
			minFret: range.minFret,
			maxFret: range.maxFret
		});
	}
</script>

<div class="local-field-controls">
	<div class="heading">
		<h2>Position</h2>
		<p>Where on the neck should I play it?</p>
	</div>

	{#if fretfield.root === null}
		<p class="empty">Choose a root to see useful regions of the neck.</p>
	{:else}
		<div class="nav">
			<button type="button" onclick={() => fretfield.previousRegion()}>◂ Previous</button>
			<div class="summary">
				{#if fretfield.activeRegion}
					<span class="range"
						>Frets {fretfield.activeRegion.minFret}–{fretfield.activeRegion.maxFret}</span
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
			<button type="button" class="clear" onclick={() => fretfield.clearRegion()}>Clear</button>
			<button
				type="button"
				class="overlap-toggle"
				class:active={showOverlap}
				aria-pressed={showOverlap}
				onclick={() => (showOverlap = !showOverlap)}
			>
				Show overlap
			</button>
		</div>

		<PositionRangeInputs
			range={customRange}
			{fretCount}
			label="Position"
			onChange={handleCustomRangeChange}
		/>

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

		<div class="neck-ruler" aria-hidden="true">
			{#if showOverlap}
				<div class="overlap-stack">
					{#each fretfield.rankedRegions as analysis, index (analysis.region.id)}
						<div
							class="overlap-bar"
							class:active={index === activeIndex}
							style={barStyle(analysis.region.minFret, analysis.region.maxFret)}
						></div>
					{/each}
				</div>
			{:else}
				<div class="ruler-track">
					{#if fretfield.activeRegion}
						<div
							class="region-bracket"
							style={barStyle(fretfield.activeRegion.minFret, fretfield.activeRegion.maxFret)}
						></div>
					{/if}
				</div>
			{/if}
			<div class="ruler-labels">
				{#each tickFrets as fret (fret)}
					<span class="tick" style={`left: ${percent(fret)}%;`}>{fret}</span>
				{/each}
			</div>
		</div>
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

	.nav button.overlap-toggle.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 10%, var(--fret-bg, #fff));
		color: var(--nut, #7c3aed);
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

	.neck-ruler {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.ruler-track {
		position: relative;
		height: 1.25rem;
		background: var(--fretboard-bg, #ede8fb);
		border-radius: 6px;
	}

	.region-bracket {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--nut, #7c3aed);
		border-radius: 6px;
		opacity: 0.85;
	}

	.overlap-stack {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 0.25rem 0;
	}

	.overlap-bar {
		position: relative;
		height: 0.5rem;
		border-radius: 4px;
		background: color-mix(in srgb, var(--nut, #7c3aed) 25%, transparent);
	}

	.overlap-bar.active {
		background: var(--nut, #7c3aed);
	}

	.ruler-labels {
		position: relative;
		height: 1rem;
		font-size: 0.7rem;
		opacity: 0.6;
	}

	.tick {
		position: absolute;
		transform: translateX(-50%);
	}
</style>
