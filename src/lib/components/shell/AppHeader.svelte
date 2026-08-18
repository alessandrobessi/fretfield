<script lang="ts">
	import DisplayModeToggle from '$lib/components/DisplayModeToggle.svelte';
	import { navigation, type Destination } from '$lib/stores/navigation.svelte';

	const DESTINATIONS: { id: Destination; label: string }[] = [
		{ id: 'explore', label: 'Explore' },
		{ id: 'practice', label: 'Practice' },
		{ id: 'progress', label: 'Progress' }
	];

	let settingsOpen = $state(false);
</script>

<div class="app-header">
	<div class="destinations" role="tablist" aria-label="Destination">
		{#each DESTINATIONS as d (d.id)}
			<button
				type="button"
				role="tab"
				aria-selected={navigation.destination === d.id}
				class:active={navigation.destination === d.id}
				onclick={() => navigation.setDestination(d.id)}
			>
				{d.label}
			</button>
		{/each}
	</div>

	<div class="utilities">
		<span
			class="bass-status"
			title="Bass connection is moving here — for now, use Live Input below"
		>
			○ Bass
		</span>
		<div class="settings">
			<button
				type="button"
				class="settings-toggle"
				aria-expanded={settingsOpen}
				aria-controls="settings-panel"
				onclick={() => (settingsOpen = !settingsOpen)}
			>
				⚙ Settings
			</button>
			{#if settingsOpen}
				<div id="settings-panel" class="settings-panel">
					<span class="settings-label">Display</span>
					<DisplayModeToggle />
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.destinations {
		display: flex;
		gap: 0.5rem;
	}

	.destinations button {
		font: inherit;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.55rem 1.1rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.destinations button.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 10%, var(--fret-bg, #fff));
		color: var(--nut, #7c3aed);
	}

	.destinations button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.utilities {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.bass-status {
		font-size: 0.85rem;
		font-weight: 600;
		opacity: 0.55;
		padding: 0.4rem 0.7rem;
		border-radius: 999px;
		border: 2px dashed var(--fret-border, #ddd3f7);
	}

	.settings {
		position: relative;
	}

	.settings-toggle {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.settings-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.settings-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 12px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}

	.settings-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		opacity: 0.65;
	}
</style>
