<script lang="ts">
	import type { DisplayFretPosition, DisplayMode } from '$lib/stores/fretfield.svelte';
	import { roleStyleFor } from '$lib/config/roles';

	interface Props {
		position: DisplayFretPosition;
		displayMode: DisplayMode;
		stringName: string;
		onSelect: (position: DisplayFretPosition) => void;
	}

	let { position, displayMode, stringName, onSelect }: Props = $props();

	const roleStyle = $derived(roleStyleFor(position.role));

	const label = $derived.by(() => {
		if (position.interval === null) return position.noteName;
		if (displayMode === 'notes') return position.noteName;
		if (displayMode === 'both') return `${position.intervalLabel} · ${position.noteName}`;
		return position.intervalLabel ?? position.noteName;
	});

	const ariaLabel = $derived.by(() => {
		const parts = [`${stringName} string`, `fret ${position.fret}`, position.noteName];
		if (position.interval !== null) parts.push(`interval ${position.intervalLabel}`);
		if (roleStyle !== null) parts.push(roleStyle.label.toLowerCase());
		return parts.join(', ');
	});
</script>

<button
	type="button"
	class="fret-cell"
	class:open={position.fret === 0}
	class:root-pitch={position.isRootPitchClass}
	class:selected-root={position.isSelectedRootPosition}
	data-role={position.role}
	data-shape={roleStyle?.shape}
	aria-label={ariaLabel}
	aria-pressed={position.isSelectedRootPosition}
	onclick={() => onSelect(position)}
>
	{#if roleStyle}
		<span class="role-indicator" data-shape={roleStyle.shape} aria-hidden="true"></span>
	{/if}
	<span class="label">{label}</span>
</button>

<style>
	.fret-cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		border: 1px solid var(--fret-border, #3a3a3a);
		border-left: none;
		background: var(--fret-bg, #1c1c1c);
		color: var(--fret-fg, #ddd);
		cursor: pointer;
		font: inherit;
		font-size: 0.7rem;
		padding: 0;
	}

	.fret-cell.open {
		border-left: 3px solid var(--nut, #888);
	}

	.fret-cell:hover {
		background: var(--fret-bg-hover, #262626);
	}

	.fret-cell:focus-visible {
		outline: 3px solid var(--focus-ring, #4da3ff);
		outline-offset: -3px;
		z-index: 1;
	}

	.role-indicator {
		position: absolute;
		inset: 0.3rem;
		border-radius: 2px;
		opacity: 0.35;
	}

	.fret-cell[data-role='root'] .role-indicator {
		background: var(--role-root, #e0b400);
		opacity: 0.9;
		border-radius: 50%;
	}

	.fret-cell[data-role='structural'] .role-indicator {
		background: var(--role-structural, #3b82f6);
		border-radius: 50%;
	}

	.fret-cell[data-role='stable'] .role-indicator {
		background: transparent;
		border: 2px solid var(--role-stable, #22c55e);
		border-radius: 50%;
	}

	.fret-cell.root-pitch {
		font-weight: 700;
	}

	.fret-cell.selected-root {
		box-shadow: inset 0 0 0 2px var(--selected-root-ring, #fff);
	}

	.label {
		position: relative;
		z-index: 1;
		white-space: pre;
		text-align: center;
		line-height: 1;
	}

	@media (prefers-reduced-motion: no-preference) {
		.fret-cell {
			transition:
				background 120ms ease,
				box-shadow 120ms ease;
		}
	}
</style>
