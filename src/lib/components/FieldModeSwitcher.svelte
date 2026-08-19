<script lang="ts">
	import { fretfield, type FieldMode } from '$lib/stores/fretfield.svelte';
	import { nextRovingIndex } from '$lib/utils/roving-index';

	// Terminology follows the roadmap's Phase 12 approved list (Chord,
	// Progression, Scale) — "Field" and "Voice-Leading Paths" are retired
	// user-facing vocabulary now, though FieldMode/etc. stay as internal
	// names (AGENTS.md still calls this a "Field mode" switcher internally).
	//
	// Position isn't listed here: the lens (region dimming, LocalFieldControls)
	// already works and renders from every mode below, so a dedicated tab for
	// it never showed anything a tab switch would change. Scale Practice
	// isn't listed either — it moved to Practice -> Scales (M10). Progression
	// and Paths collapsed into one "Progression" tab, since ProgressionWorkspace's
	// own Connections/Paths/Scales lens switcher already covers what two
	// separate outer tabs used to.
	//
	// Scale Blocks (the manual multi-block editor) isn't listed either
	// anymore: it now lives as "Custom Scale Map", an advanced escape hatch
	// nested inside Progression -> Scales (see ProgressionScales.svelte's
	// "Open Custom Scale Map" button and ProgressionWorkspace.svelte), not a
	// switcher tab of its own — per the roadmap's explicit instruction that
	// this "should not be the default workflow" and its terminology should
	// stay hidden from normal users. This switcher now covers exactly
	// Explore's three primary lenses.
	const MODES: { id: FieldMode; label: string; question: string }[] = [
		{ id: 'chord', label: 'Chord', question: 'What can I play now?' },
		{ id: 'progression', label: 'Progression', question: 'Where can I go next?' },
		{
			id: 'scale',
			label: 'Scale Explorer',
			question: 'What does this scale look like on its own?'
		}
	];

	// The Progression tab covers four internal FieldMode values now (its own
	// Connections/Paths/Scales lens switcher, plus Custom Scale Map nested
	// inside Scales — see ProgressionWorkspace.svelte) — it should read as
	// active for all four, not just 'progression'.
	function isActive(id: FieldMode): boolean {
		if (id === 'progression') {
			return (
				fretfield.mode === 'progression' ||
				fretfield.mode === 'paths' ||
				fretfield.mode === 'progression-scales' ||
				fretfield.mode === 'scale-blocks'
			);
		}
		return fretfield.mode === id;
	}

	const activeIndex = $derived(MODES.findIndex((m) => isActive(m.id)));

	function handleKeydown(event: KeyboardEvent): void {
		const next = nextRovingIndex(event.key, activeIndex, MODES.length);
		if (next === null) return;
		event.preventDefault();
		fretfield.setMode(MODES[next].id);
		(event.currentTarget as HTMLElement).querySelectorAll('button')[next]?.focus();
	}
</script>

<div
	class="field-mode-switcher"
	role="tablist"
	aria-label="Field mode"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	{#each MODES as m, index (m.id)}
		<button
			type="button"
			role="tab"
			aria-selected={isActive(m.id)}
			class:active={isActive(m.id)}
			tabindex={index === activeIndex ? 0 : -1}
			onclick={() => fretfield.setMode(m.id)}
		>
			<span class="label">{m.label}</span>
			<span class="question">{m.question}</span>
		</button>
	{/each}
</div>

<style>
	.field-mode-switcher {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	button {
		font: inherit;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.6rem 1rem;
		border-radius: 12px;
		background: var(--fret-bg, #fff);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
	}

	button.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 8%, var(--fret-bg, #fff));
	}

	button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.label {
		font-weight: 700;
		font-size: 0.95rem;
	}

	button.active .label {
		color: var(--nut, #7c3aed);
	}

	.question {
		font-size: 0.75rem;
		opacity: 0.65;
	}
</style>
