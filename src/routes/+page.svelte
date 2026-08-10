<script lang="ts">
	import Fretboard from '$lib/components/Fretboard.svelte';
	import HarmonyControls from '$lib/components/HarmonyControls.svelte';
	import Legend from '$lib/components/Legend.svelte';
</script>

<svelte:head>
	<title>FretField</title>
</svelte:head>

<main>
	<header>
		<h1>FretField</h1>
		<p class="tagline">See the harmonic field. Move through it.</p>
	</header>

	<HarmonyControls />
	<Fretboard />
	<Legend />
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
		gap: 0.15rem;
	}

	h1 {
		margin: 0;
	}

	.tagline {
		margin: 0;
		color: var(--fret-fg, #ddd);
		opacity: 0.7;
	}
</style>
