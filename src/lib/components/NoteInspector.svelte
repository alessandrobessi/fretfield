<script lang="ts">
	import { roleStyleFor } from '$lib/config/roles';
	import { intervalCompoundLabel, intervalFromRoot } from '$lib/music/intervals';
	import { defaultNoteName } from '$lib/music/pitch';
	import { getScaleDefinition } from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const inspected = $derived(fretfield.inspected);
	const roleStyle = $derived(inspected ? roleStyleFor(inspected.role) : null);

	// Scale Practice has no chord/role to show — just where this note sits in
	// the active progression chord's scale, if it's in it at all (hovering a
	// fret outside the scale entirely is still valid, it just has nothing to
	// report here). No progression chord-scale active means nothing to report
	// at all -- there's no standalone manual scale to fall back to.
	const scalePracticeDegree = $derived.by(() => {
		if (fretfield.mode !== 'scale-practice' || inspected === null) return null;
		const activeScale = scalePractice.activeChordScale;
		if (activeScale === null) return null;
		const scale = getScaleDefinition(activeScale.scaleId);
		const interval = intervalFromRoot(activeScale.root, inspected.pitchClass);
		if (!scale.intervals.includes(interval)) return null;
		return `${intervalCompoundLabel(interval)} degree of ${defaultNoteName(activeScale.root)} ${scale.label}`;
	});
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
		{#if scalePracticeDegree}
			<p class="scale-practice-degree">{scalePracticeDegree}</p>
		{/if}
	{/if}
</div>

<style>
	.note-inspector {
		background: var(--fret-bg, #262521);
		border: 1px solid var(--fret-border, #3a382f);
		border-radius: var(--ff-radius-panel, 8px);
		padding: 1rem 1.25rem;
		min-height: 4.5rem;
	}

	.empty {
		margin: 0;
		color: var(--fret-fg, #f1e6c5);
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

	/*
	 * All nine role colors are used as-is (no darkening) against this panel's
	 * dark background (--fret-bg) -- every one already clears WCAG AA at
	 * 5.5:1+ raw. This inverts the pre-rebrand rule here, which *darkened*
	 * six of the nine via color-mix specifically for a white background;
	 * darkening bright colors against a now-dark background would move
	 * contrast the wrong direction, not the right one.
	 */
	.role[data-role='root'] {
		color: var(--role-root, #e3ac18);
	}
	.role[data-role='structural'] {
		color: var(--role-structural, #c9910d);
	}
	.role[data-role='stable'] {
		color: var(--role-stable, #4fd1a5);
	}
	.role[data-role='extension'] {
		color: var(--role-extension, #a78bfa);
	}
	.role[data-role='color'] {
		color: var(--role-color, #f472b6);
	}
	.role[data-role='tension'] {
		color: var(--role-tension, #fb923c);
	}
	.role[data-role='alteration'] {
		color: var(--role-alteration, #38bdf8);
	}
	.role[data-role='chromatic-approach'] {
		color: var(--role-chromatic-approach, #94a3b8);
	}
	.role[data-role='avoid'] {
		color: var(--role-avoid, #a8a29e);
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

	.scale-practice-degree {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
