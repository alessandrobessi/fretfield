<script lang="ts">
	import { base } from '$app/paths';
	import DisplayModeToggle from '$lib/components/DisplayModeToggle.svelte';
	import BassConnection from '$lib/components/shell/BassConnection.svelte';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { navigation, type Destination } from '$lib/stores/navigation.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	const DESTINATIONS: { id: Destination; label: string }[] = [
		{ id: 'explore', label: 'Explore' },
		{ id: 'practice', label: 'Practice' }
	];

	const activeDestinationIndex = $derived(
		DESTINATIONS.findIndex((d) => d.id === navigation.destination)
	);

	function handleDestinationKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activeDestinationIndex, DESTINATIONS.length);
		if (next === null) return;
		event.preventDefault();
		navigation.setDestination(DESTINATIONS[next].id);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}

	let settingsOpen = $state(false);
	let settingsContainerEl: HTMLDivElement | undefined;
	let settingsToggleEl: HTMLButtonElement | undefined;

	function closeSettings(): void {
		settingsOpen = false;
		settingsToggleEl?.focus();
	}

	// BassConnection's own detail panel isn't a manual toggle — it shows
	// itself for as long as Live Input stays connected/erroring (see its own
	// comment), so it can't be closed to make room the way Settings can.
	// Both panels share the same flush-right anchor below the header (see
	// .utilities); when the bass panel is up, Settings' panel shifts left to
	// sit beside it (by its fixed 20rem width, see BassConnection.svelte)
	// rather than stacking on top of it.
	const bassPanelVisible = $derived(liveInput.enabled || liveInput.error !== null);

	// Escape-to-close + click-outside-to-close: the app's first manual
	// disclosure-widget dismissal (every other dropdown/panel in the app is
	// either state-driven, not a user-toggled open/close, or doesn't exist
	// yet) — listeners are only live while the panel is actually open, torn
	// down automatically by $effect's own cleanup otherwise.
	$effect(() => {
		if (!settingsOpen) return;

		function handleKeydown(event: KeyboardEvent): void {
			if (event.key === 'Escape') closeSettings();
		}
		// Deliberately doesn't call closeSettings()/move focus here — an
		// outside click already puts the user's attention/focus wherever they
		// clicked, so forcing it back to the toggle button would be
		// disruptive. Only keyboard (Escape) dismissal returns focus, since
		// that's the expected keyboard-navigation flow.
		function handleClickOutside(event: MouseEvent): void {
			if (settingsContainerEl && !settingsContainerEl.contains(event.target as Node)) {
				settingsOpen = false;
			}
		}

		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="app-header">
	<div class="left">
		<div class="brand">
			<img class="logo" src="{base}/brand/logo-mark.svg" alt="" width="28" height="28" />
			<h1>FretField</h1>
		</div>

		<div
			class="destinations"
			role="tablist"
			aria-label="Destination"
			tabindex="-1"
			onkeydown={handleDestinationKeydown}
		>
			{#each DESTINATIONS as d, index (d.id)}
				<button
					type="button"
					role="tab"
					aria-selected={navigation.destination === d.id}
					class:active={navigation.destination === d.id}
					tabindex={index === activeDestinationIndex ? 0 : -1}
					onclick={() => navigation.setDestination(d.id)}
				>
					{d.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="utilities">
		<BassConnection />
		<div class="settings" bind:this={settingsContainerEl}>
			<button
				type="button"
				class="settings-toggle"
				aria-expanded={settingsOpen}
				aria-controls="settings-panel"
				aria-label="Settings"
				bind:this={settingsToggleEl}
				onclick={() => (settingsOpen = !settingsOpen)}
			>
				<span aria-hidden="true">⚙</span>
				<span class="label">Settings</span>
			</button>
			{#if settingsOpen}
				<div id="settings-panel" class="settings-panel" class:beside-live-input={bassPanelVisible}>
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
		padding-block: 0.6rem;
		padding-inline: 0.25rem;
		border-bottom: 1px solid var(--surface-border, #3a382f);
	}

	.left {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo {
		flex: 0 0 auto;
		border-radius: 6px;
	}

	.brand h1 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ff-yellow, #e3ac18);
	}

	.destinations {
		display: flex;
		gap: 1.25rem;
	}

	.destinations button {
		font: inherit;
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.5rem 0.1rem;
		background: transparent;
		color: var(--fg-muted, #89877f);
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
	}

	.destinations button:hover {
		color: var(--fg, #f1e6c5);
	}

	.destinations button.active {
		border-bottom-color: var(--ff-yellow, #e3ac18);
		color: var(--ff-yellow, #e3ac18);
	}

	.destinations button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.utilities {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.settings {
		position: relative;
	}

	.settings-toggle {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.4rem 0.75rem;
		border-radius: var(--ff-radius-control, 4px);
		background: transparent;
		color: var(--fg, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		cursor: pointer;
	}

	.settings-toggle:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.settings-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	/* Icon-only on narrow screens -- the button's aria-label carries the same
	   text, so this is a visual-only change, not an accessibility regression. */
	@media (max-width: 640px) {
		.settings-toggle .label {
			display: none;
		}
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
		background: var(--surface, #262521);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-panel, 8px);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
	}

	/* Sits beside BassConnection's own panel (fixed 20rem width) instead of
	   stacking on top of it when both are open at once. */
	.settings-panel.beside-live-input {
		right: calc(20rem + 1rem);
	}

	.settings-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fg-muted, #89877f);
	}
</style>
