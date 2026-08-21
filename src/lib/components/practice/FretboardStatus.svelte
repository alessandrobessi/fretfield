<script lang="ts">
	import { intervalCompoundLabel, intervalFromRoot } from '$lib/music/intervals';
	import { defaultNoteName } from '$lib/music/pitch';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const noteName = $derived(
		liveInput.detectedNote ? defaultNoteName(liveInput.detectedNote.pitchClass) : null
	);

	/** Interval from whatever the fretboard is currently keyed against -- the active progression chord's own root while one is showing, otherwise the practice root itself (the same `displayRoot` the fret labels themselves use). */
	const intervalLabel = $derived.by(() => {
		if (liveInput.detectedNote === null || scalePractice.displayRoot === null) return null;
		const interval = intervalFromRoot(scalePractice.displayRoot, liveInput.detectedNote.pitchClass);
		return intervalCompoundLabel(interval);
	});
</script>

{#if liveInput.enabled}
	<p class="fretboard-status" aria-live="polite">
		<span class="dot" aria-hidden="true"></span>
		<span class="label">Bass Connected</span>
		{#if noteName}
			<span class="detail">Played {noteName}</span>
			{#if intervalLabel}<span class="detail">{intervalLabel}</span>{/if}
			{#if liveInput.likelyPosition}
				<span class="detail">Fret {liveInput.likelyPosition.fret}</span>
			{/if}
		{/if}
	</p>
{/if}

<style>
	.fretboard-status {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--live-accent, #10b981);
		flex: 0 0 auto;
	}

	.label {
		opacity: 0.85;
	}

	.detail {
		opacity: 0.65;
	}
</style>
