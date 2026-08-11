<script lang="ts">
	import { listProgressionTemplates } from '$lib/music/progressions';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	function handleChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		fretfield.setProgressionTemplate(event.currentTarget.value || null);
	}
</script>

<label class="progression-selector">
	<span class="field-label">Progression</span>
	<select value={fretfield.progressionTemplateId ?? ''} onchange={handleChange}>
		<option value="">Choose a progression…</option>
		{#each listProgressionTemplates() as template (template.id)}
			<option value={template.id}>{template.label}</option>
		{/each}
	</select>
</label>

<style>
	.progression-selector {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	.field-label {
		font-weight: 700;
		color: var(--nut, #7c3aed);
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
