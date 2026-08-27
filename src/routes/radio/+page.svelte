<script lang="ts">
	/**
	 * Radio Mode (user-requested, 2026-08): a standalone, unlisted page for
	 * streaming FretField 24/7 -- what an operator points OBS's Browser Source
	 * at. Deliberately not linked from anywhere in the app and not a third
	 * destination alongside Explore/Practice (AGENTS.md's "deliberately two
	 * destinations" doctrine still holds; see that file's own Radio Mode
	 * entry) -- reachable only by direct URL, and excluded from search via
	 * the `noindex` meta tag below.
	 *
	 * Reuses the existing `scalePractice` singleton store as its entire
	 * playback engine -- no parallel scheduler, no new DSP. `RadioDirector`
	 * (`$lib/stores/radio-director.ts`) is the only new logic: it just calls
	 * this store's own existing public setters on a timer.
	 *
	 * Web Audio requires a user gesture to start, the same constraint every
	 * other Play button in this app already goes through -- the one-time
	 * "Click to start" overlay below is Radio's equivalent, not a new
	 * restriction. After that click, everything runs unattended.
	 */
	import { onDestroy } from 'svelte';
	import RadioVisualizer from '$lib/components/radio/RadioVisualizer.svelte';
	import { listGroovePresets } from '$lib/groove/presets';
	import { listBasslineStyleProfiles } from '$lib/music/bassline/styles';
	import { defaultNoteName } from '$lib/music/pitch';
	import { getProgressionTemplate } from '$lib/music/progressions';
	import {
		createRadioDirector,
		type RadioCombo,
		type RadioDirector
	} from '$lib/stores/radio-director';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	let started = $state(false);
	let currentCombo = $state<RadioCombo | null>(null);
	let radioDirector: RadioDirector | null = null;

	function formatNowPlaying(combo: RadioCombo): string {
		const progression = getProgressionTemplate(combo.progressionId);
		const groovePreset = listGroovePresets().find((preset) => preset.id === combo.groovePresetId);
		const style = listBasslineStyleProfiles().find((profile) => profile.id === combo.bassStyle);
		return [
			defaultNoteName(combo.root),
			progression.label,
			groovePreset?.label ?? combo.groovePresetId,
			style?.label ?? combo.bassStyle,
			`${combo.bpm} BPM`
		].join(' · ');
	}

	const nowPlaying = $derived(currentCombo ? formatNowPlaying(currentCombo) : null);

	function handleStart(): void {
		if (started) return;

		// Radio drives this singleton store for hours -- never let its own
		// constant rotation overwrite a real user's saved Practice session in
		// this same browser's localStorage.
		scalePractice.persistEnabled = false;
		scalePractice.setAcidBassEnabled(true);
		scalePractice.setAcidBassMode('generated');
		scalePractice.start();

		radioDirector = createRadioDirector(
			{
				setRoot: (root) => scalePractice.setRoot(root),
				setProgressionTemplate: (id) => scalePractice.setProgressionTemplate(id),
				setGroove: (groove) => scalePractice.setGroove(groove),
				setAcidBassGenerationStyle: (style) => scalePractice.setAcidBassGenerationStyle(style),
				setBpm: (bpm) => scalePractice.setBpm(bpm)
			},
			{ onRotate: (combo) => (currentCombo = combo) }
		);
		radioDirector.start();

		started = true;
	}

	onDestroy(() => {
		radioDirector?.stop();
		if (started) scalePractice.stop();
	});
</script>

<svelte:head>
	<title>FretField Radio</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if started}
	<RadioVisualizer analyser={scalePractice.getMasterAnalyser()} {nowPlaying} />
{:else}
	<button type="button" class="start-overlay" onclick={handleStart}>
		<span class="wordmark">FretField Radio</span>
		<span class="hint">Click to start</span>
	</button>
{/if}

<style>
	.start-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		width: 100%;
		background: var(--ff-black, #151411);
		border: none;
		cursor: pointer;
	}

	.wordmark {
		font-size: clamp(1.75rem, 5vw, 3rem);
		font-weight: 800;
		letter-spacing: 0.02em;
		color: var(--ff-yellow, #e3ac18);
	}

	.hint {
		font-size: 1rem;
		font-weight: 600;
		color: var(--fg-muted, #89877f);
	}

	.start-overlay:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: -3px;
	}
</style>
