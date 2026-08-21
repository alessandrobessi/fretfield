<script lang="ts">
	import { ROLE_STYLES } from '$lib/config/roles';
	import type { HarmonicRole } from '$lib/music/harmony';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { liveInput } from '$lib/stores/live-input.svelte';

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
		ROLE_ORDER.filter((role) =>
			fretfield.positions.some((position) => position.isVisibleInMode && position.role === role)
		)
	);

	const showLiveLegend = $derived(liveInput.candidatePositions.length > 0);
</script>

{#if activeRoles.length > 0 || showLiveLegend}
	<ul class="legend" aria-label="Legend">
		{#each activeRoles as role (role)}
			<li>
				<span class="swatch" data-role={role} aria-hidden="true"></span>
				{ROLE_STYLES[role].label}
			</li>
		{/each}
		{#if showLiveLegend}
			<li>
				<span class="swatch live-swatch" aria-hidden="true"></span>
				Live-played note
			</li>
		{/if}
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
		font-weight: 600;
		color: var(--fret-fg, #f1e6c5);
	}

	.swatch {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		display: inline-block;
	}

	.swatch[data-role='root'] {
		background: var(--role-root, #e3ac18);
	}

	.swatch[data-role='structural'] {
		background: var(--role-structural, #c9910d);
	}

	.swatch[data-role='stable'] {
		background: transparent;
		border: 2px solid var(--role-stable, #4fd1a5);
	}

	.swatch[data-role='extension'] {
		border-radius: 3px;
		background: var(--role-extension, #a78bfa);
	}

	.swatch[data-role='color'] {
		border-radius: 3px;
		background: transparent;
		border: 2px solid var(--role-color, #f472b6);
	}

	.swatch[data-role='tension'] {
		background: var(--role-tension, #fb923c);
		outline: 2px dashed color-mix(in srgb, var(--role-tension, #fb923c) 70%, transparent);
		outline-offset: 2px;
	}

	.swatch[data-role='alteration'] {
		border-radius: 3px;
		background: var(--role-alteration, #38bdf8);
		outline: 2px dashed color-mix(in srgb, var(--role-alteration, #38bdf8) 70%, transparent);
		outline-offset: 2px;
	}

	.swatch[data-role='chromatic-approach'] {
		background: transparent;
		border: 2px dotted var(--role-chromatic-approach, #94a3b8);
	}

	.swatch[data-role='avoid'] {
		border-radius: 3px;
		background: transparent;
		border: 2px dotted var(--role-avoid, #a8a29e);
		opacity: 0.75;
	}

	.live-swatch {
		border-radius: 6px;
		background: transparent;
		border: 2px solid var(--live-accent, #e34832);
	}
</style>
