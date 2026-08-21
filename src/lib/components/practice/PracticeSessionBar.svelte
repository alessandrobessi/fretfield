<script lang="ts">
	import { setTimeSignature as resizeGrooveToTimeSignature } from '$lib/groove/pattern';
	import { listGroovePresets } from '$lib/groove/presets';
	import HardwareButton from '$lib/components/hardware/HardwareButton.svelte';
	import Led from '$lib/components/hardware/Led.svelte';
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

	<div class="transport">
		<HardwareButton
			variant="secondary"
			pressed={scalePractice.groove.acidBass.enabled}
			onclick={() => scalePractice.setAcidBassEnabled(!scalePractice.groove.acidBass.enabled)}
		>
			Bass {scalePractice.groove.acidBass.enabled ? 'On' : 'Off'}
		</HardwareButton>

		<HardwareButton variant="primary" onclick={toggleMetronome}>
			{scalePractice.running ? 'Stop' : 'Play'}
		</HardwareButton>

		{#if scalePractice.isCountingIn}
			<span class="beat-readout">
				<Led state="active" />
				Count-in…
			</span>
		{:else if scalePractice.running}
			<span class="beat-readout">
				<Led state="current" />
				♩ = {scalePractice.bpm}
			</span>
		{/if}
	</div>
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
			background: var(--bg, #151411);
			padding: 0.6rem 0.9rem;
			border-top: 1px solid var(--surface-border, #3a382f);
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
	}

	.field-label {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--nut, #e3ac18);
	}

	select,
	input[type='number'] {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--surface, #262521);
		color: var(--fg, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	input[type='number'] {
		width: 4.5rem;
		cursor: text;
		font-variant-numeric: tabular-nums;
	}

	select:hover,
	input[type='number']:hover {
		border-color: var(--nut, #e3ac18);
	}

	select:focus-visible,
	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}

	.transport {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
	}

	.beat-readout {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--fg-muted, #89877f);
	}
</style>
