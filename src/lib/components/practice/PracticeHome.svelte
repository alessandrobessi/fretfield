<script lang="ts">
	import { PRACTICE_MODE_STYLES } from '$lib/practice/presets';
	import { listPracticePresets, openPreset } from '$lib/practice/preset-library';
	import type { PracticeMode } from '$lib/practice/types';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { practice } from '$lib/stores/practice.svelte';

	let view = $state<'cards' | 'presets'>('cards');
	const presets = listPracticePresets();

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
	{#if view === 'cards'}
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
			<button type="button" class="card presets-card" onclick={() => (view = 'presets')}>
				<span class="card-title">Presets</span>
				<span class="card-question"
					>Curated one-click sessions — start practicing without configuring anything first.</span
				>
			</button>
		</div>
	{:else}
		<button type="button" class="back" onclick={() => (view = 'cards')}>← Back to Practice</button>
		<p class="intro">Curated sessions — pick one to start practicing immediately.</p>
		<div class="cards presets">
			{#each presets as preset (preset.id)}
				<button type="button" class="card" onclick={() => openPreset(preset)}>
					<span class="card-title">{preset.title}</span>
					<span class="card-question">{preset.description}</span>
				</button>
			{/each}
		</div>
	{/if}
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

	.back {
		align-self: flex-start;
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.back:hover {
		border-color: var(--nut, #7c3aed);
	}

	.back:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
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

	.card.presets-card {
		border-style: dashed;
	}

	.card-title {
		font-weight: 700;
		font-size: 1rem;
	}

	.card-question {
		font-size: 0.8rem;
		opacity: 0.65;
	}

	.presets .card {
		flex: 1 1 16rem;
	}
</style>
