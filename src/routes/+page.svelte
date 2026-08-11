<script lang="ts">
	import { browser } from '$app/environment';
	import FieldModeSwitcher from '$lib/components/FieldModeSwitcher.svelte';
	import Fretboard from '$lib/components/Fretboard.svelte';
	import HarmonyControls from '$lib/components/HarmonyControls.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import LocalFieldControls from '$lib/components/LocalFieldControls.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import PathsControls from '$lib/components/PathsControls.svelte';
	import ProgressionControls from '$lib/components/ProgressionControls.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { decodeStateFromSearchParams, encodeStateToSearchParams } from '$lib/utils/url-state';

	// Restore once on load; URL-shareable state only (root/mode/chord/display/
	// progression/region) — never blocks first render if the query is absent
	// or stale.
	if (browser) {
		fretfield.restoreFromURLState(
			decodeStateFromSearchParams(new URLSearchParams(window.location.search))
		);
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
		<h1>FretField</h1>
		<p class="tagline">See the harmonic field. Move through it.</p>
	</header>

	<FieldModeSwitcher />

	{#if fretfield.mode === 'progression'}
		<ProgressionControls />
	{:else if fretfield.mode === 'paths'}
		<PathsControls />
	{:else}
		<HarmonyControls />
	{/if}

	<Fretboard />
	<Legend />
	<NoteInspector />
	<LocalFieldControls />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 64rem;
		margin: 0 auto;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
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
</style>
