<script lang="ts">
	import { roleStyleFor } from '$lib/config/roles';
	import { getChordDefinition } from '$lib/music/chords';
	import { intervalCompoundLabel, intervalFromRoot } from '$lib/music/intervals';
	import { defaultNoteName } from '$lib/music/pitch';
	import { getScaleDefinition } from '$lib/music/scales';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const inspected = $derived(fretfield.inspected);
	const roleStyle = $derived(inspected ? roleStyleFor(inspected.role) : null);
	const connection = $derived(fretfield.inspectedConnectionDisplay);

	// Scale Practice has no chord/role to show — just where this note sits in
	// the configured scale, if it's in it at all (hovering a fret outside the
	// scale entirely is still valid, it just has nothing to report here).
	const scalePracticeDegree = $derived.by(() => {
		if (fretfield.mode !== 'scale-practice' || inspected === null) return null;
		const root = scalePractice.root;
		const scale = scalePractice.scale;
		if (root === null || scale === null) return null;
		const interval = intervalFromRoot(root, inspected.pitchClass);
		if (!scale.intervals.includes(interval)) return null;
		return `${intervalCompoundLabel(interval)} degree of ${defaultNoteName(root)} ${scale.label}`;
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
		{#if connection}
			<div class="connection">
				{#if connection.commonTone}
					<p class="connection-line">Common tone into {connection.nextChordSymbol}.</p>
				{/if}
				<p class="connection-line">
					Best target: <strong>{connection.bestTargetNoteName}</strong>
					({connection.bestTargetIntervalLabel} of {connection.nextChordSymbol})
				</p>
				<p class="connection-line">
					Movement: {connection.semitoneMovement > 0 ? '+' : ''}{connection.semitoneMovement} semitone{Math.abs(
						connection.semitoneMovement
					) === 1
						? ''
						: 's'}
				</p>
				<p class="connection-line">Next role: {connection.bestTargetRoleLabel}</p>
			</div>
		{/if}
		{#if scalePracticeDegree}
			<p class="scale-practice-degree">{scalePracticeDegree}</p>
		{/if}
		{#if inspected.scaleBlockMembership.length > 0}
			<div class="scale-blocks">
				{#each inspected.scaleBlockMembership as blockIndex (blockIndex)}
					{@const block = fretfield.chordBlocks[blockIndex]}
					<p class="scale-block-line">
						<span class="chip" data-block={blockIndex} aria-hidden="true">{blockIndex + 1}</span>
						In block {blockIndex + 1}: {defaultNoteName(block.root!)}{getChordDefinition(
							block.chordId!
						).symbol} ({getScaleDefinition(block.scaleId!).label})
					</p>
				{/each}
			</div>
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

	.connection {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--fret-border, #ddd3f7);
	}

	.connection-line {
		margin: 0.15rem 0;
		font-size: 0.85rem;
	}

	.scale-practice-degree {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}

	.scale-blocks {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--fret-border, #ddd3f7);
	}

	.scale-block-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.15rem 0;
		font-size: 0.85rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		flex: 0 0 auto;
		border-radius: 50%;
		font-size: 0.65rem;
		font-weight: 700;
		color: #fff;
	}

	.chip[data-block='0'] {
		background: var(--scale-block-1, #3b82f6);
	}

	.chip[data-block='1'] {
		background: var(--scale-block-2, #f43f5e);
	}

	.chip[data-block='2'] {
		background: var(--scale-block-3, #eab308);
	}

	.chip[data-block='3'] {
		background: var(--scale-block-4, #8b5cf6);
	}
</style>
