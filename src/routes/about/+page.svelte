<script lang="ts">
	import { resolve } from '$app/paths';
	import Footer from '$lib/components/shell/Footer.svelte';
	import { OG_IMAGE_URL, SITE_NAME, SITE_URL } from '$lib/seo';

	const TITLE = 'About the Author — FretField';
	const DESCRIPTION =
		'Alessandro Bessi is an AI expert, data scientist, and software engineer, and the author of FretField — an interactive bass fretboard, chord theory, and drum machine app.';
	const CANONICAL_URL = `${SITE_URL}/about`;

	const personLd = {
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: 'Alessandro Bessi',
		jobTitle: 'AI Expert, Data Scientist & Software Engineer',
		description: DESCRIPTION,
		url: CANONICAL_URL,
		knowsAbout: [
			'Machine Learning',
			'Artificial Intelligence',
			'Complex Systems',
			'Software Engineering'
		]
	};
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href={CANONICAL_URL} />

	<meta property="og:type" content="profile" />
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
	{@html `<script type="application/ld+json">${JSON.stringify(personLd)}<` + `/script>`}
</svelte:head>

<main>
	<a class="back" href={resolve('/')}>← Back to FretField</a>

	<h1>About the Author</h1>

	<p>FretField is built and maintained by <strong>Alessandro Bessi</strong>.</p>

	<p>
		Alessandro Bessi is an AI expert, data scientist, and software engineer whose work spans machine
		learning, complex systems, and the infrastructure required to make intelligent systems work in
		practice.
	</p>

	<p>
		He holds a PhD in Economics and Social Sciences and a master's degree in Statistics, with
		international research experience in computer science at the University of Southern California.
		His academic work includes over forty scientific publications, widely cited for research on
		misinformation, online social systems, and computational behavior.
	</p>

	<p>
		Since moving from academia into industry, he has worked on production machine-learning systems,
		AI products, cloud infrastructure, and tools designed to support better decisions and human
		development.
	</p>

	<p>
		Beyond his professional work, he pursues chess, music, endurance training, and drawing —
		different explorations of structure, adaptation, creativity, and disciplined practice.
		FretField, an instrument-teaching tool built at the intersection of music and software, sits
		squarely at that same intersection.
	</p>

	<Footer />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 42rem;
		margin: 0 auto;
		padding: clamp(1rem, 4vw, 2rem);
		line-height: 1.6;
	}

	.back {
		align-self: flex-start;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--ff-yellow, #e3ac18);
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
	}

	.back:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	h1 {
		margin: 0.5rem 0 0;
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--ff-yellow, #e3ac18);
	}

	p {
		margin: 0;
		color: var(--fg, #f1e6c5);
	}
</style>
