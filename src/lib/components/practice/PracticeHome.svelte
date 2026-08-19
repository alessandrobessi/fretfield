<script lang="ts">
	import { PRACTICE_MODE_STYLES } from '$lib/practice/presets';
	import { listPracticePresets, openPreset } from '$lib/practice/preset-library';
	import type { PracticeMode } from '$lib/practice/types';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';
	import { onboarding } from '$lib/stores/onboarding.svelte';
	import { practice } from '$lib/stores/practice.svelte';
	import { practiceHistory } from '$lib/stores/practice-history.svelte';

	let view = $state<'cards' | 'presets'>('cards');
	const presets = listPracticePresets();

	const streakLabel = $derived(
		practiceHistory.currentStreak > 0
			? `${practiceHistory.currentStreak}-day streak`
			: 'No active streak'
	);
	const lastPracticedLabel = $derived.by(() => {
		const lastPracticedAt = practiceHistory.stats.lastPracticedAt;
		if (lastPracticedAt === null) return null;
		return new Date(lastPracticedAt).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	});

	// Captured once at mount, not reactively: this hint should stay visible
	// for this entire first visit even after markSeen() below flips the
	// underlying flag, only disappearing on the *next* visit.
	const showPracticeIntro = !onboarding.hasSeen('practice-intro');
	$effect(() => {
		onboarding.markSeen('practice-intro');
	});

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
		{#if showPracticeIntro}
			<p class="onboarding-hint">Connect a bass to practice with real notes.</p>
		{/if}
		{#if practiceHistory.stats.totalAttempts > 0}
			<div class="history-summary">
				<span class="streak">{streakLabel}</span>
				<span class="stat">{practiceHistory.stats.totalExercisesCompleted} exercises completed</span
				>
				{#if lastPracticedLabel !== null}
					<span class="stat">Last practiced {lastPracticedLabel}</span>
				{/if}
			</div>
		{/if}
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
					<span class="card-title">
						{preset.title}
						{#if practiceHistory.stats.presetsPracticed.includes(preset.id)}
							<span class="practiced-badge">Practiced</span>
						{/if}
					</span>
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

	.onboarding-hint {
		margin: 0;
		padding: 0.75rem 1.1rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--nut, #7c3aed) 8%, var(--fret-bg, #fff));
		border: 1px dashed var(--nut, #7c3aed);
		color: var(--fret-fg, #241a3d);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.history-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.1rem;
		font-size: 0.85rem;
	}

	.streak {
		font-weight: 700;
		color: var(--nut, #7c3aed);
	}

	.stat {
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

	.practiced-badge {
		margin-left: 0.4rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--fret-border, #ddd3f7);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		opacity: 0.6;
	}

	.card-question {
		font-size: 0.8rem;
		opacity: 0.65;
	}

	.presets .card {
		flex: 1 1 16rem;
	}
</style>
