<script lang="ts">
	import { listChords } from '$lib/music/chords';
	import { ALL_INTERVALS, intervalLabel, type IntervalId } from '$lib/music/intervals';
	import type { ProgressionDegree, ProgressionTemplate } from '$lib/music/progressions';
	import type { SavedItem } from '$lib/stores/saved-collection.svelte';
	import { savedProgressions } from '$lib/stores/saved-progressions.svelte';

	let degrees = $state<ProgressionDegree[]>([{ fromTonic: '1', chordId: 'major' }]);
	let name = $state('');
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	const canSave = $derived(degrees.length > 0 && name.trim().length > 0);

	function addDegree(): void {
		degrees = [...degrees, { fromTonic: '1', chordId: 'major' }];
	}

	function removeDegree(index: number): void {
		degrees = degrees.filter((_, i) => i !== index);
	}

	function setDegreeInterval(index: number, fromTonic: IntervalId): void {
		degrees = degrees.map((degree, i) => (i === index ? { ...degree, fromTonic } : degree));
	}

	function setDegreeChord(index: number, chordId: string): void {
		degrees = degrees.map((degree, i) => (i === index ? { ...degree, chordId } : degree));
	}

	function confirmSave(): void {
		if (!canSave) return;
		const trimmed = name.trim();
		// `id`/`mode` only exist to satisfy ProgressionTemplate's shape — never
		// read: lookup is by the SavedItem wrapper's own id (see
		// resolveProgressionTemplate), and 'major' is just the curated list's
		// own display-grouping tag, not something buildProgression consults.
		const template: ProgressionTemplate = {
			id: crypto.randomUUID(),
			label: trimmed,
			mode: 'major',
			degrees
		};
		savedProgressions.save(trimmed, template);
		degrees = [{ fromTonic: '1', chordId: 'major' }];
		name = '';
	}

	function startRenaming(item: SavedItem<ProgressionTemplate>): void {
		renamingId = item.id;
		renameValue = item.name;
	}

	function confirmRename(id: string): void {
		const trimmed = renameValue.trim();
		if (!trimmed) return;
		savedProgressions.rename(id, trimmed);
		renamingId = null;
	}

	function cancelRenaming(): void {
		renamingId = null;
	}
</script>

<div class="progression-builder">
	<span class="field-label">Build your own progression</span>
	<p class="hint">
		Each step is an interval from the tonic (the root you'll pick when you use this progression)
		plus a chord quality.
	</p>

	<ol class="degrees">
		{#each degrees as degree, index (index)}
			<li class="degree">
				<span class="badge" aria-hidden="true">{index + 1}</span>
				<label class="field">
					<span class="field-label">From tonic</span>
					<select
						aria-label={`Step ${index + 1} interval`}
						value={degree.fromTonic}
						onchange={(e) =>
							setDegreeInterval(index, (e.currentTarget as HTMLSelectElement).value as IntervalId)}
					>
						{#each ALL_INTERVALS as interval (interval)}
							<option value={interval}>{intervalLabel(interval)}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="field-label">Chord</span>
					<select
						aria-label={`Step ${index + 1} chord`}
						value={degree.chordId}
						onchange={(e) => setDegreeChord(index, (e.currentTarget as HTMLSelectElement).value)}
					>
						{#each listChords() as chord (chord.id)}
							<option value={chord.id}>{chord.label}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="remove"
					disabled={degrees.length <= 1}
					aria-label={`Remove step ${index + 1}`}
					onclick={() => removeDegree(index)}
				>
					×
				</button>
			</li>
		{/each}
	</ol>

	<div class="builder-actions">
		<button type="button" class="add" onclick={addDegree}>+ Add step</button>
		<input
			class="name-input"
			type="text"
			placeholder="Name this progression…"
			aria-label="Progression name"
			bind:value={name}
			onkeydown={(e) => e.key === 'Enter' && confirmSave()}
		/>
		<button type="button" class="save" disabled={!canSave} onclick={confirmSave}>Save</button>
	</div>

	{#if savedProgressions.items.length > 0}
		<div class="saved-list">
			<span class="field-label">My Progressions</span>
			<ul class="saved-items">
				{#each savedProgressions.items as item (item.id)}
					<li class="saved-item">
						{#if renamingId === item.id}
							<input
								class="name-input"
								type="text"
								aria-label="Rename progression"
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
							<button type="button" onclick={() => startRenaming(item)}>Rename</button>
							<button
								type="button"
								class="remove"
								aria-label={`Delete ${item.name}`}
								onclick={() => savedProgressions.remove(item.id)}
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
	.progression-builder {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
	}

	.degrees {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.degree {
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
		background: var(--nut, #7c3aed);
		margin-bottom: 0.35rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	select,
	.name-input {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
	}

	select:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible,
	.name-input:focus-visible {
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

	.remove:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.remove:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.builder-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.add,
	.save,
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

	.add:focus-visible,
	.save:focus-visible,
	.saved-item button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.save:disabled,
	.saved-item button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.name-input {
		flex: 1 1 12rem;
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
	}
</style>
