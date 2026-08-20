<script lang="ts">
	import CustomProgressionBuilder from '$lib/components/CustomProgressionBuilder.svelte';
	import { listProgressionTemplates } from '$lib/music/progressions';
	import { savedProgressions } from '$lib/stores/saved-progressions.svelte';

	interface Props {
		value: string | null;
		onChange: (id: string | null) => void;
	}

	const { value, onChange }: Props = $props();

	let showBuilder = $state(false);

	function handleChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		onChange(event.currentTarget.value || null);
	}
</script>

<div class="progression-selector">
	<label>
		<span class="field-label">Progression</span>
		<select value={value ?? ''} onchange={handleChange}>
			<option value="">Choose a progression…</option>
			{#each listProgressionTemplates() as template (template.id)}
				<option value={template.id}>{template.label}</option>
			{/each}
			{#if savedProgressions.items.length > 0}
				<optgroup label="My Progressions">
					{#each savedProgressions.items as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</optgroup>
			{/if}
		</select>
	</label>
	<button type="button" class="toggle-builder" onclick={() => (showBuilder = !showBuilder)}>
		{showBuilder ? '← Hide builder' : '+ Build your own'}
	</button>
	{#if showBuilder}
		<CustomProgressionBuilder />
	{/if}
</div>

<style>
	.progression-selector {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.progression-selector label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-label {
		font-weight: 700;
		color: var(--nut, #7c3aed);
	}

	.toggle-builder {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--nut, #7c3aed);
		cursor: pointer;
		text-decoration: underline;
	}

	.toggle-builder:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.5rem 0.6rem;
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
</style>
