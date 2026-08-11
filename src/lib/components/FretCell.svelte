<script lang="ts">
	import type { DisplayFretPosition, DisplayMode } from '$lib/stores/fretfield.svelte';
	import { roleStyleFor } from '$lib/config/roles';

	interface Props {
		position: DisplayFretPosition;
		displayMode: DisplayMode;
		stringName: string;
		onSelect: (position: DisplayFretPosition) => void;
		onInspect: (position: DisplayFretPosition) => void;
	}

	let { position, displayMode, stringName, onSelect, onInspect }: Props = $props();

	// In 'chord-tones' analysis mode, non-chord-tone roles are visually and
	// semantically suppressed back to a plain cell — same analyzed data,
	// different display filter (fretfield.svelte.ts's isVisibleInMode).
	const visibleRole = $derived(position.isVisibleInMode ? position.role : null);
	const roleStyle = $derived(roleStyleFor(visibleRole));

	const label = $derived.by(() => {
		if (position.interval === null) return position.noteName;
		if (displayMode === 'notes') return position.noteName;
		if (displayMode === 'both') return `${position.intervalLabel}\n${position.noteName}`;
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
	data-testid={`fret-${stringName}-${position.fret}`}
	aria-label={ariaLabel}
	aria-pressed={position.isSelectedRootPosition}
	onclick={() => {
		onSelect(position);
		onInspect(position);
	}}
	onfocus={() => onInspect(position)}
	onmouseenter={() => onInspect(position)}
>
	<span class="pill" data-role={visibleRole} data-shape={roleStyle?.shape}>
		<span class="label">{label}</span>
	</span>
</button>

<style>
	.fret-cell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 2.75rem;
		flex: 0 0 auto;
		border: 1px solid var(--fret-border, #ddd3f7);
		border-left: none;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
		font: inherit;
		font-size: 0.7rem;
		padding: 0;
	}

	.fret-cell.open {
		border-left: 3px solid var(--nut, #7c3aed);
	}

	.fret-cell:hover {
		background: var(--fret-bg-hover, #f4effe);
	}

	.fret-cell:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: -3px;
		z-index: 1;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.9rem;
		min-height: 1.9rem;
		padding: 0.15rem 0.35rem;
		border-radius: 999px;
	}

	/* Shape + fill/outline/border-style combine so no role relies on color alone (AGENTS.md §7). */

	.pill[data-shape='star'] {
		/* root */
		background: var(--role-root, #f59e0b);
		color: #fff;
		font-weight: 700;
		box-shadow: 0 1px 4px color-mix(in srgb, var(--role-root, #f59e0b) 60%, transparent);
	}

	.pill[data-shape='circle'] {
		/* structural */
		background: var(--role-structural, #4f46e5);
		color: #fff;
		font-weight: 700;
	}

	.pill[data-shape='ring'] {
		/* stable */
		background: color-mix(in srgb, var(--role-stable, #10b981) 12%, transparent);
		border: 2px solid var(--role-stable, #10b981);
		color: var(--role-stable, #059669);
		font-weight: 600;
	}

	.pill[data-shape='diamond'] {
		/* extension */
		border-radius: 7px;
		background: var(--role-extension, #a855f7);
		color: #fff;
		font-weight: 600;
	}

	.pill[data-shape='square'] {
		/* color */
		border-radius: 7px;
		background: color-mix(in srgb, var(--role-color, #ec4899) 14%, transparent);
		border: 2px solid var(--role-color, #ec4899);
		color: var(--role-color, #ec4899);
		font-weight: 600;
	}

	.pill[data-shape='triangle'] {
		/* tension */
		background: var(--role-tension, #f97316);
		color: #fff;
		font-weight: 600;
		outline: 2px dashed color-mix(in srgb, var(--role-tension, #f97316) 70%, transparent);
		outline-offset: 2px;
	}

	.pill[data-shape='cross'] {
		/* alteration */
		border-radius: 7px;
		background: var(--role-alteration, #ef4444);
		color: #fff;
		font-weight: 600;
		outline: 2px dashed color-mix(in srgb, var(--role-alteration, #ef4444) 70%, transparent);
		outline-offset: 2px;
	}

	.pill[data-shape='dot'] {
		/* chromatic-approach */
		min-width: 1.5rem;
		min-height: 1.5rem;
		background: color-mix(in srgb, var(--role-chromatic-approach, #64748b) 16%, transparent);
		border: 2px dotted var(--role-chromatic-approach, #64748b);
		color: var(--role-chromatic-approach, #64748b);
	}

	.pill[data-shape='outline'] {
		/* avoid */
		border-radius: 7px;
		background: transparent;
		border: 2px dotted var(--role-avoid, #78716c);
		color: var(--role-avoid, #78716c);
		opacity: 0.75;
	}

	.fret-cell.root-pitch {
		font-weight: 700;
	}

	.fret-cell.selected-root {
		box-shadow: inset 0 0 0 3px var(--selected-root-ring, #ec4899);
	}

	.label {
		position: relative;
		white-space: pre-line;
		text-align: center;
		line-height: 1.2;
		font-size: 0.68rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		.fret-cell {
			transition:
				background 120ms ease,
				box-shadow 120ms ease;
		}
	}
</style>
