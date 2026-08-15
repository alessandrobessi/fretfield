<script lang="ts">
	import { listChords } from '$lib/music/chords';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { listScales, suggestedScalesFor } from '$lib/music/scales';
	import { MAX_CHORD_BLOCKS, fretfield, type ChordBlock } from '$lib/stores/fretfield.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);

	function suggestedScaleIdSet(block: ChordBlock): Set<string> {
		if (block.chordId === null) return new Set();
		return new Set(suggestedScalesFor(block.chordId).map((scale) => scale.id));
	}

	function handleRootChange(block: ChordBlock, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setChordBlockRoot(block.id, value === '' ? null : (Number(value) as PitchClass));
	}

	function handleChordChange(block: ChordBlock, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setChordBlockChord(block.id, value === '' ? null : value);
	}

	function handleScaleChange(block: ChordBlock, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		fretfield.setChordBlockScale(block.id, value === '' ? null : value);
	}
</script>

<div class="scale-block-controls">
	<div class="header">
		<span class="field-label">Scale Blocks</span>
		<button
			type="button"
			class="add"
			disabled={fretfield.chordBlocks.length >= MAX_CHORD_BLOCKS}
			onclick={() => fretfield.addChordBlock()}
		>
			+ Add block
		</button>
	</div>

	{#if fretfield.chordBlocks.length === 0}
		<p class="empty">Add a block, then choose its root, chord, and a scale that fits it.</p>
	{:else}
		<ol class="blocks">
			{#each fretfield.chordBlocks as block, index (block.id)}
				{@const suggested = suggestedScaleIdSet(block)}
				<li class="block">
					<span class="badge" data-block={index} aria-hidden="true">{index + 1}</span>
					<label class="field">
						<span class="field-label">Root</span>
						<select
							aria-label={`Block ${index + 1} root`}
							value={block.root ?? ''}
							onchange={(event) => handleRootChange(block, event)}
						>
							<option value="">—</option>
							{#each ALL_ROOTS as pitchClass (pitchClass)}
								<option value={pitchClass}>{defaultNoteName(pitchClass)}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Chord</span>
						<select
							aria-label={`Block ${index + 1} chord`}
							value={block.chordId ?? ''}
							onchange={(event) => handleChordChange(block, event)}
						>
							<option value="">—</option>
							{#each listChords() as chord (chord.id)}
								<option value={chord.id}>{chord.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Scale</span>
						<select
							aria-label={`Block ${index + 1} scale`}
							value={block.scaleId ?? ''}
							onchange={(event) => handleScaleChange(block, event)}
						>
							<option value="">—</option>
							{#if block.chordId !== null}
								<optgroup label="Suggested">
									{#each suggestedScalesFor(block.chordId) as scale (scale.id)}
										<option value={scale.id}>{scale.label}</option>
									{/each}
								</optgroup>
								<optgroup label="All scales">
									{#each listScales().filter((scale) => !suggested.has(scale.id)) as scale (scale.id)}
										<option value={scale.id}>{scale.label}</option>
									{/each}
								</optgroup>
							{:else}
								{#each listScales() as scale (scale.id)}
									<option value={scale.id}>{scale.label}</option>
								{/each}
							{/if}
						</select>
					</label>
					<button
						type="button"
						class="remove"
						onclick={() => fretfield.removeChordBlock(block.id)}
						aria-label={`Remove block ${index + 1}`}
					>
						×
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.scale-block-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	.add {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--nut, #7c3aed);
		background: transparent;
		color: var(--nut, #7c3aed);
		cursor: pointer;
	}

	.add:disabled {
		opacity: 0.4;
		cursor: not-allowed;
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
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.badge {
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
		margin-bottom: 0.35rem;
	}

	.badge[data-block='0'] {
		background: var(--scale-block-1, #3b82f6);
	}

	.badge[data-block='1'] {
		background: var(--scale-block-2, #f43f5e);
	}

	.badge[data-block='2'] {
		background: var(--scale-block-3, #eab308);
	}

	.badge[data-block='3'] {
		background: var(--scale-block-4, #8b5cf6);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
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

	.remove {
		font: inherit;
		font-size: 1.1rem;
		line-height: 1;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		border: 1px solid var(--fret-border, #ddd3f7);
		background: transparent;
		color: var(--role-alteration, #ef4444);
		cursor: pointer;
		margin-bottom: 0.15rem;
	}

	.remove:hover {
		border-color: var(--role-alteration, #ef4444);
	}
</style>
