<script lang="ts">
	import { DRUM_VOICES, type DrumVoice } from '$lib/audio/groove';
	import { listGroovePresets } from '$lib/audio/groove-presets';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const VOICE_LABELS: Record<DrumVoice, string> = {
		kick: 'Kick',
		snare: 'Snare',
		closedHat: 'Closed Hat',
		openHat: 'Open Hat'
	};

	const presets = listGroovePresets();

	function handleBpmChange(event: Event): void {
		scalePractice.setBpm(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleSwingChange(event: Event): void {
		scalePractice.setSwing(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handlePresetChange(event: Event): void {
		const id = (event.currentTarget as HTMLSelectElement).value;
		const preset = presets.find((p) => p.id === id);
		if (preset) scalePractice.setPattern(preset.pattern);
	}

	function toggleMetronome(): void {
		if (scalePractice.running) {
			scalePractice.stop();
		} else {
			scalePractice.start();
		}
	}
</script>

<div class="drum-machine">
	<div class="controls-row">
		<label class="field">
			<span class="field-label">Genre</span>
			<select aria-label="Groove preset" onchange={handlePresetChange}>
				<option value="">Choose a preset…</option>
				{#each presets as preset (preset.id)}
					<option value={preset.id}>{preset.label}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span class="field-label">Tempo</span>
			<input
				type="number"
				aria-label="Metronome BPM"
				min="30"
				max="240"
				value={scalePractice.bpm}
				onchange={handleBpmChange}
			/>
		</label>
		<label class="field">
			<span class="field-label">Swing</span>
			<span class="swing-control">
				<input
					type="range"
					aria-label="Swing"
					min="0"
					max="100"
					value={scalePractice.pattern.swing}
					onchange={handleSwingChange}
				/>
				<span class="swing-readout">{scalePractice.pattern.swing}%</span>
			</span>
		</label>
		<button
			type="button"
			class="toggle"
			class:active={scalePractice.running}
			onclick={toggleMetronome}
		>
			{scalePractice.running ? 'Stop Metronome' : 'Start Metronome'}
		</button>
		{#if scalePractice.running}
			<span class="beat-readout">♩ = {scalePractice.bpm}</span>
		{/if}
	</div>

	<div class="step-grid">
		{#each DRUM_VOICES as voice (voice)}
			<div class="voice-row" role="group" aria-label={`${VOICE_LABELS[voice]} steps`}>
				<span class="voice-label">{VOICE_LABELS[voice]}</span>
				<div class="steps">
					{#each scalePractice.pattern.steps[voice] as active, index (index)}
						<button
							type="button"
							class="step"
							class:active
							class:beat-start={index % 4 === 0}
							aria-label={`${VOICE_LABELS[voice]} step ${index + 1}`}
							aria-pressed={active}
							onclick={() => scalePractice.toggleStep(voice, index)}
						>
							{#if active}
								<span class="dot" aria-hidden="true"></span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.drum-machine {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.controls-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
	}

	select,
	input[type='number'] {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: pointer;
	}

	input[type='number'] {
		width: 4.5rem;
		cursor: text;
	}

	select:hover,
	input[type='number']:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible,
	input[type='number']:focus-visible,
	input[type='range']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.swing-control {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.swing-readout {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		min-width: 2.5em;
	}

	.toggle {
		font: inherit;
		font-weight: 700;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--practice-target-accent, #10b981);
		background: transparent;
		color: var(--practice-target-accent, #10b981);
		cursor: pointer;
	}

	.toggle.active {
		background: var(--practice-target-accent, #10b981);
		color: #fff;
	}

	.toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.beat-readout {
		font-size: 0.85rem;
		font-weight: 600;
		opacity: 0.85;
	}

	.step-grid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.voice-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.voice-label {
		flex: 0 0 5.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		opacity: 0.75;
	}

	.steps {
		display: flex;
		gap: 0.2rem;
		flex-wrap: wrap;
	}

	.step {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border-radius: 5px;
		border: 1px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		cursor: pointer;
	}

	/* A subtle visual break every 4 steps (one beat), matching a real step sequencer's grid. */
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
		background: color-mix(
			in srgb,
			var(--practice-target-accent, #10b981) 18%,
			var(--fret-bg, #fff)
		);
		border-color: var(--practice-target-accent, #10b981);
	}

	.step .dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--practice-target-accent, #10b981);
	}
</style>
