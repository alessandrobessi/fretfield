<script lang="ts">
	import BandPanel from '$lib/components/practice/BandPanel.svelte';
	import FretboardStatus from '$lib/components/practice/FretboardStatus.svelte';
	import LiveMusicalContext from '$lib/components/practice/LiveMusicalContext.svelte';
	import PracticeSessionBar from '$lib/components/practice/PracticeSessionBar.svelte';
	import Fretboard from '$lib/components/Fretboard.svelte';
	import NoteInspector from '$lib/components/NoteInspector.svelte';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	// The Practice tab renders this component unconditionally, so `fretfield.mode`
	// (FretCell.svelte's/NoteInspector.svelte's internal "which layer am I
	// rendering" flag — see fretfield.svelte.ts) needs to reflect that for as
	// long as this is mounted, then revert the moment it isn't. This is also
	// the one component guaranteed to mount only while Practice is active, so
	// it's the right place to stop the drum machine on tab-away too.
	$effect(() => {
		fretfield.setMode('scale-practice');
		return () => {
			fretfield.setMode('chord');
			scalePractice.stop();
		};
	});
</script>

<div class="scale-practice-session">
	<PracticeSessionBar />
	<LiveMusicalContext />
	<Fretboard />
	<FretboardStatus />
	<BandPanel />
	<NoteInspector />
</div>

<style>
	.scale-practice-session {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
</style>
