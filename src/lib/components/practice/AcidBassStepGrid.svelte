<script lang="ts">
	import type { AcidBassPattern, AcidBassStep, AcidOctaveOffset } from '$lib/acid-bass/types';
	import { intervalLabel } from '$lib/music/intervals';

	interface Props {
		pattern: AcidBassPattern;
		stepsPerBeatGroup: number;
		activeStepIndex: number | null;
		selectedStepIndex: number | null;
		onSelectStep: (index: number) => void;
	}

	const { pattern, stepsPerBeatGroup, activeStepIndex, selectedStepIndex, onSelectStep }: Props =
		$props();

	function octaveLabel(octave: AcidOctaveOffset): string {
		if (octave === 1) return 'octave up';
		if (octave === -1) return 'octave down';
		return 'normal octave';
	}

	function stepAriaLabel(step: AcidBassStep, index: number): string {
		if (!step.active) return `Bass step ${index + 1}, inactive`;
		return [
			`Bass step ${index + 1}`,
			'active',
			`interval ${intervalLabel(step.interval)}`,
			octaveLabel(step.octave),
			step.accent ? 'accented' : 'not accented',
			step.slide ? 'slides to next step' : 'no slide'
		].join(', ');
	}
</script>

<div class="voice-row" role="group" aria-label="Bass steps">
	<span class="voice-label">Bass</span>
	<div class="steps">
		{#each pattern as step, index (index)}
			<button
				type="button"
				class="step"
				class:active={step.active}
				class:accented={step.accent}
				class:beat-start={index % stepsPerBeatGroup === 0}
				class:current={index === activeStepIndex}
				class:selected={index === selectedStepIndex}
				aria-label={stepAriaLabel(step, index)}
				aria-pressed={step.active}
				title={stepAriaLabel(step, index)}
				onclick={() => onSelectStep(index)}
			>
				{#if step.active}
					<span class="interval">{intervalLabel(step.interval)}</span>
					<span class="markers">
						{#if step.octave === 1}<span class="marker" aria-hidden="true">↑</span>{/if}
						{#if step.octave === -1}<span class="marker" aria-hidden="true">↓</span>{/if}
						{#if step.accent}<span class="marker" aria-hidden="true">A</span>{/if}
						{#if step.slide}<span class="marker" aria-hidden="true">→</span>{/if}
					</span>
				{:else}
					<span class="rest" aria-hidden="true">·</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.voice-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.voice-label {
		position: sticky;
		left: 0;
		flex: 0 0 5.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: inherit;
		background: var(--ff-yellow, #e3ac18);
	}

	.steps {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	/* Same black-step-keys-on-yellow-chassis language as the drum grid
	   (GrooveEditor.svelte) -- Acid Bass reuses the Groove Engine's own
	   component system rather than a separate visual vocabulary (spec §13). */
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 1.9rem;
		padding: 0;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-carbon, #262521);
		background: var(--ff-black, #151411);
		cursor: pointer;
		line-height: 1;
	}

	.step.beat-start {
		border-left-color: var(--ff-yellow-dark, #c9910d);
		border-left-width: 2px;
	}

	.step:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.step:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}

	/* Programmed on -- yellow, same "selected/intentional" meaning as the
	   drum grid's own .step.active, not a live/status color. */
	.step.active {
		background: color-mix(in srgb, var(--ff-yellow, #e3ac18) 22%, var(--ff-black, #151411));
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	.step.accented {
		border-width: 2px;
	}

	/* The step currently shown in the editor below -- ivory, not yellow, so
	   it stays visible against an .active step's own yellow fill (same
	   reasoning as FretCell's selected-root ring vs. its root pill). */
	.step.selected {
		box-shadow: 0 0 0 2px var(--ff-ivory, #f1e6c5);
	}

	/* The playhead -- red, matching every other "currently sounding" cue. */
	.step.current {
		border-color: var(--ff-red, #e34832);
		box-shadow:
			0 0 0 2px var(--ff-red, #e34832),
			0 0 0.5rem 0.05rem var(--ff-red, #e34832);
		animation: step-pulse 500ms ease-in-out;
	}

	.interval {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--ff-yellow, #e3ac18);
	}

	.markers {
		display: flex;
		gap: 0.1rem;
		font-size: 0.5rem;
		font-weight: 700;
		color: var(--ff-yellow, #e3ac18);
		opacity: 0.85;
		min-height: 0.6rem;
	}

	.rest {
		color: var(--ff-gray, #89877f);
	}

	@keyframes step-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.85;
		}
		50% {
			transform: scale(1.12);
			opacity: 1;
		}
	}
</style>
