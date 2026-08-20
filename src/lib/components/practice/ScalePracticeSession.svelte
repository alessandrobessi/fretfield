<script lang="ts">
	import Fretboard from '$lib/components/Fretboard.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import ScalePracticeControls from '$lib/components/ScalePracticeControls.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	// The Practice tab renders this component unconditionally, so `fretfield.mode`
	// (FretCell.svelte's/NoteInspector.svelte's internal "which layer am I
	// rendering" flag — see fretfield.svelte.ts) needs to reflect that for as
	// long as this is mounted, then revert the moment it isn't.
	$effect(() => {
		fretfield.setMode('scale-practice');
		return () => fretfield.setMode('chord');
	});
</script>

<div class="scale-practice-session">
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
</style>
