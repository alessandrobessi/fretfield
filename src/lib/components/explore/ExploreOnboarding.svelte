<script lang="ts">
	import { getChordDefinition } from '$lib/music/chords';
	import { defaultNoteName } from '$lib/music/pitch';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { onboarding } from '$lib/stores/onboarding.svelte';

	const chordSymbol = $derived(
		fretfield.root === null
			? ''
			: `${defaultNoteName(fretfield.root)}${getChordDefinition(fretfield.chordId).symbol}`
	);

	const step = $derived.by(() => {
		if (fretfield.root === null) {
			return onboarding.hasSeen('explore-intro') ? null : 'explore-intro';
		}
		return onboarding.hasSeen('explore-guidance') ? null : 'explore-guidance';
	});

	$effect(() => {
		if (fretfield.root !== null) onboarding.markSeen('explore-intro');
	});

	// Deliberately keyed on the chord changing, not on inspecting a note --
	// selecting the root already inspects it in the same click (FretCell's
	// onclick calls both onSelect and onInspect), and hovering can inspect
	// other frets incidentally before the user has really "chosen" a chord,
	// so a hover-based dismissal would be too eager to fire reliably.
	$effect(() => {
		if (fretfield.chordId !== 'major') onboarding.markSeen('explore-guidance');
	});
</script>

{#if step === 'explore-intro'}
	<p class="onboarding-hint">
		See the harmonic field. Move through it.<br />Choose a note on the neck.
	</p>
{:else if step === 'explore-guidance'}
	<p class="onboarding-hint">
		That's your root — every note is shown by what it does over {chordSymbol}.<br />Choose a chord
		to see how the roles change, or click any note to understand it.
	</p>
{/if}

<style>
	.onboarding-hint {
		margin: 0;
		padding: 0.75rem 1.1rem;
		border-radius: var(--ff-radius-panel, 8px);
		background: color-mix(in srgb, var(--nut, #e3ac18) 8%, var(--surface, #262521));
		border: 1px dashed var(--nut, #e3ac18);
		color: var(--fret-fg, #f1e6c5);
		font-size: 0.9rem;
		line-height: 1.5;
	}
</style>
