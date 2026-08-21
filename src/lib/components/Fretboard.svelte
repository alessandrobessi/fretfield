<script lang="ts">
	import { fretfield, type DisplayFretPosition } from '$lib/stores/fretfield.svelte';
	import BassString from './BassString.svelte';

	const STRING_NAMES = ['E', 'A', 'D', 'G'];
	const SINGLE_MARKER_FRETS = new Set([3, 5, 7, 9, 15, 17, 19]);
	const DOUBLE_MARKER_FRETS = new Set([12]);

	const frets = $derived(Array.from({ length: fretfield.fretCount + 1 }, (_, fret) => fret));
	// Render high string (G) at the top, matching conventional tab/fretboard diagrams.
	const stringIndexesTopToBottom = $derived(
		Array.from({ length: fretfield.tuning.length }, (_, i) => fretfield.tuning.length - 1 - i)
	);

	// Roving-tabindex position (AGENTS.md §17 / roadmap Phase 20's "keyboard
	// fret navigation"): the fretboard's 84 frets were previously all
	// individually Tab-focusable, costing up to ~70 Tab presses to reach a
	// distant fret with no 2D relationship between them for a keyboard user.
	// Only the cell at this position gets tabindex=0 (see FretCell.svelte);
	// every other cell is tabindex=-1, so Tab enters/exits the whole board in
	// one stop each way, matching the same convention the six radiogroup/
	// tablist controls elsewhere in the app already use. Arrow keys move
	// this position (clamped at the board's edges, not wrapped -- this is a
	// spatial neck layout, not a cyclic option list); clicking/Enter-
	// activating any fret also syncs it, so keyboard navigation always
	// resumes from wherever the user last actually interacted.
	let rovingPosition = $state<{ stringIndex: number; fret: number }>({
		// fretfield.tuning is a readonly class property (never reassigned after
		// construction), so tuning.length - 1 is safe to read once here rather
		// than through the reactive stringIndexesTopToBottom derived above.
		stringIndex: fretfield.selectedRootPosition?.stringIndex ?? fretfield.tuning.length - 1,
		fret: fretfield.selectedRootPosition?.fret ?? 0
	});

	function handleSelect(position: DisplayFretPosition): void {
		rovingPosition = { stringIndex: position.stringIndex, fret: position.fret };
		fretfield.selectRoot(position);
	}

	function focusCell(stringIndex: number, fret: number, container: HTMLElement): void {
		const stringName = STRING_NAMES[stringIndex];
		container
			.querySelector<HTMLButtonElement>(`[data-testid="fret-${stringName}-${fret}"]`)
			?.focus();
	}

	function handleKeydown(event: KeyboardEvent): void {
		const maxStringIndex = fretfield.tuning.length - 1;
		let { stringIndex, fret } = rovingPosition;

		if (event.key === 'ArrowRight') {
			fret = Math.min(fretfield.fretCount, fret + 1);
		} else if (event.key === 'ArrowLeft') {
			fret = Math.max(0, fret - 1);
		} else if (event.key === 'ArrowUp') {
			// Visually up = toward the G string, the highest stringIndex (see
			// stringIndexesTopToBottom above).
			stringIndex = Math.min(maxStringIndex, stringIndex + 1);
		} else if (event.key === 'ArrowDown') {
			stringIndex = Math.max(0, stringIndex - 1);
		} else {
			return;
		}

		event.preventDefault();
		rovingPosition = { stringIndex, fret };
		focusCell(stringIndex, fret, event.currentTarget as HTMLElement);
	}
</script>

<div class="fretboard-scroll">
	<!--
		Standard roving-tabindex event delegation: the actual interactive
		elements are the FretCell buttons inside (each already
		keyboard-operable on its own); this container only relays their
		bubbled keydown to move which one is the roving Tab stop -- exactly
		the pattern the WAI-ARIA APG's own grid examples use at the grid
		container level. Svelte's static a11y check can't distinguish this
		from a genuine misuse of a non-interactive role, hence the ignore.
	-->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fretboard"
		role="group"
		aria-label="Bass fretboard, E A D G tuning"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		<div class="fret-row markers" aria-hidden="true">
			<span class="row-spacer"></span>
			{#each frets as fret (fret)}
				<span class="fret-cell-slot">
					{#if SINGLE_MARKER_FRETS.has(fret)}
						<span class="marker-dot"></span>
					{:else if DOUBLE_MARKER_FRETS.has(fret)}
						<span class="marker-dot"></span><span class="marker-dot"></span>
					{/if}
				</span>
			{/each}
		</div>
		{#each stringIndexesTopToBottom as stringIndex (stringIndex)}
			<BassString
				stringName={STRING_NAMES[stringIndex]}
				positions={fretfield.positionsByString[stringIndex]}
				displayMode={fretfield.displayMode}
				{rovingPosition}
				onSelect={handleSelect}
				onInspect={(position) => fretfield.inspect(position)}
			/>
		{/each}
		<div class="fret-row numbers" aria-hidden="true">
			<span class="row-spacer"></span>
			{#each frets as fret (fret)}
				<span
					class="fret-cell-slot"
					class:marker-fret={SINGLE_MARKER_FRETS.has(fret) || DOUBLE_MARKER_FRETS.has(fret)}
				>
					{fret}
				</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.fretboard-scroll {
		overflow-x: auto;
		max-width: 100%;
	}

	.fretboard {
		display: inline-flex;
		flex-direction: column;
		background: var(--fretboard-bg, #1c1a16);
		padding: 0.5rem 0;
		border-radius: var(--ff-radius-panel, 8px);
	}

	.fret-row {
		display: flex;
	}

	.fret-row.numbers {
		padding-top: 0.35rem;
	}

	.row-spacer {
		width: 2rem;
		flex: 0 0 auto;
	}

	.fret-cell-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		width: 3.25rem;
		flex: 0 0 auto;
		height: 1rem;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--fret-number, #89877f);
	}

	.fret-cell-slot.marker-fret {
		font-weight: 700;
		color: var(--nut, #e3ac18);
	}

	.marker-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--fret-marker, #89877f);
	}
</style>
