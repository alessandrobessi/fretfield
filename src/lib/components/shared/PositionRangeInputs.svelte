<script lang="ts">
	import type { FretRange } from '$lib/music/fret-range';

	interface Props {
		range: FretRange;
		fretCount: number;
		/** Produces `${label} start fret` / `${label} end fret` aria-labels — callers pick a label that fits their own vocabulary ("Zone", "Position", ...). */
		label: string;
		onChange: (range: FretRange) => void;
	}

	let { range, fretCount, label, onChange }: Props = $props();

	function handleMinChange(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		onChange({ minFret: value, maxFret: Math.max(value, range.maxFret) });
	}

	function handleMaxChange(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		onChange({ minFret: Math.min(range.minFret, value), maxFret: value });
	}
</script>

<div class="position-range-inputs">
	<label class="field">
		<span class="field-label">From fret</span>
		<input
			type="number"
			aria-label={`${label} start fret`}
			min="0"
			max={fretCount}
			value={range.minFret}
			onchange={handleMinChange}
		/>
	</label>
	<label class="field">
		<span class="field-label">To fret</span>
		<input
			type="number"
			aria-label={`${label} end fret`}
			min="0"
			max={fretCount}
			value={range.maxFret}
			onchange={handleMaxChange}
		/>
	</label>
</div>

<style>
	.position-range-inputs {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	input[type='number'] {
		font: inherit;
		font-weight: 600;
		width: 4.5rem;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: text;
	}

	input[type='number']:hover {
		border-color: var(--nut, #7c3aed);
	}

	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}
</style>
