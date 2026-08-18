<script lang="ts">
	import { fretfield, type FieldMode } from '$lib/stores/fretfield.svelte';

	// Local Fields isn't listed here: the Local Field *lens* (region dimming,
	// LocalFieldControls) already works and renders from every mode below, so
	// a dedicated tab for it never showed anything a tab switch would change
	// (its content branch always fell through to Chord Field's). Scale
	// Practice isn't listed either — it moved to Practice -> Scales (M10);
	// this switcher only covers Explore's own lenses now.
	const MODES: { id: FieldMode; label: string; question: string }[] = [
		{ id: 'chord', label: 'Chord Field', question: 'What can I play now?' },
		{ id: 'progression', label: 'Progression Field', question: 'Where can I go next?' },
		{ id: 'paths', label: 'Voice-Leading Paths', question: 'What route should I take?' },
		{
			id: 'scale-blocks',
			label: 'Scale Blocks',
			question: 'What scales fit across this progression?'
		},
		{
			id: 'scale',
			label: 'Scale Explorer',
			question: 'What does this scale look like on its own?'
		}
	];
</script>

<div class="field-mode-switcher" role="tablist" aria-label="Field mode">
	{#each MODES as m (m.id)}
		<button
			type="button"
			role="tab"
			aria-selected={fretfield.mode === m.id}
			class:active={fretfield.mode === m.id}
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
