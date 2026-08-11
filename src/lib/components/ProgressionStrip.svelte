<script lang="ts">
	import { fretfield } from '$lib/stores/fretfield.svelte';
</script>

{#if fretfield.root === null}
	<p class="empty">Choose a root, then a progression, to see it resolved here.</p>
{:else if fretfield.resolvedProgression.length === 0}
	<p class="empty">Choose a progression above.</p>
{:else}
	<div class="progression-strip">
		<button
			type="button"
			class="nav"
			onclick={() => fretfield.previousChord()}
			aria-label="Previous chord"
		>
			◂
		</button>
		<ol class="chords">
			{#each fretfield.resolvedProgression as chord, index (index)}
				<li>
					<button
						type="button"
						class="chord"
						class:active={index === fretfield.activeChordIndex}
						onclick={() => fretfield.setActiveChordIndex(index)}
						aria-current={index === fretfield.activeChordIndex}
					>
						{chord.symbol}
					</button>
				</li>
			{/each}
		</ol>
		<button type="button" class="nav" onclick={() => fretfield.nextChord()} aria-label="Next chord">
			▸
		</button>
	</div>
{/if}

<style>
	.empty {
		margin: 0;
		opacity: 0.6;
		font-size: 0.9rem;
	}

	.progression-strip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.chords {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
		flex-wrap: wrap;
	}

	.chord {
		font: inherit;
		font-weight: 700;
		font-size: 1.1rem;
		padding: 0.5rem 1rem;
		border-radius: 10px;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.chord.active {
		background: linear-gradient(135deg, var(--hero-from, #7c3aed), var(--hero-to, #ec4899));
		color: #fff;
		border-color: transparent;
		box-shadow: 0 2px 8px rgb(124 58 237 / 0.35);
	}

	.chord:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.nav {
		font: inherit;
		font-weight: 700;
		font-size: 1.1rem;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		color: var(--nut, #7c3aed);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
		flex: 0 0 auto;
	}

	.nav:hover {
		border-color: var(--nut, #7c3aed);
	}

	.nav:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
