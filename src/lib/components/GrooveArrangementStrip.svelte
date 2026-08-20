<script lang="ts">
	import { PATTERN_ROLES, type PatternRole } from '$lib/groove/types';

	interface Props {
		arrangement: PatternRole[];
		activeBarIndex: number | null;
		onAssign: (barIndex: number, role: PatternRole) => void;
		/** Index-aligned with `arrangement` -- the chord backing sounding on each bar, or `null` for "no chord backing." Omitted entirely when there's no progression selected at all. */
		chordLabels?: (string | null)[];
	}

	let { arrangement, activeBarIndex, onAssign, chordLabels }: Props = $props();

	function handleChange(barIndex: number, event: Event): void {
		onAssign(barIndex, (event.currentTarget as HTMLSelectElement).value as PatternRole);
	}
</script>

<div class="arrangement-strip" role="group" aria-label="Groove arrangement">
	{#each arrangement as role, index (index)}
		<label class="bar" class:active={index === activeBarIndex}>
			<span class="bar-number">{index + 1}</span>
			<select
				aria-label={`Bar ${index + 1} pattern`}
				value={role}
				onchange={(event) => handleChange(index, event)}
			>
				{#each PATTERN_ROLES as r (r)}
					<option value={r}>{r}</option>
				{/each}
			</select>
			{#if chordLabels}
				<span class="bar-chord">{chordLabels[index] ?? '—'}</span>
			{/if}
		</label>
	{/each}
</div>

<style>
	.arrangement-strip {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		font-size: 0.65rem;
	}

	.bar-number {
		font-weight: 700;
		opacity: 0.6;
	}

	.bar-chord {
		font-weight: 700;
		font-size: 0.7rem;
		color: var(--nut, #7c3aed);
	}

	.bar select {
		font: inherit;
		font-weight: 700;
		width: 2.6rem;
		padding: 0.25rem 0.15rem;
		text-align: center;
		text-align-last: center;
		border-radius: 6px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
	}

	.bar select:hover {
		border-color: var(--nut, #7c3aed);
	}

	.bar.active select {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 14%, var(--fret-bg, #fff));
	}

	.bar select:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}
</style>
