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
