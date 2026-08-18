<script lang="ts">
	import { fretfield, type FieldMode } from '$lib/stores/fretfield.svelte';

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
	// Scale Blocks keeps its internal-architecture name here as a deliberate
	// exception: the roadmap wants it user-facing-invisible, folded into
	// Progression -> Scales, but that's only true for the auto-suggested
	// per-chord experience (M5) — the manual multi-block editor itself still
	// has no new home (explicitly deferred, see the plan's M5/M10 notes), so
	// relabeling it without relocating it would just orphan a still-real
	// capability under a name that no longer describes where to find it.
	const MODES: { id: FieldMode; label: string; question: string }[] = [
		{ id: 'chord', label: 'Chord', question: 'What can I play now?' },
		{ id: 'progression', label: 'Progression', question: 'Where can I go next?' },
		{
			id: 'scale-blocks',
			label: 'Scale Blocks',
			question: 'What scales fit across this progression?'
		},
		// Kept as "Scale Explorer" rather than the bare approved term "Scale" —
		// that collides with "Scale Blocks" above in any prefix/substring
		// match, and Scale Blocks itself can't be renamed away from that name
		// without a new home to rename it *to* (see the comment above).
		{
			id: 'scale',
			label: 'Scale Explorer',
			question: 'What does this scale look like on its own?'
		}
	];

	// The Progression tab covers three internal FieldMode values now (its own
	// Connections/Paths/Scales lens switcher, see ProgressionWorkspace.svelte)
	// — it should read as active for all three, not just 'progression'.
	function isActive(id: FieldMode): boolean {
		if (id === 'progression') {
			return (
				fretfield.mode === 'progression' ||
				fretfield.mode === 'paths' ||
				fretfield.mode === 'progression-scales'
			);
		}
		return fretfield.mode === id;
	}
</script>

<div class="field-mode-switcher" role="tablist" aria-label="Field mode">
	{#each MODES as m (m.id)}
		<button
			type="button"
			role="tab"
			aria-selected={isActive(m.id)}
			class:active={isActive(m.id)}
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
