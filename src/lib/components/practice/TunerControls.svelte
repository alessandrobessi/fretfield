<script lang="ts">
	/**
	 * Tuner tab (user-requested, 2026-08): reads `liveInput` directly, the
	 * same singleton-store-read pattern `LiveMusicalContext.svelte` already
	 * uses for its own "notes you play" highlighting -- no props, no local
	 * mic-enable flow of its own. Live Input is a single global toggle (the
	 * header's "Connect Bass" control); this tab just shows what's already
	 * being detected, string-aware, via `$lib/music/tuner.ts`'s pure math.
	 */
	import { STANDARD_4_STRING_ABSOLUTE_TUNING } from '$lib/music/absolute-pitch';
	import { defaultNoteName } from '$lib/music/pitch';
	import {
		MAX_SEMITONES_FROM_OPEN_STRING,
		centsFromOpenString,
		classifyTunerStatus,
		findClosestOpenString
	} from '$lib/music/tuner';
	import { liveInput } from '$lib/stores/live-input.svelte';

	const detectedNote = $derived(liveInput.detectedNote);

	const closestString = $derived(
		detectedNote
			? findClosestOpenString(STANDARD_4_STRING_ABSOLUTE_TUNING, detectedNote.midi)
			: null
	);

	const isFrettedNote = $derived(
		closestString !== null && closestString.semitoneDistance > MAX_SEMITONES_FROM_OPEN_STRING
	);

	const cents = $derived(
		detectedNote && closestString
			? centsFromOpenString(detectedNote.midi, detectedNote.cents, closestString.string.midi)
			: null
	);

	const status = $derived(cents !== null ? classifyTunerStatus(cents) : null);

	const STATUS_LABELS = {
		'in-tune': 'In tune',
		'slightly-flat': 'Slightly flat',
		flat: 'Flat',
		'slightly-sharp': 'Slightly sharp',
		sharp: 'Sharp'
	} as const;

	// A real tuner gauge's own physical sweep -- clamped so the needle never
	// visually overshoots past what a ±50-cent swing looks like, even though
	// the numeric cents readout can (rarely) exceed that.
	const NEEDLE_SWEEP_DEG = 45;
	const needleAngle = $derived(
		cents !== null ? (Math.max(-50, Math.min(50, cents)) / 50) * NEEDLE_SWEEP_DEG : 0
	);
</script>

<div class="tuner">
	{#if !liveInput.enabled}
		<p class="hint">Enable Live Input above to tune your bass.</p>
	{:else if detectedNote === null}
		<p class="hint listening">Listening…</p>
	{:else if isFrettedNote}
		<div class="fretted-note">
			<p class="detected-note">{defaultNoteName(detectedNote.pitchClass)}</p>
			<p class="hint">Fretted note detected — play an open string to tune.</p>
		</div>
	{:else if closestString && status && cents !== null}
		<div class="reading">
			<span class="string-name">{defaultNoteName(closestString.string.pitchClass)}</span>
			<div class="needle-wrap">
				<div class="needle-track"></div>
				<div
					class="needle"
					class:in-tune={status === 'in-tune'}
					class:far={status === 'sharp' || status === 'flat'}
					style:transform={`rotate(${needleAngle}deg)`}
				></div>
				<div class="needle-hub"></div>
			</div>
			<span
				class="status"
				class:in-tune={status === 'in-tune'}
				class:far={status === 'sharp' || status === 'flat'}
			>
				{STATUS_LABELS[status]}
			</span>
			<span class="cents-readout">{cents > 0 ? '+' : ''}{Math.round(cents)}¢</span>
		</div>
	{/if}
</div>

<style>
	.tuner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 10rem;
		gap: 0.5rem;
	}

	.hint {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.65;
	}

	.listening {
		font-weight: 600;
	}

	.fretted-note {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}

	.detected-note {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--fg-muted, #89877f);
	}

	.reading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.string-name {
		font-size: 3.5rem;
		font-weight: 800;
		color: var(--ff-yellow, #e3ac18);
		line-height: 1;
	}

	.needle-wrap {
		position: relative;
		width: 10rem;
		height: 5.5rem;
	}

	.needle-track {
		position: absolute;
		inset: 0;
		border-top: 2px dashed var(--surface-border, #3a382f);
		border-radius: 999px 999px 0 0;
	}

	.needle {
		position: absolute;
		bottom: 0;
		left: calc(50% - 1.5px);
		width: 3px;
		height: 5rem;
		background: var(--ff-red, #e34832);
		opacity: 0.55;
		transform-origin: bottom center;
		border-radius: 2px;
		transition: transform 0.1s ease-out;
	}

	.needle.far {
		opacity: 1;
	}

	.needle.in-tune {
		background: var(--ff-yellow, #e3ac18);
		opacity: 1;
	}

	.needle-hub {
		position: absolute;
		bottom: -0.3rem;
		left: calc(50% - 0.3rem);
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--fg-muted, #89877f);
	}

	.status {
		font-size: 1rem;
		font-weight: 700;
		color: var(--ff-red, #e34832);
		opacity: 0.7;
	}

	.status.far {
		opacity: 1;
	}

	.status.in-tune {
		color: var(--ff-yellow, #e3ac18);
		opacity: 1;
	}

	.cents-readout {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.6;
	}
</style>
