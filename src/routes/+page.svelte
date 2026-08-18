<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import AppHeader from '$lib/components/shell/AppHeader.svelte';
	import FieldModeSwitcher from '$lib/components/FieldModeSwitcher.svelte';
	import Fretboard from '$lib/components/Fretboard.svelte';
	import GuidedPracticeControls from '$lib/components/GuidedPracticeControls.svelte';
	import HarmonyControls from '$lib/components/HarmonyControls.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import LiveInputControls from '$lib/components/LiveInputControls.svelte';
	import LocalFieldControls from '$lib/components/LocalFieldControls.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import PathsControls from '$lib/components/PathsControls.svelte';
	import ProgressionControls from '$lib/components/ProgressionControls.svelte';
	import ScaleBlockControls from '$lib/components/ScaleBlockControls.svelte';
	import ScaleBlockLegend from '$lib/components/ScaleBlockLegend.svelte';
	import ScalePracticeControls from '$lib/components/ScalePracticeControls.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { installLiveInputTestHooks } from '$lib/testing/live-input-test-hooks';
	import { installPracticeTestHooks } from '$lib/testing/practice-test-hooks';
	import { decodeStateFromSearchParams, encodeStateToSearchParams } from '$lib/utils/url-state';

	// Restore once on load; URL-shareable state only (root/mode/chord/display/
	// progression/region) — never blocks first render if the query is absent
	// or stale.
	if (browser) {
		fretfield.restoreFromURLState(
			decodeStateFromSearchParams(new URLSearchParams(window.location.search))
		);
		installLiveInputTestHooks();
		installPracticeTestHooks();
	}

	$effect(() => {
		if (!browser) return;
		const search = encodeStateToSearchParams(fretfield.toURLState()).toString();
		const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
		window.history.replaceState(null, '', url);
	});
</script>

<svelte:head>
	<title>FretField</title>
</svelte:head>

<main>
	<header>
		<img class="logo" src="{base}/brand/logo-mark.svg" alt="" width="56" height="56" />
		<div class="titles">
			<h1>FretField</h1>
			<p class="tagline">See the harmonic field. Move through it.</p>
		</div>
	</header>

	<AppHeader />

	{#if navigation.destination === 'explore'}
		<FieldModeSwitcher />
		<LiveInputControls />
		<GuidedPracticeControls />

		{#if fretfield.mode === 'progression'}
			<ProgressionControls />
		{:else if fretfield.mode === 'paths'}
			<PathsControls />
		{:else if fretfield.mode === 'scale-blocks'}
			<ScaleBlockControls />
		{:else if fretfield.mode === 'scale-practice'}
			<ScalePracticeControls />
		{:else}
			<HarmonyControls />
		{/if}

		<Fretboard />
		<Legend />
		<ScaleBlockLegend />
		<NoteInspector />
		<LocalFieldControls />
	{:else if navigation.destination === 'practice'}
		<p class="destination-stub">
			Practice is being rebuilt as its own home — for now, everything still lives under Explore.
		</p>
	{:else}
		<p class="destination-stub">Progress tracking is coming soon.</p>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		/* Wide enough that the full 21-fret board (row label + 21 × 3.25rem
		   cells = 70.25rem) fits without horizontal scrolling on a typical
		   desktop viewport — narrower viewports still fall back to the
		   fretboard's own horizontal scroll (AGENTS.md §18). */
		max-width: 78rem;
		margin: 0 auto;
	}

	header {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		padding: 2rem 1.75rem;
		border-radius: 16px;
		background: linear-gradient(
			135deg,
			var(--hero-from, #7c3aed),
			var(--hero-via, #a855f7),
			var(--hero-to, #ec4899)
		);
		box-shadow: 0 8px 24px rgb(124 58 237 / 0.25);
	}

	.logo {
		flex: 0 0 auto;
		border-radius: 14px;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.15);
	}

	.titles {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	h1 {
		margin: 0;
		color: #fff;
		font-size: 2.25rem;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
	}

	.tagline {
		margin: 0;
		color: #fff;
		opacity: 0.9;
		font-weight: 500;
	}

	.destination-stub {
		margin: 0;
		padding: 2rem 1.5rem;
		text-align: center;
		background: var(--fret-bg, #fff);
		border: 1px dashed var(--fret-border, #ddd3f7);
		border-radius: 14px;
		opacity: 0.7;
	}
</style>
