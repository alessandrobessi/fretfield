<script lang="ts">
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import {
		getScaleDefinition,
		listScales,
		scaleContainsPitchClass,
		scalePitchClasses,
		suggestedScalesFor
	} from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const blocks = $derived(fretfield.progressionScaleBlocks);

	// Same "common to every block" callout Scale Blocks already has
	// (ScaleBlockLegend.svelte), computed locally here since Progression
	// Scales' blocks are auto-derived rather than manually configured.
	const commonNoteNames = $derived.by<string[]>(() => {
		const configured = blocks.filter((b) => b.scaleId !== null);
		if (configured.length < 2) return [];
		const [first, ...rest] = configured;
		const firstPitchClasses = scalePitchClasses(first.root!, getScaleDefinition(first.scaleId!));
		return firstPitchClasses
			.filter((pitchClass) =>
				rest.every(({ root, scaleId }) =>
					scaleContainsPitchClass(root!, getScaleDefinition(scaleId!), pitchClass)
				)
			)
			.map(defaultNoteName);
	});

	function handleScaleChange(chordIndex: number, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setProgressionScaleOverride(chordIndex, value === '' ? null : value);
	}
</script>

<div class="progression-scales">
	{#if blocks.length === 0}
		<p class="empty">Choose a root and a progression to see suggested scales per chord.</p>
	{:else}
		<ul class="blocks">
			{#each blocks as block, index (block.id)}
				{@const suggested = new Set(suggestedScalesFor(block.chordId!).map((s) => s.id))}
				<li class="block">
					<span class="chip" data-block={index} aria-hidden="true">{index + 1}</span>
					<span class="chord-label"
						>{defaultNoteName(block.root!)}{getChordDefinition(block.chordId!).symbol}</span
					>
					<label class="field">
						<span class="field-label">Scale</span>
						<select
							aria-label={`Chord ${index + 1} scale`}
							value={block.scaleId ?? ''}
							onchange={(event) => handleScaleChange(index, event)}
						>
							<option value="">—</option>
							<optgroup label="Suggested">
								{#each suggestedScalesFor(block.chordId!) as scale (scale.id)}
									<option value={scale.id}>{scale.label}</option>
								{/each}
							</optgroup>
							<optgroup label="All scales">
								{#each listScales().filter((s) => !suggested.has(s.id)) as scale (scale.id)}
									<option value={scale.id}>{scale.label}</option>
								{/each}
							</optgroup>
						</select>
					</label>
				</li>
			{/each}
		</ul>
		{#if blocks.length >= 2}
			<p class="common-notes">
				{#if commonNoteNames.length > 0}
					<span class="common-swatch" aria-hidden="true"></span>
					Common to every chord: <strong>{commonNoteNames.join(', ')}</strong>
				{:else}
					No note is in every chord's scale.
				{/if}
			</p>
		{/if}
	{/if}
</div>

<style>
	.progression-scales {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty {
		margin: 0;
		opacity: 0.6;
		font-size: 0.9rem;
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
		border-radius: 50%;
		font-weight: 700;
		font-size: 0.8rem;
		color: #fff;
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

	.chord-label {
		font-weight: 700;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
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

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: pointer;
	}

	select:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.common-notes {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--fret-fg, #241a3d);
	}

	.common-swatch {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		background: var(--scale-block-common, #10b981);
	}
</style>
