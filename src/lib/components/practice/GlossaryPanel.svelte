<script lang="ts">
	import HardwarePanel from '$lib/components/hardware/HardwarePanel.svelte';
	import type { GlossarySection } from '$lib/acid-bass/glossary';

	/**
	 * Shared "toggleable reference panel" rendering for a `GlossarySection[]`
	 * -- extracted (2026-08) once `GrooveEditor.svelte`'s own Generated-mode
	 * glossary needed the exact same panel/section/definition-list markup
	 * `AcidBassControls.svelte` already had, so the two didn't duplicate a
	 * CSS block. Each caller still owns its own `showGlossary` state and
	 * toggle button placement -- this component only renders the panel body.
	 */
	interface Props {
		intro: string;
		sections: GlossarySection[];
	}

	let { intro, sections }: Props = $props();
</script>

<HardwarePanel title="GLOSSARY" tone="carbon">
	<p class="glossary-intro">{intro}</p>
	<div class="glossary-sections">
		{#each sections as section (section.title)}
			<div class="glossary-section">
				<h3 class="ff-label glossary-section-title">{section.title}</h3>
				<dl class="glossary-list">
					{#each section.entries as entry (entry.term)}
						<div>
							<dt>{entry.term}</dt>
							<dd>{entry.description}</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/each}
	</div>
</HardwarePanel>

<style>
	.glossary-intro {
		margin: 0 0 0.6rem;
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.glossary-sections {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.9rem;
		align-items: start;
	}

	.glossary-section-title {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
	}

	.glossary-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.glossary-list dt {
		font-weight: 700;
	}

	.glossary-list dd {
		margin: 0;
		opacity: 0.85;
		line-height: 1.35;
	}
</style>
