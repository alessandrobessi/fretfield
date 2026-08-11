<script lang="ts">
	import { roleStyleFor } from '$lib/config/roles';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	const inspected = $derived(fretfield.inspected);
	const roleStyle = $derived(inspected ? roleStyleFor(inspected.role) : null);
</script>

<div class="note-inspector" aria-live="polite">
	{#if inspected === null}
		<p class="empty">Click or focus any fret to see what it does over the current chord.</p>
	{:else}
		<div class="heading">
			<span class="note-name">{inspected.noteName}</span>
			{#if inspected.intervalLabel}
				<span class="interval-label">{inspected.intervalLabel}</span>
			{/if}
		</div>
		{#if roleStyle}
			<p class="role" data-role={inspected.role}>{roleStyle.label}</p>
		{/if}
		{#if inspected.roleDescription}
			<p class="description">{inspected.roleDescription}</p>
		{/if}
		{#if inspected.typicalResolutionLabels.length > 0}
			<p class="resolutions">
				Typical resolution: {inspected.typicalResolutionLabels.join(' or ')}
			</p>
		{/if}
	{/if}
</div>

<style>
	.note-inspector {
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		min-height: 4.5rem;
	}

	.empty {
		margin: 0;
		color: var(--fret-fg, #241a3d);
		opacity: 0.6;
		font-size: 0.9rem;
	}

	.heading {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.note-name {
		font-size: 1.5rem;
		font-weight: 800;
	}

	.interval-label {
		font-size: 1rem;
		font-weight: 600;
		opacity: 0.7;
	}

	.role {
		margin: 0.3rem 0 0;
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.04em;
	}

	.role[data-role='root'] {
		color: var(--role-root, #f59e0b);
	}
	.role[data-role='structural'] {
		color: var(--role-structural, #4f46e5);
	}
	.role[data-role='stable'] {
		color: var(--role-stable, #10b981);
	}
	.role[data-role='extension'] {
		color: var(--role-extension, #a855f7);
	}
	.role[data-role='color'] {
		color: var(--role-color, #ec4899);
	}
	.role[data-role='tension'] {
		color: var(--role-tension, #f97316);
	}
	.role[data-role='alteration'] {
		color: var(--role-alteration, #ef4444);
	}
	.role[data-role='chromatic-approach'] {
		color: var(--role-chromatic-approach, #64748b);
	}
	.role[data-role='avoid'] {
		color: var(--role-avoid, #78716c);
	}

	.description {
		margin: 0.15rem 0 0;
		font-size: 0.9rem;
	}

	.resolutions {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
