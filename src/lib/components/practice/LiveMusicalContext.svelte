<script lang="ts">
	import GrooveArrangementStrip from '$lib/components/GrooveArrangementStrip.svelte';
	import PositionRangeInputs from '$lib/components/shared/PositionRangeInputs.svelte';
	import type { FretRange } from '$lib/music/fret-range';
	import { resolvedChordSymbol } from '$lib/music/progressions';
	import { getScaleDefinition } from '$lib/music/scales';
	import { DEFAULT_FRET_COUNT } from '$lib/music/tuning';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	/** "C7 · C Mixolydian · Bar 7/12" -- roadmap's "Live Harmonic Context" (see AGENTS.md), read off the same activeChordIndex/activeChordScale/activeBarIndex fields that drive the chord strip and arrangement strip, so it can never disagree with them. */
	const activeChord = $derived(
		scalePractice.resolvedProgression[scalePractice.activeChordIndex] ?? null
	);
	const activeScaleLabel = $derived(
		scalePractice.activeChordScale
			? getScaleDefinition(scalePractice.activeChordScale.scaleId).label
			: null
	);
	// Bar position is shown only while actually running -- unlike the chord/
	// scale (which double as a stopped-state preview), there's no single
	// "current bar" to freeze on once playback halts.
	const barPosition = $derived(
		scalePractice.running && scalePractice.activeBarIndex !== null
			? `Bar ${scalePractice.activeBarIndex + 1}/${scalePractice.groove.arrangement.length}`
			: null
	);

	// Distinguishes "no scale is showing at all" from "your zone doesn't reach
	// any note of the scale that is showing" — both leave `scalePositions`
	// empty, but they need different guidance.
	const zoneExcludesScale = $derived(
		scalePractice.activeChordScale !== null && scalePractice.scalePositions.length === 0
	);
	// A scale only ever comes from a progression chord now (no standalone
	// manual scale) -- this is the "you have a root but haven't picked a
	// progression yet, or cleared the active chord's scale" case.
	const noScaleChosen = $derived(
		scalePractice.root !== null && scalePractice.activeChordScale === null
	);

	function handleZoneChange(range: FretRange): void {
		scalePractice.setZone(range.minFret, range.maxFret);
	}
</script>

<div class="live-musical-context">
	{#if activeChord}
		<p class="harmonic-context">
			<span class="chord">{resolvedChordSymbol(activeChord)}</span>
			{#if activeScaleLabel}<span class="detail"> · {activeScaleLabel}</span>{/if}
			{#if barPosition}<span class="detail"> · {barPosition}</span>{/if}
		</p>
	{/if}

	{#if scalePractice.groove.arrangement.length > 1}
		<GrooveArrangementStrip
			arrangement={scalePractice.groove.arrangement}
			activeBarIndex={scalePractice.activeBarIndex}
			chordLabels={scalePractice.barChordLabels}
			readOnly
		/>
	{/if}

	<div class="context-row">
		<PositionRangeInputs
			range={scalePractice.zone}
			fretCount={DEFAULT_FRET_COUNT}
			label="Zone"
			onChange={handleZoneChange}
		/>
		{#if zoneExcludesScale}
			<p class="hint">No notes of this scale fall inside the chosen zone — widen it.</p>
		{:else if noScaleChosen}
			<p class="hint">Choose a progression above to see a scale for each chord.</p>
		{:else if !liveInput.enabled}
			<p class="hint">Enable Live Input above to see the notes you play highlighted.</p>
		{/if}
	</div>
</div>

<style>
	.live-musical-context {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.harmonic-context {
		margin: 0;
		font-size: 0.95rem;
	}

	.chord {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--nut, #e3ac18);
	}

	.detail {
		font-weight: 600;
		opacity: 0.75;
	}

	.context-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
	}
</style>
