<script lang="ts">
	import type { DisplayFretPosition, DisplayMode } from '$lib/stores/fretfield.svelte';
	import FretCell from './FretCell.svelte';

	interface Props {
		stringName: string;
		positions: DisplayFretPosition[];
		displayMode: DisplayMode;
		rovingPosition: { stringIndex: number; fret: number };
		onSelect: (position: DisplayFretPosition) => void;
		onInspect: (position: DisplayFretPosition) => void;
	}

	let { stringName, positions, displayMode, rovingPosition, onSelect, onInspect }: Props = $props();
</script>

<div class="bass-string" role="row" aria-label={`${stringName} string`}>
	<span class="string-label" aria-hidden="true">{stringName}</span>
	{#each positions as position (position.fret)}
		<FretCell {position} {displayMode} {stringName} {rovingPosition} {onSelect} {onInspect} />
	{/each}
</div>

<style>
	.bass-string {
		display: flex;
	}

	.string-label {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		flex: 0 0 auto;
		font-weight: 700;
		color: var(--nut, #7c3aed);
		font-size: 0.85rem;
	}
</style>
