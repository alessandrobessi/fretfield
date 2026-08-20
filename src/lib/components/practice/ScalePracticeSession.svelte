<script lang="ts">
	import Fretboard from '$lib/components/Fretboard.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import ScalePracticeControls from '$lib/components/ScalePracticeControls.svelte';
	import { getScaleDefinition } from '$lib/music/scales';
	import { resolvedChordSymbol } from '$lib/music/progressions';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	// The Practice tab renders this component unconditionally, so `fretfield.mode`
	// (FretCell.svelte's/NoteInspector.svelte's internal "which layer am I
	// rendering" flag — see fretfield.svelte.ts) needs to reflect that for as
	// long as this is mounted, then revert the moment it isn't.
	$effect(() => {
		fretfield.setMode('scale-practice');
		return () => fretfield.setMode('chord');
	});

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
</script>

<div class="scale-practice-session">
	<ScalePracticeControls />
	{#if activeChord}
		<p class="harmonic-context">
			<span class="chord">{resolvedChordSymbol(activeChord)}</span>
			{#if activeScaleLabel}<span class="detail"> · {activeScaleLabel}</span>{/if}
			{#if barPosition}<span class="detail"> · {barPosition}</span>{/if}
		</p>
	{/if}
	<Fretboard />
	<Legend />
	<NoteInspector />
</div>

<style>
	.scale-practice-session {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.harmonic-context {
		margin: -0.75rem 0 0;
		font-size: 0.95rem;
	}

	.chord {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--nut, #7c3aed);
	}

	.detail {
		font-weight: 600;
		opacity: 0.75;
	}
</style>
