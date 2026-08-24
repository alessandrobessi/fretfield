<script lang="ts">
	import { browser } from '$app/environment';
	import AppHeader from '$lib/components/shell/AppHeader.svelte';
	import Footer from '$lib/components/shell/Footer.svelte';
	import ChordExplorer from '$lib/components/explore/ChordExplorer.svelte';
	import ExploreOnboarding from '$lib/components/explore/ExploreOnboarding.svelte';
	import Fretboard from '$lib/components/Fretboard.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import ScalePracticeSession from '$lib/components/practice/ScalePracticeSession.svelte';
	import { OG_IMAGE_URL, SITE_NAME, SITE_URL } from '$lib/seo';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { installLiveInputTestHooks } from '$lib/testing/live-input-test-hooks';
	import { installPersistenceTestHooks } from '$lib/testing/persistence-test-hooks';
	import { decodeStateFromSearchParams, encodeStateToSearchParams } from '$lib/utils/url-state';

	const TITLE = 'FretField — Interactive Bass Fretboard, Chord Theory & Drum Machine';
	const DESCRIPTION =
		'See every chord tone, tension, and color note light up on the bass fretboard, practice scales against a live drum machine and chord pad, and play a 303-style Acid Bass synth engine that generates its own basslines. Free, in your browser.';
	const CANONICAL_URL = `${SITE_URL}/`;

	const appLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: SITE_NAME,
		url: CANONICAL_URL,
		description: DESCRIPTION,
		applicationCategory: 'MusicApplication',
		operatingSystem: 'Any (runs in a web browser)',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		author: { '@type': 'Person', name: 'Alessandro Bessi', url: `${SITE_URL}/about` }
	};

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
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href={CANONICAL_URL} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:url" content={CANONICAL_URL} />
	<meta property="og:image" content={OG_IMAGE_URL} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content={OG_IMAGE_URL} />

	<!-- eslint-disable-next-line svelte/no-at-html-tags -- fully static/controlled JSON-LD, not user input; {@html} is required here since a literal <script> tag in Svelte markup doesn't evaluate its {expression} content, it treats it as opaque text (Svelte only special-cases the module-level <script> block, not one nested in the template) -->
	{@html `<script type="application/ld+json">${JSON.stringify(appLd)}<` + `/script>`}
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

	<Footer />
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
