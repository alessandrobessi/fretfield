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
		opacity: 0.75;
		background: var(--fret-bg, #fff);
	}

	.steps {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 1.9rem;
		padding: 0;
		border-radius: 5px;
		border: 1px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		cursor: pointer;
		line-height: 1;
	}

	.step.beat-start {
		border-left-color: var(--nut, #7c3aed);
		border-left-width: 2px;
	}

	.step:hover {
		border-color: var(--nut, #7c3aed);
	}

	.step:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.step.active {
		background: color-mix(in srgb, var(--live-accent, #06b6d4) 16%, var(--fret-bg, #fff));
		border-color: var(--live-accent, #06b6d4);
	}

	.step.accented {
		border-width: 2px;
	}

	.step.selected {
		box-shadow: 0 0 0 2px var(--nut, #7c3aed);
	}

	.step.current {
		border-color: var(--nut, #7c3aed);
		box-shadow: 0 0 0 2px var(--nut, #7c3aed);
		animation: step-pulse 0.12s ease-out;
	}

	.interval {
		font-size: 0.65rem;
		font-weight: 700;
	}

	.markers {
		display: flex;
		gap: 0.1rem;
		font-size: 0.5rem;
		font-weight: 700;
		opacity: 0.75;
		min-height: 0.6rem;
	}

	.rest {
		opacity: 0.35;
	}

	@keyframes step-pulse {
		from {
			transform: scale(1.35);
		}
		to {
			transform: scale(1);
		}
	}
</style>
