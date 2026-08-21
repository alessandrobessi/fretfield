<script lang="ts">
	import {
		fretfield,
		type DisplayFretPosition,
		type DisplayMode
	} from '$lib/stores/fretfield.svelte';
	import { roleStyleFor } from '$lib/config/roles';
	import {
		intervalCompoundLabel,
		intervalFromRoot,
		noteNameForPosition
	} from '$lib/music/intervals';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	interface Props {
		position: DisplayFretPosition;
		displayMode: DisplayMode;
		stringName: string;
		rovingPosition: { stringIndex: number; fret: number };
		onSelect: (position: DisplayFretPosition) => void;
		onInspect: (position: DisplayFretPosition) => void;
	}

	let { position, displayMode, stringName, rovingPosition, onSelect, onInspect }: Props = $props();

	// Roving tabindex (see Fretboard.svelte): only the one cell at the
	// board's current roving-focus position is a Tab stop; every other cell
	// is tabindex=-1, reachable via Arrow keys instead of ~70 individual Tab
	// presses.
	const isRovingFocus = $derived(
		rovingPosition.stringIndex === position.stringIndex && rovingPosition.fret === position.fret
	);

	// In 'chord-tones' analysis mode, non-chord-tone roles are visually and
	// semantically suppressed back to a plain cell — same analyzed data,
	// different display filter (fretfield.svelte.ts's isVisibleInMode).
	const visibleRole = $derived(position.isVisibleInMode ? position.role : null);
	const roleStyle = $derived(roleStyleFor(visibleRole));

	const isSamePosition = (p: { stringIndex: number; fret: number }): boolean =>
		p.stringIndex === position.stringIndex && p.fret === position.fret;

	// Scale Practice's own layers: computed locally from the `scalePractice`
	// store, same "independent store, no fretfield.svelte.ts fields" approach.
	// Gated on the mode being active — deliberately NOT on
	// `scalePractice.running`, since the metronome only controls the click;
	// which notes are highlighted is independent of it.
	const isScalePracticeMode = $derived(fretfield.mode === 'scale-practice');
	// Every note of the configured scale, shown at once — not one target at a time.
	const isScalePracticeNote = $derived(
		isScalePracticeMode && scalePractice.scalePositions.some(isSamePosition)
	);
	// Whatever's currently sounding, live — clears the instant Live Input stops detecting a note.
	const isScalePracticeJustPlayed = $derived(
		isScalePracticeMode && scalePractice.playedPositions.some(isSamePosition)
	);
	// The root gets its own color among the scale's notes — same --role-root
	// amber the rest of the app already uses for "root" everywhere else
	// (Chord Field's star pill, the root chip), so the color reads
	// consistently across modes even though Scale Practice has no shared
	// role-classification pill of its own. Keyed against `displayRoot`, not
	// `root` directly -- while a progression chord's scale is showing, this
	// follows that chord's own root (see AGENTS.md), reverting to the
	// practice root the moment no chord-scale is active.
	const isScalePracticeRoot = $derived(
		isScalePracticeMode &&
			scalePractice.displayRoot !== null &&
			position.pitchClass === scalePractice.displayRoot
	);
	// The zone is always defined (a sensible default even before configuring a
	// scale), so dimming applies as soon as the tab is active — it previews
	// where the player is about to practice, not just where they currently are.
	const isScalePracticeZoneDimmed = $derived(
		isScalePracticeMode &&
			(position.fret < scalePractice.zone.minFret || position.fret > scalePractice.zone.maxFret)
	);
	// Scale Practice has exactly one displayed root at a time (unlike Scale
	// Blocks' several), so "interval relative to root" is well-defined here —
	// computed locally against `scalePractice.displayRoot`, never
	// `fretfield.root`, same independent-state reasoning as the layers above.
	// Always shown alongside the note name (not gated on the shared
	// Intervals/Notes/Both toggle) per the specific request: the interval
	// should read in addition to the note name, not instead of it.
	const scalePracticeInterval = $derived(
		isScalePracticeMode && scalePractice.displayRoot !== null
			? intervalFromRoot(scalePractice.displayRoot, position.pitchClass)
			: null
	);
	const scalePracticeNoteName = $derived(
		isScalePracticeMode && scalePractice.displayRoot !== null
			? noteNameForPosition(scalePractice.displayRoot, position.pitchClass)
			: null
	);
	// "R" for the root specifically (not "1") — the one deviation from the
	// app's usual numeric-interval convention, per explicit request.
	const scalePracticeIntervalLabel = $derived(
		scalePracticeInterval === null
			? null
			: scalePracticeInterval === '1'
				? 'R'
				: intervalCompoundLabel(scalePracticeInterval)
	);

	const label = $derived.by(() => {
		if (scalePracticeIntervalLabel !== null && scalePracticeNoteName !== null) {
			return `${scalePracticeIntervalLabel}\n${scalePracticeNoteName}`;
		}
		if (position.interval === null) return position.noteName;
		if (displayMode === 'notes') return position.noteName;
		if (displayMode === 'both') return `${position.intervalLabel}\n${position.noteName}`;
		return position.intervalLabel ?? position.noteName;
	});

	const ariaLabel = $derived.by(() => {
		const parts = [
			`${stringName} string`,
			`fret ${position.fret}`,
			scalePracticeNoteName ?? position.noteName
		];
		if (scalePracticeIntervalLabel !== null) {
			parts.push(`interval ${scalePracticeIntervalLabel}`);
		} else if (position.interval !== null) {
			parts.push(`interval ${position.intervalLabel}`);
		}
		if (roleStyle !== null) parts.push(roleStyle.label.toLowerCase());
		if (position.isLiveLikely) parts.push('currently played');
		else if (position.isLivePlayed) parts.push('possible played position');
		if (isScalePracticeNote) parts.push('in the practiced scale');
		if (isScalePracticeJustPlayed) parts.push('just played');
		return parts.join(', ');
	});
