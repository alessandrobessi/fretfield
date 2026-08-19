<script lang="ts">
	import { fretfield, type PathPreset } from '$lib/stores/fretfield.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	const PRESETS: { id: PathPreset; label: string }[] = [
		{ id: 'balanced', label: 'Balanced' },
		{ id: 'minimal-movement', label: 'Minimal Movement' },
		{ id: 'guide-tones', label: 'Guide Tones' }
	];

	const activeIndex = $derived(fretfield.selectedPathIndex ?? 0);

	const activePresetIndex = $derived(
		PRESETS.findIndex((preset) => preset.id === fretfield.pathPreset)
	);

	function handlePresetKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activePresetIndex, PRESETS.length);
		if (next === null) return;
		event.preventDefault();
		fretfield.setPathPreset(PRESETS[next].id);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}
</script>

<div class="path-selector">
	<div
		class="presets"
		role="radiogroup"
		aria-label="Path preset"
		tabindex="-1"
		onkeydown={handlePresetKeydown}
	>
		{#each PRESETS as preset, index (preset.id)}
			<button
				type="button"
				role="radio"
				aria-checked={fretfield.pathPreset === preset.id}
				class:active={fretfield.pathPreset === preset.id}
				tabindex={index === activePresetIndex ? 0 : -1}
				onclick={() => fretfield.setPathPreset(preset.id)}
			>
				{preset.label}
			</button>
		{/each}
	</div>

	{#if fretfield.root === null}
		<p class="empty">Choose a root, then a progression, to search for paths.</p>
	{:else if fretfield.resolvedProgression.length < 2}
		<p class="empty">Choose a progression with at least two chords.</p>
	{:else if fretfield.displayRankedPaths.length === 0}
		<p class="empty">No path found — try a wider Local Field region or a different preset.</p>
	{:else}
		<ol class="paths">
			{#each fretfield.displayRankedPaths as path, index (index)}
				<li>
					<button
						type="button"
						class="path"
						class:active={index === activeIndex}
						aria-current={index === activeIndex}
						onclick={() => fretfield.selectPath(index)}
					>
						<span class="rank">{index + 1}</span>
						<span class="notes">{path.noteNames.join(' → ')}</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.path-selector {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.presets {
		display: inline-flex;
		align-self: flex-start;
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 999px;
		overflow: hidden;
		background: var(--fret-bg, #fff);
	}

	.presets button {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.5rem 0.9rem;
		background: transparent;
		color: var(--fret-fg, #241a3d);
		border: none;
		cursor: pointer;
	}

	.presets button.active {
		background: linear-gradient(135deg, var(--hero-from, #7c3aed), var(--hero-to, #ec4899));
		color: #fff;
	}

	.presets button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: -3px;
	}

	.empty {
		margin: 0;
		opacity: 0.6;
		font-size: 0.9rem;
	}

	.paths {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.path {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		font: inherit;
		font-weight: 600;
		padding: 0.6rem 1rem;
		border-radius: 10px;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
		text-align: left;
	}

	.path.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 8%, var(--fret-bg, #fff));
	}

	.path:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.rank {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: var(--nut, #7c3aed);
		color: #fff;
		font-size: 0.8rem;
		flex: 0 0 auto;
	}

	.notes {
		font-size: 1rem;
	}
</style>
