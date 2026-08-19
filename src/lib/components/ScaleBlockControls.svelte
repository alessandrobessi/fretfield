<script lang="ts">
	import { listChords } from '$lib/music/chords';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { listScales, suggestedScalesFor } from '$lib/music/scales';
	import { MAX_CHORD_BLOCKS, fretfield, type ChordBlock } from '$lib/stores/fretfield.svelte';
	import { savedScaleMaps } from '$lib/stores/saved-scale-maps.svelte';
	import type { SavedItem } from '$lib/stores/saved-collection.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);

	// A block only meaningfully contributes to the fretboard once root/chord/
	// scale are all set (see ChordBlock's own doc comment) — saving is only
	// offered once at least one block has actually reached that state.
	const canSave = $derived(
		fretfield.chordBlocks.some(
			(block) => block.root !== null && block.chordId !== null && block.scaleId !== null
		)
	);

	let savingAs = $state(false);
	let newMapName = $state('');
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function startSaving(): void {
		savingAs = true;
		newMapName = '';
	}

	function confirmSave(): void {
		const name = newMapName.trim();
		if (!name) return;
		savedScaleMaps.save(name, fretfield.chordBlocks);
		savingAs = false;
	}

	function cancelSaving(): void {
		savingAs = false;
	}

	function startRenaming(item: SavedItem<ChordBlock[]>): void {
		renamingId = item.id;
		renameValue = item.name;
	}

	function confirmRename(id: string): void {
		const name = renameValue.trim();
		if (!name) return;
		savedScaleMaps.rename(id, name);
		renamingId = null;
	}

	function cancelRenaming(): void {
		renamingId = null;
	}

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
		<span class="field-label">Custom Scale Map</span>
		<div class="header-actions">
			{#if savingAs}
				<input
					class="name-input"
					type="text"
					placeholder="Name this scale map…"
					aria-label="Scale map name"
					bind:value={newMapName}
					onkeydown={(e) => e.key === 'Enter' && confirmSave()}
				/>
				<button
					type="button"
					class="save-confirm"
					onclick={confirmSave}
					disabled={!newMapName.trim()}
				>
					Save
				</button>
				<button type="button" class="save-cancel" onclick={cancelSaving}>Cancel</button>
			{:else}
				<button type="button" class="save-as" disabled={!canSave} onclick={startSaving}>
					Save as…
				</button>
			{/if}
			<button
				type="button"
				class="add"
				disabled={fretfield.chordBlocks.length >= MAX_CHORD_BLOCKS}
				onclick={() => fretfield.addChordBlock()}
			>
				+ Add block
			</button>
		</div>
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

	{#if savedScaleMaps.items.length > 0}
		<div class="saved-list">
			<span class="field-label">My Scale Maps</span>
			<ul class="saved-items">
				{#each savedScaleMaps.items as item (item.id)}
					<li class="saved-item">
						{#if renamingId === item.id}
							<input
								class="name-input"
								type="text"
								aria-label="Rename scale map"
								bind:value={renameValue}
								onkeydown={(e) => e.key === 'Enter' && confirmRename(item.id)}
							/>
							<button
								type="button"
								onclick={() => confirmRename(item.id)}
								disabled={!renameValue.trim()}>Save</button
							>
							<button type="button" onclick={cancelRenaming}>Cancel</button>
						{:else}
							<span class="saved-name">{item.name}</span>
							<button type="button" onclick={() => fretfield.loadChordBlocks(item.data)}
								>Load</button
							>
							<button type="button" onclick={() => startRenaming(item)}>Rename</button>
							<button
								type="button"
								class="remove"
								aria-label={`Delete ${item.name}`}
								onclick={() => savedScaleMaps.remove(item.id)}
							>
								×
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
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
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.name-input {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
	}

	.name-input:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.save-as,
	.save-confirm,
	.save-cancel,
	.saved-item button {
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

	.save-as:disabled,
	.save-confirm:disabled,
	.saved-item button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.save-as:focus-visible,
	.save-confirm:focus-visible,
	.save-cancel:focus-visible,
	.saved-item button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.saved-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.saved-items {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.saved-item {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.saved-name {
		font-weight: 600;
		font-size: 0.85rem;
		flex: 1 1 auto;
	}

	.saved-item .remove {
		border-color: var(--fret-border, #ddd3f7);
		color: var(--role-alteration, #ef4444);
	}

	.saved-item .remove:hover {
		border-color: var(--role-alteration, #ef4444);
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

	.add:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
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

	.badge[data-block='4'] {
		background: var(--scale-block-5, #14b8a6);
	}

	.badge[data-block='5'] {
		background: var(--scale-block-6, #84cc16);
	}

	.badge[data-block='6'] {
		background: var(--scale-block-7, #d946ef);
	}

	.badge[data-block='7'] {
		background: var(--scale-block-8, #0ea5e9);
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

	.remove:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}
</style>
