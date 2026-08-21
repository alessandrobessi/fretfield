<script lang="ts">
	import { setTimeSignature as resizeGrooveToTimeSignature } from '$lib/groove/pattern';
	import { listGroovePresets } from '$lib/groove/presets';
	import ProgressionSelector from '$lib/components/ProgressionSelector.svelte';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { savedGrooves } from '$lib/stores/saved-grooves.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);
	const presets = listGroovePresets();

	function handleRootChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setRoot(value === '' ? null : (Number(value) as PitchClass));
	}

	function handleBpmChange(event: Event): void {
		scalePractice.setBpm(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handlePresetChange(event: Event): void {
		const id = (event.currentTarget as HTMLSelectElement).value;
		const preset = presets.find((p) => p.id === id);
		if (preset) {
			// Every curated preset is authored in 4/4 -- a preset is a rhythmic
			// feel/pattern shortcut, not a meter choice, so applying one
			// shouldn't silently discard whatever meter the player already
			// picked. Resize the preset's patterns onto the current meter
			// instead of adopting the preset's own baked-in time signature.
			scalePractice.setGroove(
				resizeGrooveToTimeSignature(preset.groove, scalePractice.groove.timeSignature)
			);
			return;
		}
		const saved = savedGrooves.items.find((item) => item.id === id);
		if (saved) scalePractice.setGroove(saved.data);
	}

	function toggleMetronome(): void {
		if (scalePractice.running) {
			scalePractice.stop();
		} else {
			scalePractice.start();
		}
	}
</script>

<div class="practice-session-bar">
	<label class="field">
		<span class="field-label">Root</span>
		<select
			aria-label="Scale Practice root"
			value={scalePractice.root ?? ''}
			onchange={handleRootChange}
		>
			<option value="">—</option>
			{#each ALL_ROOTS as pitchClass (pitchClass)}
				<option value={pitchClass}>{defaultNoteName(pitchClass)}</option>
			{/each}
		</select>
	</label>

	<ProgressionSelector
		value={scalePractice.progressionTemplateId}
		onChange={(id) => scalePractice.setProgressionTemplate(id)}
	/>

	<label class="field">
		<span class="field-label">Groove</span>
		<select aria-label="Groove preset" onchange={handlePresetChange}>
			<option value="">Choose a preset…</option>
			{#each presets as preset (preset.id)}
				<option value={preset.id}>{preset.label}</option>
			{/each}
			{#if savedGrooves.items.length > 0}
				<optgroup label="My Grooves">
					{#each savedGrooves.items as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</optgroup>
			{/if}
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

	<button
		type="button"
		class="toggle"
		class:active={scalePractice.running}
		onclick={toggleMetronome}
	>
		{scalePractice.running ? 'Stop' : 'Play'}
	</button>

	{#if scalePractice.isCountingIn}
		<span class="beat-readout">Count-in…</span>
	{:else if scalePractice.running}
		<span class="beat-readout">♩ = {scalePractice.bpm}</span>
	{/if}
</div>

<style>
	.practice-session-bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	/* A persistent bottom transport is most valuable exactly when a narrow
	   screen means the player physically has a bass in their hands and
	   doesn't want to scroll back up to reach Play -- `fixed`, not `sticky`:
	   this bar sits at the top of the page's normal flow, so there's no
	   scroll-past-a-threshold moment for `sticky` to hook into. */
	@media (max-width: 640px) {
		.practice-session-bar {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 5;
			background: var(--bg, #fff);
			padding: 0.6rem 0.9rem;
			box-shadow: 0 -4px 12px rgb(0 0 0 / 0.08);
		}
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
	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.toggle {
		font: inherit;
		font-weight: 700;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--practice-target-accent, #10b981);
		background: transparent;
		color: var(--practice-target-accent, #10b981);
		cursor: pointer;
		margin-left: auto;
	}

	.toggle.active {
		border-color: var(--role-alteration, #ef4444);
		background: var(--role-alteration, #ef4444);
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
</style>
