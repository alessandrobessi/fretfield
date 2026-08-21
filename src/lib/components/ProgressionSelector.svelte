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
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--nut, #e3ac18);
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.5rem 0.6rem;
		background: var(--surface, #262521);
		color: var(--fg, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	select:hover {
		border-color: var(--nut, #e3ac18);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}
</style>
