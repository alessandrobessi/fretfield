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
	import { practice } from '$lib/stores/practice.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

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

	const isSamePosition = (p: { stringIndex: number; fret: number }): boolean =>
		p.stringIndex === position.stringIndex && p.fret === position.fret;

	// Guided Practice's hint layer (§11): a target only ever lights up the
	// fretboard at 'positions' hint level — 'hidden'/'interval' keep the
	// prompt purely conceptual, so `practice.targetPositions` is already
	// empty at those levels (see stores/practice.svelte.ts).
	const isPracticeTarget = $derived(practice.targetPositions.some(isSamePosition));

	// Guided Practice's result layer (§9): only the fret(s) that could have
	// produced the just-played note get a result marker, and only while
	// feedback is actually showing.
	const practiceResult = $derived.by(() =>
		practice.lastPlayedPositions.some(isSamePosition) ? practice.lastResult : null
	);

	// Scale Practice's own layers: computed locally from the `scalePractice`
	// store, same "independent store, no fretfield.svelte.ts fields" approach
	// Guided Practice already uses above. Gated on the mode being active —
	// deliberately NOT on `scalePractice.running`, since the metronome only
	// controls the click; which notes are highlighted is independent of it.
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
	// role-classification pill of its own.
	const isScalePracticeRoot = $derived(
		isScalePracticeMode && scalePractice.root !== null && position.pitchClass === scalePractice.root
	);
	// The zone is always defined (a sensible default even before configuring a
	// scale), so dimming applies as soon as the tab is active — it previews
	// where the player is about to practice, not just where they currently are.
	const isScalePracticeZoneDimmed = $derived(
		isScalePracticeMode &&
			(position.fret < scalePractice.zone.minFret || position.fret > scalePractice.zone.maxFret)
	);
	// Scale Practice has exactly one root (unlike Scale Blocks' several), so
	// "interval relative to root" is well-defined here — computed locally
	// against `scalePractice.root`, never `fretfield.root`, same
	// independent-state reasoning as the layers above. Always shown
	// alongside the note name (not gated on the shared Intervals/Notes/Both
	// toggle) per the specific request: the interval should read in
	// addition to the note name, not instead of it.
	const scalePracticeInterval = $derived(
		isScalePracticeMode && scalePractice.root !== null
			? intervalFromRoot(scalePractice.root, position.pitchClass)
			: null
	);
	const scalePracticeNoteName = $derived(
		isScalePracticeMode && scalePractice.root !== null
			? noteNameForPosition(scalePractice.root, position.pitchClass)
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
		if (position.pathRole === 'current') parts.push('current path step');
		else if (position.pathRole === 'previous') parts.push('previous path step');
		else if (position.pathRole === 'next') parts.push('next path step');
		if (position.isLiveLikely) parts.push('currently played');
		else if (position.isLivePlayed) parts.push('possible played position');
		if (position.isLiveNextTarget) parts.push('best resolution target');
		if (isPracticeTarget) parts.push('practice target');
		if (practiceResult !== null && practiceResult !== 'ignored') {
			parts.push(`practice result: ${practiceResult.replace('-', ' ')}`);
		}
		if (position.scaleBlockMembership.length > 0) {
			parts.push(
				`in scale for block ${position.scaleBlockMembership.map((i) => i + 1).join(', block ')}`
			);
		}
		if (position.isScaleBlockCommonNote) parts.push('common to every block');
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
	class:region-active={position.isInActiveRegion === true}
	class:region-dimmed={position.isInActiveRegion === false}
	class:live-played={position.isLivePlayed}
	class:live-likely={position.isLiveLikely}
	class:live-next-target={position.isLiveNextTarget}
	class:practice-target={isPracticeTarget}
	class:scale-block-common={position.isScaleBlockCommonNote}
	class:scale-practice-note={isScalePracticeNote}
	class:scale-practice-root={isScalePracticeRoot}
	class:scale-practice-just-played={isScalePracticeJustPlayed}
	class:scale-practice-zone-dimmed={isScalePracticeZoneDimmed}
	data-path-role={position.pathRole}
	data-practice-result={practiceResult}
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
	{#if isPracticeTarget}
		<span class="practice-target-marker" aria-hidden="true"></span>
	{/if}
	{#if practiceResult !== null && practiceResult !== 'ignored'}
		<span class="practice-result-marker" data-result={practiceResult} aria-hidden="true"></span>
	{/if}
	<span class="pill" data-role={visibleRole} data-shape={roleStyle?.shape}>
		<span class="label">{label}</span>
	</span>
	{#if position.scaleBlockMembership.length > 0}
		<div class="scale-block-chips" aria-hidden="true">
			{#each position.scaleBlockMembership as blockIndex (blockIndex)}
				<span class="chip" data-block={blockIndex}>{blockIndex + 1}</span>
			{/each}
		</div>
	{/if}
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

	.fret-cell.region-active {
		background: color-mix(in srgb, var(--nut, #7c3aed) 8%, var(--fret-bg, #fff));
	}

	.fret-cell.region-active:hover {
		background: color-mix(in srgb, var(--nut, #7c3aed) 14%, var(--fret-bg, #fff));
	}

	.fret-cell.region-dimmed .pill {
		opacity: 0.35;
	}

	.fret-cell[data-path-role='current'] {
		box-shadow: 0 0 0 3px var(--nut, #7c3aed);
		z-index: 1;
	}

	.fret-cell[data-path-role='previous'] {
		outline: 2px dashed color-mix(in srgb, var(--nut, #7c3aed) 45%, transparent);
		outline-offset: -2px;
	}

	.fret-cell[data-path-role='next'] {
		outline: 2px dotted color-mix(in srgb, var(--nut, #7c3aed) 65%, transparent);
		outline-offset: -2px;
	}

	/*
	 * Live Input layer: an independent ::after pseudo-element rather than
	 * outline/box-shadow on .fret-cell itself, so it never collides with
	 * pathRole's outline or selected-root's box-shadow — a fret can be
	 * structural + a path step + a live candidate all at once, and every
	 * distinction has to stay visible (product spec §9/§15).
	 */
	.fret-cell.live-played::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-radius: 6px;
		border: 2px dashed var(--live-accent, #06b6d4);
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
		background: var(--live-accent, #06b6d4);
	}

	.fret-cell.live-likely:hover {
		background: var(--live-accent-hover, #0891b2);
	}

	.fret-cell.live-likely::after {
		border: 3px solid var(--live-accent-strong, #0e7490);
	}

	@media (prefers-reduced-motion: no-preference) {
		.fret-cell.live-likely::after {
			animation: live-pulse 700ms ease-out 1;
		}
	}

	@keyframes live-pulse {
		from {
			box-shadow: 0 0 0 6px color-mix(in srgb, var(--live-accent, #06b6d4) 45%, transparent);
		}
		to {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	/*
	 * Progression Field's "where this note wants to go" layer (§13) — a
	 * separate ::before pseudo-element so it composes independently of the
	 * ::after played/likely ring above and of .selected-root's box-shadow.
	 */
	.fret-cell.live-next-target::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--live-target-accent, #10b981);
		pointer-events: none;
	}

	/*
	 * Guided Practice layers: real (aria-hidden) elements rather than more
	 * pseudo-elements — ::before/::after are already spoken for by the Live
	 * Input layers above, and a fret can be a target AND show a result AND
	 * be a live-played candidate all at once (product spec §10).
	 */
	.practice-target-marker {
		position: absolute;
		inset: 3px;
		border-radius: 6px;
		border: 2px dashed var(--practice-target-accent, #10b981);
		pointer-events: none;
	}

	.practice-result-marker {
		position: absolute;
		inset: 1px;
		border-radius: 8px;
		pointer-events: none;
	}

	.practice-result-marker[data-result='exact'],
	.practice-result-marker[data-result='strong-alternative'] {
		border: 3px solid var(--practice-correct-accent, #10b981);
	}

	.practice-result-marker[data-result='valid-alternative'] {
		border: 3px solid var(--practice-caution-accent, #eab308);
	}

	/* Restrained on purpose (product spec §10/§21): no red flash, just a calm, dismissable outline. */
	.practice-result-marker[data-result='incorrect'] {
		border: 2px dashed var(--practice-incorrect-accent, #94a3b8);
	}

	@media (prefers-reduced-motion: no-preference) {
		.practice-result-marker[data-result='exact'],
		.practice-result-marker[data-result='strong-alternative'] {
			animation: live-pulse 700ms ease-out 1;
		}
	}

	/*
	 * Scale Blocks: a note shared by every configured block's scale gets a
	 * bright fill of its own, distinct from any single block's chip color
	 * (blue/rose/amber/violet) so it reads as "common to all", not "in one
	 * more block". The numbered chips still show underneath/around it —
	 * this never replaces that per-block detail, only adds to it.
	 */
	.fret-cell.scale-block-common {
		background: var(--scale-block-common, #10b981);
	}

	.fret-cell.scale-block-common:hover {
		background: var(--scale-block-common-hover, #059669);
	}

	/*
	 * Scale Blocks: a small row of numbered chips, one per matching block —
	 * a real element (not a 3rd/4th pseudo-element) since ::before/::after
	 * are already spoken for above, and a fret can belong to several blocks'
	 * scales at once. The digit itself (not just color) identifies the
	 * block, per AGENTS.md §7's non-color-signal rule. Wraps onto a second
	 * row past 4 chips — up to `MAX_CHORD_BLOCKS` (8) can theoretically
	 * stack on one fret at once.
	 */
	.scale-block-chips {
		position: absolute;
		bottom: 2px;
		left: 2px;
		right: 2px;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1px;
		pointer-events: none;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.72rem;
		height: 0.72rem;
		border-radius: 50%;
		font-size: 0.48rem;
		font-weight: 700;
		color: #fff;
		line-height: 1;
	}

	.chip[data-block='0'] {
		background: var(--scale-block-1, #3b82f6);
	}

	.chip[data-block='1'] {
		background: var(--scale-block-2, #f43f5e);
	}

	.chip[data-block='2'] {
		background: var(--scale-block-3, #eab308);
	}

	.chip[data-block='3'] {
		background: var(--scale-block-4, #8b5cf6);
	}

	.chip[data-block='4'] {
		background: var(--scale-block-5, #14b8a6);
	}

	.chip[data-block='5'] {
		background: var(--scale-block-6, #84cc16);
	}

	.chip[data-block='6'] {
		background: var(--scale-block-7, #d946ef);
	}

	.chip[data-block='7'] {
		background: var(--scale-block-8, #0ea5e9);
	}

	/*
	 * Scale Practice: the whole scale is shown at once — every matching fret
	 * gets a soft, permanent tint (not gated on the metronome running at
	 * all), so the player can see the full shape before playing a note.
	 */
	.fret-cell.scale-practice-note {
		background: color-mix(in srgb, var(--scale-practice-note, #6366f1) 16%, var(--fret-bg, #fff));
	}

	.fret-cell.scale-practice-note:hover {
		background: color-mix(in srgb, var(--scale-practice-note, #6366f1) 24%, var(--fret-bg, #fff));
	}

	/* Bold is a second, non-color signal for scale membership (AGENTS.md §7) — the tint alone shouldn't have to carry it. */
	.fret-cell.scale-practice-note .label {
		font-weight: 700;
	}

	/*
	 * The root gets its own color, distinct from the rest of the scale —
	 * same --role-root amber the app already uses for "root" everywhere else
	 * (Chord Field's star pill, the root chip in HarmonyControls/
	 * ProgressionWorkspace). Same-specificity selector placed after
	 * .scale-practice-note above, so it wins on source order for the one
	 * fret that's both. The "R" label (scalePracticeIntervalLabel) and bold
	 * weight are the non-color signals already carrying this distinction
	 * (AGENTS.md §7) — color is a third, reinforcing one, not the only one.
	 */
	.fret-cell.scale-practice-root {
		background: color-mix(in srgb, var(--role-root, #f59e0b) 20%, var(--fret-bg, #fff));
	}

	.fret-cell.scale-practice-root:hover {
		background: color-mix(in srgb, var(--role-root, #f59e0b) 30%, var(--fret-bg, #fff));
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
		box-shadow: inset 0 0 0 3px var(--live-accent, #06b6d4);
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
