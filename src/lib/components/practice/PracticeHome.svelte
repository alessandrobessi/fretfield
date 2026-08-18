<script lang="ts">
	import { PRACTICE_MODE_STYLES } from '$lib/practice/presets';
	import type { PracticeMode } from '$lib/practice/types';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { practice } from '$lib/stores/practice.svelte';

	// Guided Practice's engine/UI still lives under Explore (see the plan's
	// M2-M9 sequencing note) -- starting a session from here jumps the user
	// there rather than duplicating a second copy of the UI. Scale Practice
	// has its own fretboard rendered right here under Practice as of M10 (see
	// +page.svelte), so starting it just changes the mode -- no navigation.
	function startGuided(mode: PracticeMode): void {
		practice.start(mode);
		navigation.setDestination('explore');
	}

	function startScales(): void {
		fretfield.setMode('scale-practice');
	}
</script>

<div class="practice-home">
	<p class="intro">Pick something to practice.</p>
	<div class="cards">
		{#each Object.values(PRACTICE_MODE_STYLES) as style (style.mode)}
			<button type="button" class="card" onclick={() => startGuided(style.mode)}>
				<span class="card-title">{style.label}</span>
				<span class="card-question">{style.question}</span>
			</button>
		{/each}
		<button type="button" class="card" onclick={startScales}>
			<span class="card-title">Scales</span>
			<span class="card-question">Can you play this scale in time?</span>
		</button>
	</div>
</div>

<style>
	.practice-home {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.intro {
		margin: 0;
		opacity: 0.65;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.card {
		font: inherit;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1 1 14rem;
		padding: 1rem 1.25rem;
		border-radius: 14px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.card:hover {
		border-color: var(--nut, #7c3aed);
	}

	.card:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.card-title {
		font-weight: 700;
		font-size: 1rem;
	}

	.card-question {
		font-size: 0.8rem;
		opacity: 0.65;
	}
</style>
