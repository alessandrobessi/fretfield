<script lang="ts">
	import { ROLE_STYLES } from '$lib/config/roles';
	import type { HarmonicRole } from '$lib/music/harmony';
	import { fretfield } from '$lib/stores/fretfield.svelte';

	// Fixed, meaningful display order — not Set insertion order.
	const ROLE_ORDER: readonly HarmonicRole[] = [
		'root',
		'structural',
		'stable',
		'extension',
		'color',
		'tension',
		'alteration',
		'chromatic-approach',
		'avoid'
	];

	const activeRoles = $derived.by<HarmonicRole[]>(() =>
		ROLE_ORDER.filter((role) => fretfield.positions.some((position) => position.role === role))
	);
</script>

{#if activeRoles.length > 0}
	<ul class="legend" aria-label="Legend">
		{#each activeRoles as role (role)}
			<li>
				<span class="swatch" data-role={role} aria-hidden="true"></span>
				{ROLE_STYLES[role].label}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.85rem;
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.swatch {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		display: inline-block;
	}

	.swatch[data-role='root'] {
		background: var(--role-root, #e0b400);
	}

	.swatch[data-role='structural'] {
		background: var(--role-structural, #3b82f6);
	}

	.swatch[data-role='stable'] {
		background: transparent;
		border: 2px solid var(--role-stable, #22c55e);
	}
</style>
