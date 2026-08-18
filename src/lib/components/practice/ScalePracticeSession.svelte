<script lang="ts">
	import Fretboard from '$lib/components/Fretboard.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import ScalePracticeControls from '$lib/components/ScalePracticeControls.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
</script>

<div class="scale-practice-session">
	<button type="button" class="back" onclick={() => fretfield.setMode('chord')}>
		← Back to Practice
	</button>
	<ScalePracticeControls />
	<Fretboard />
	<Legend />
	<NoteInspector />
</div>

<style>
	.scale-practice-session {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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
</style>
