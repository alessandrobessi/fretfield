<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Panel header text, rendered as a hardware-style label (e.g. "GROOVE ENGINE"). Omit for a panel that doesn't need its own header (nested inside another panel, say). */
		title?: string;
		/** Extra header-row content beside the title -- e.g. a "● PLAYING" Led + text, per the spec's Groove Engine mockup (§12). */
		header?: Snippet;
		/** `yellow` is the branded instrument-module chassis (spec §6/§12) -- reserve it for the handful of modules the rebrand calls out (Groove Engine, Acid Bass, transport), not general app chrome. `carbon` is the quieter dark-panel variant for everything else that still wants the rectilinear/bordered panel language without claiming the branded yellow surface. */
		tone?: 'yellow' | 'carbon';
		children?: Snippet;
	}

	let { title, header, tone = 'yellow', children }: Props = $props();
</script>

<section class="hardware-panel" class:carbon={tone === 'carbon'}>
	{#if title || header}
		<div class="header">
			{#if title}
				<h2 class="ff-label title">{title}</h2>
			{/if}
			{#if header}
				<div class="header-extra">{@render header()}</div>
			{/if}
		</div>
	{/if}
	<div class="body">
		{@render children?.()}
	</div>
</section>

<style>
	.hardware-panel {
		background: var(--ff-yellow, #e3ac18);
		color: var(--ff-black, #151411);
		border: var(--ff-border-strong, 2px solid #151411);
		border-radius: var(--ff-radius-panel, 8px);
		padding: var(--ff-panel-gap, 16px);
	}

	.hardware-panel.carbon {
		background: var(--ff-carbon, #262521);
		color: var(--ff-ivory, #f1e6c5);
		border-color: var(--surface-border, #3a382f);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: var(--ff-control-gap, 12px);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent);
	}

	.title {
		margin: 0;
	}

	.header-extra {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--ff-control-gap, 12px);
	}
</style>
