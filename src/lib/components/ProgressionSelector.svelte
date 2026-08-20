<script lang="ts">
	import { listProgressionTemplates } from '$lib/music/progressions';

	interface Props {
		value: string | null;
		onChange: (id: string | null) => void;
	}

	const { value, onChange }: Props = $props();

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
		</select>
	</label>
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
