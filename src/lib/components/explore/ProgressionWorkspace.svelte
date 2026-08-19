<script lang="ts">
	import CustomScaleMap from '$lib/components/explore/CustomScaleMap.svelte';
	import PathSelector from '$lib/components/PathSelector.svelte';
	import ProgressionSelector from '$lib/components/ProgressionSelector.svelte';
	import ProgressionStrip from '$lib/components/ProgressionStrip.svelte';
	import ProgressionScales from '$lib/components/explore/ProgressionScales.svelte';
	import { defaultNoteName } from '$lib/music/pitch';
	import { fretfield, type FieldMode } from '$lib/stores/fretfield.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	const LENSES: { id: 'connections' | 'paths' | 'scales'; label: string; mode: FieldMode }[] = [
		{ id: 'connections', label: 'Connections', mode: 'progression' },
		{ id: 'paths', label: 'Paths', mode: 'paths' },
		{ id: 'scales', label: 'Scales', mode: 'progression-scales' }
	];

	const tonicLabel = $derived(fretfield.root === null ? '—' : defaultNoteName(fretfield.root));
	const activeChordLabel = $derived(fretfield.activeProgressionChord?.symbol ?? '—');
	// The workspace's own concern is "which progression lens is active" — reuses
	// fretfield.mode directly rather than a parallel, desyncable UI-only field,
	// same as ChordExplorer's entry point. A dedicated navigation-store field
	// only earns its keep once a lens choice needs to survive independent of
	// fretfield.mode's other consumers (rankedPaths/currentTransition).
	// 'scale-blocks' (Custom Scale Map) folds into the 'scales' lens too — it's
	// reached via a button inside ProgressionScales, not its own switcher tab,
	// so the Scales sub-tab should keep reading as active while it's open.
	const lens = $derived(
		fretfield.mode === 'paths'
			? 'paths'
			: fretfield.mode === 'progression-scales' || fretfield.mode === 'scale-blocks'
				? 'scales'
				: 'connections'
	);

	const activeLensIndex = $derived(LENSES.findIndex((l) => l.id === lens));

	function handleLensKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activeLensIndex, LENSES.length);
		if (next === null) return;
		event.preventDefault();
		fretfield.setMode(LENSES[next].mode);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}
</script>

<div class="progression-workspace">
	<div class="top-row">
		<div class="status" aria-live="polite">
			<span class="chip root-chip"><span class="field-label">Tonic:</span> {tonicLabel}</span>
			<span class="chip chord-chip"><span class="field-label">Chord:</span> {activeChordLabel}</span
			>
		</div>
		<div class="controls">
			<ProgressionSelector />
		</div>
	</div>
	<ProgressionStrip />

	<div
		class="lens-switcher"
		role="tablist"
		aria-label="Lens"
		tabindex="-1"
		onkeydown={handleLensKeydown}
	>
		{#each LENSES as l, index (l.id)}
			<button
				type="button"
				role="tab"
				aria-selected={lens === l.id}
				class:active={lens === l.id}
				tabindex={index === activeLensIndex ? 0 : -1}
				onclick={() => fretfield.setMode(l.mode)}
			>
				{l.label}
			</button>
		{/each}
	</div>

	{#if lens === 'paths'}
		<PathSelector />
	{:else if lens === 'scales'}
		{#if fretfield.mode === 'scale-blocks'}
			<CustomScaleMap />
		{:else}
			<ProgressionScales />
		{/if}
	{/if}
</div>

<style>
	.progression-workspace {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.top-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
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
		gap: 1rem;
	}

	.lens-switcher {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.lens-switcher button {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	.lens-switcher button.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 10%, var(--fret-bg, #fff));
		color: var(--nut, #7c3aed);
	}

	.lens-switcher button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
