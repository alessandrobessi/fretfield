<script lang="ts">
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/shell/AppHeader.svelte';
	import ChordExplorer from '$lib/components/explore/ChordExplorer.svelte';
	import ExploreOnboarding from '$lib/components/explore/ExploreOnboarding.svelte';
	import Fretboard from '$lib/components/Fretboard.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import ScalePracticeSession from '$lib/components/practice/ScalePracticeSession.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { installLiveInputTestHooks } from '$lib/testing/live-input-test-hooks';
	import { installPersistenceTestHooks } from '$lib/testing/persistence-test-hooks';
	import { decodeStateFromSearchParams, encodeStateToSearchParams } from '$lib/utils/url-state';

	// Restore once on load; URL-shareable state only (root/chord/display/
	// analysis) — never blocks first render if the query is absent or stale.
	if (browser) {
		fretfield.restoreFromURLState(
			decodeStateFromSearchParams(new URLSearchParams(window.location.search))
		);
		installLiveInputTestHooks();
		installPersistenceTestHooks();
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
	<AppHeader />

	{#if navigation.destination === 'explore'}
		<ExploreOnboarding />
		<ChordExplorer />
		<Fretboard />
		<Legend />
		<NoteInspector />
	{:else}
		<ScalePracticeSession />
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: clamp(0.75rem, 4vw, 1.5rem);
		/* Wide enough that the full 21-fret board (row label + 21 × 3.25rem
		   cells = 70.25rem) fits without horizontal scrolling on a typical
		   desktop viewport — narrower viewports still fall back to the
		   fretboard's own horizontal scroll (AGENTS.md §18). */
		max-width: 78rem;
		margin: 0 auto;
	}
</style>