</script>

<button
	type="button"
	class="fret-cell"
	class:open={position.fret === 0}
	class:root-pitch={position.isRootPitchClass}
	class:selected-root={position.isSelectedRootPosition}
	class:live-played={position.isLivePlayed}
	class:live-likely={position.isLiveLikely}
	class:scale-practice-note={isScalePracticeNote}
	class:scale-practice-root={isScalePracticeRoot}
	class:scale-practice-just-played={isScalePracticeJustPlayed}
	class:scale-practice-zone-dimmed={isScalePracticeZoneDimmed}
	data-testid={`fret-${stringName}-${position.fret}`}
	aria-label={ariaLabel}
	aria-pressed={position.isSelectedRootPosition}
	tabindex={isRovingFocus ? 0 : -1}
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
		border: 1px solid var(--fret-border, #3a382f);
		border-left: none;
		background: var(--fret-bg, #262521);
		color: var(--fret-fg, #f1e6c5);
		cursor: pointer;
		font: inherit;
		font-size: 0.7rem;
		padding: 0;
	}

	.fret-cell.open {
		border-left: 3px solid var(--nut, #e3ac18);
	}

	.fret-cell:hover {
		background: var(--fret-bg-hover, #322f28);
	}

	.fret-cell:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
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
		/* root -- black text, not white: root/structural now live in the
		   brand's own yellow family (see the rebrand's "9-role palette
		   preserved" design call), and white-on-yellow fails contrast. */
		background: var(--role-root, #e3ac18);
		color: var(--ff-black, #151411);
		font-weight: 700;
		box-shadow: 0 1px 4px color-mix(in srgb, var(--role-root, #e3ac18) 60%, transparent);
	}

	.pill[data-shape='circle'] {
		/* structural */
		background: var(--role-structural, #c9910d);
		color: var(--ff-black, #151411);
		font-weight: 700;
	}

	.pill[data-shape='ring'] {
		/* stable */
		background: color-mix(in srgb, var(--role-stable, #4fd1a5) 12%, transparent);
		border: 2px solid var(--role-stable, #4fd1a5);
		color: var(--role-stable, #4fd1a5);
		font-weight: 600;
	}

	.pill[data-shape='diamond'] {
		/* extension -- black text: this was under contrast even against the
		   original purple (2.7:1), pre-existing debt fixed while this file
		   was already being touched for the rebrand. */
		border-radius: 7px;
		background: var(--role-extension, #a78bfa);
		color: var(--ff-black, #151411);
		font-weight: 600;
	}

	.pill[data-shape='square'] {
		/* color */
		border-radius: 7px;
		background: color-mix(in srgb, var(--role-color, #f472b6) 14%, transparent);
		border: 2px solid var(--role-color, #f472b6);
		color: var(--role-color, #f472b6);
		font-weight: 600;
	}

	.pill[data-shape='triangle'] {
		/* tension -- black text, same pre-existing contrast fix as diamond above. */
		background: var(--role-tension, #fb923c);
		color: var(--ff-black, #151411);
		font-weight: 600;
		outline: 2px dashed color-mix(in srgb, var(--role-tension, #fb923c) 70%, transparent);
		outline-offset: 2px;
	}

	.pill[data-shape='cross'] {
		/* alteration -- deliberately not red (see app.css): this role would
		   otherwise be visually indistinguishable from Signal Red's "currently
		   sounding" meaning. Black text for contrast, same as the other
		   solid-fill pills above. */
		border-radius: 7px;
		background: var(--role-alteration, #38bdf8);
		color: var(--ff-black, #151411);
		font-weight: 600;
		outline: 2px dashed color-mix(in srgb, var(--role-alteration, #38bdf8) 70%, transparent);
		outline-offset: 2px;
	}

	.pill[data-shape='dot'] {
		/* chromatic-approach */
		min-width: 1.5rem;
		min-height: 1.5rem;
		background: color-mix(in srgb, var(--role-chromatic-approach, #94a3b8) 16%, transparent);
		border: 2px dotted var(--role-chromatic-approach, #94a3b8);
		color: var(--role-chromatic-approach, #94a3b8);
	}

	.pill[data-shape='outline'] {
		/* avoid */
		border-radius: 7px;
		background: transparent;
		border: 2px dotted var(--role-avoid, #a8a29e);
		color: var(--role-avoid, #a8a29e);
		opacity: 0.75;
	}

	.fret-cell.root-pitch {
		font-weight: 700;
	}

	.fret-cell.selected-root {
		box-shadow: inset 0 0 0 3px var(--selected-root-ring, #f1e6c5);
	}

	/*
	 * Live Input layer: an independent ::after pseudo-element rather than
	 * outline/box-shadow on .fret-cell itself, so it never collides with
	 * selected-root's box-shadow — a fret can be structural + a live
	 * candidate at once, and every distinction has to stay visible (product
	 * spec §9/§15).
	 */
	.fret-cell.live-played::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-radius: 6px;
		border: 2px dashed var(--live-accent, #e34832);
		pointer-events: none;
	}

	/*
	 * The single best-match position (as opposed to the wider set of
	 * physically-possible candidates above) gets a bright fill, not just a
	 * border — it's the one actual note being heard right now, so it should
	 * read at a glance rather than require spotting an outline (product
	 * spec §9/§15).
	 */
	.fret-cell.live-likely {
		background: var(--live-accent, #e34832);
	}

	.fret-cell.live-likely:hover {
		background: var(--live-accent-hover, #c93a26);
	}

	.fret-cell.live-likely::after {
		border: 3px solid var(--live-accent-strong, #6d2a22);
	}

	@media (prefers-reduced-motion: no-preference) {
		.fret-cell.live-likely::after {
			animation: live-pulse 700ms ease-out 1;
		}
	}

	@keyframes live-pulse {
		from {
			box-shadow: 0 0 0 6px color-mix(in srgb, var(--live-accent, #e34832) 45%, transparent);
		}
		to {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	/*
	 * Scale Practice: the whole scale is shown at once — every matching fret
	 * gets a soft, permanent tint (not gated on the metronome running at
	 * all), so the player can see the full shape before playing a note.
	 * Yellow family (selected/intentional, per the rebrand's semantic model)
	 * at a restrained 16-24% mix -- deliberately the *dark* yellow shade, one
	 * step down from the root's own full-strength yellow below, so a scale
	 * full of notes doesn't read as "everything is yellow" (spec §6/§25).
	 */
	.fret-cell.scale-practice-note {
		background: color-mix(in srgb, var(--ff-selected, #c9910d) 16%, var(--fret-bg, #262521));
	}

	.fret-cell.scale-practice-note:hover {
		background: color-mix(in srgb, var(--ff-selected, #c9910d) 24%, var(--fret-bg, #262521));
	}

	/* Bold is a second, non-color signal for scale membership (AGENTS.md §7) — the tint alone shouldn't have to carry it. */
	.fret-cell.scale-practice-note .label {
		font-weight: 700;
	}

	/*
	 * The root gets its own color, distinct from the rest of the scale —
	 * same --role-root amber the app already uses for "root" everywhere else
	 * (Chord Field's star pill, the root chip). Same-specificity selector
	 * placed after .scale-practice-note above, so it wins on source order
	 * for the one fret that's both. The "R" label (scalePracticeIntervalLabel)
	 * and bold weight are the non-color signals already carrying this
	 * distinction (AGENTS.md §7) — color is a third, reinforcing one, not the
	 * only one.
	 */
	.fret-cell.scale-practice-root {
		background: color-mix(in srgb, var(--role-root, #e3ac18) 20%, var(--fret-bg, #262521));
	}

	.fret-cell.scale-practice-root:hover {
		background: color-mix(in srgb, var(--role-root, #e3ac18) 30%, var(--fret-bg, #262521));
	}

	/*
	 * Scale Practice: whatever's currently sounding gets its own ring, live,
	 * independent of the metronome — box-shadow rather than a pseudo-element
	 * or a 3rd background layer, matching `.selected-root`'s own approach,
	 * so it composes with the scale tint above (a background + a ring) even
	 * though it can't compose with every other box-shadow-based state at
	 * once (an accepted, pre-existing limitation — see `.selected-root`).
	 */
	.fret-cell.scale-practice-just-played {
		box-shadow: inset 0 0 0 3px var(--live-accent, #e34832);
	}

	.fret-cell.scale-practice-zone-dimmed .pill {
		opacity: 0.35;
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
