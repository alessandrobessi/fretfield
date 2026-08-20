<script lang="ts">
	import AnalysisModeToggle from '$lib/components/AnalysisModeToggle.svelte';
	import ChordSelector from '$lib/components/ChordSelector.svelte';
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import {
		favoriteChords,
		findFavoriteChord,
		toggleFavoriteChord
	} from '$lib/stores/favorite-chords.svelte';

	const rootLabel = $derived(fretfield.root === null ? '—' : defaultNoteName(fretfield.root));
	const chordLabel = $derived(getChordDefinition(fretfield.chordId).label);

	const isFavorited = $derived(
		fretfield.root !== null && findFavoriteChord(fretfield.root, fretfield.chordId) !== undefined
	);

	function handleToggleFavorite(): void {
		if (fretfield.root === null) return;
		toggleFavoriteChord(fretfield.root, fretfield.chordId);
	}
</script>

<div class="chord-explorer">
	<div class="status" aria-live="polite">
		<span class="chip root-chip"><span class="field-label">Root:</span> {rootLabel}</span>
		<span class="chip chord-chip"><span class="field-label">Chord:</span> {chordLabel}</span>
		<button
			type="button"
			class="favorite-toggle"
			class:favorited={isFavorited}
			disabled={fretfield.root === null}
			aria-pressed={isFavorited}
			onclick={handleToggleFavorite}
		>
			{isFavorited ? '★' : '☆'} Favorite
		</button>
	</div>
	<div class="controls">
		<ChordSelector />
		<AnalysisModeToggle />
	</div>
	{#if favoriteChords.items.length > 0}
		<div class="favorites" aria-label="Favorite chords">
			{#each favoriteChords.items as item (item.id)}
				<span class="chip favorite-chip">
					<button
						type="button"
						class="favorite-recall"
						onclick={() => {
							fretfield.setRootPitchClass(item.data.root);
							fretfield.setChord(item.data.chordId);
						}}
					>
						{item.name}
					</button>
					<button
						type="button"
						class="favorite-remove"
						aria-label={`Remove ${item.name} from favorites`}
						onclick={() => favoriteChords.remove(item.id)}
					>
						×
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.chord-explorer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.status {
		display: flex;
		gap: 0.75rem;
		font-size: 1rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		font-weight: 700;
	}

	.root-chip {
		background: color-mix(in srgb, var(--role-root, #f59e0b) 16%, transparent);
		color: color-mix(in srgb, var(--role-root, #f59e0b) 70%, black);
	}

	.chord-chip {
		background: color-mix(in srgb, var(--hero-from, #7c3aed) 14%, transparent);
		color: var(--hero-from, #7c3aed);
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		opacity: 0.75;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.favorite-toggle {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
	}

	.favorite-toggle.favorited {
		border-color: var(--role-root, #f59e0b);
		color: color-mix(in srgb, var(--role-root, #f59e0b) 70%, black);
	}

	.favorite-toggle:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.favorite-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.favorites {
		flex-basis: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.favorite-chip {
		padding: 0.15rem 0.15rem 0.15rem 0.7rem;
		background: color-mix(in srgb, var(--role-root, #f59e0b) 10%, transparent);
		font-weight: 600;
		font-size: 0.8rem;
	}

	.favorite-recall {
		font: inherit;
		font-weight: 600;
		background: transparent;
		border: none;
		color: color-mix(in srgb, var(--role-root, #f59e0b) 70%, black);
		cursor: pointer;
		padding: 0;
	}

	.favorite-recall:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.favorite-remove {
		font: inherit;
		font-size: 0.9rem;
		line-height: 1;
		width: 1.4rem;
		height: 1.4rem;
		margin-left: 0.3rem;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--role-alteration, #ef4444);
		cursor: pointer;
	}

	.favorite-remove:hover {
		background: color-mix(in srgb, var(--role-alteration, #ef4444) 12%, transparent);
	}

	.favorite-remove:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
