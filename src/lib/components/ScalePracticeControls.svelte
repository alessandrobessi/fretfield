<script lang="ts">
	import { untrack } from 'svelte';
	import { intervalCompoundLabel, intervalFromRoot } from '$lib/music/intervals';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { listScales } from '$lib/music/scales';
	import { DEFAULT_FRET_COUNT } from '$lib/music/tuning';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const ALL_ROOTS: PitchClass[] = Array.from({ length: 12 }, (_, i) => i as PitchClass);

	// Same onset-gated wiring Guided Practice uses — `noteOnsetId` must be the
	// only tracked dependency (see GuidedPracticeControls.svelte's identical
	// comment: `untrack` avoids `handleDetectedNote`'s internal state writes
	// turning this into a self-retriggering loop).
	$effect(() => {
		const onsetId = liveInput.noteOnsetId;
		if (onsetId === 0) return;
		untrack(() => {
			const detected = liveInput.detectedNote;
			if (detected !== null) scalePractice.handleDetectedNote(detected);
		});
	});

	// This component only mounts while the Scale Practice tab is active (see
	// +page.svelte), so a plain effect-cleanup is enough to stop the
	// metronome/click the moment the user switches to another tab — no
	// separate `fretfield.mode` watcher needed.
	$effect(() => {
		return () => scalePractice.stop();
	});

	const canStart = $derived(
		scalePractice.root !== null &&
			scalePractice.scaleId !== null &&
			scalePractice.sequence.length > 0
	);
	// Distinguishes "pick a root/scale" from "your zone doesn't reach any note
	// of this scale" — the empty-sequence case is the same either way in the
	// store, but they need different guidance.
	const zoneExcludesScale = $derived(
		scalePractice.root !== null &&
			scalePractice.scaleId !== null &&
			scalePractice.sequence.length === 0
	);

	const currentTargetLabel = $derived.by(() => {
		if (scalePractice.root === null || scalePractice.currentTarget === null) return null;
		const interval = intervalFromRoot(scalePractice.root, scalePractice.currentTarget);
		return `${intervalCompoundLabel(interval)} — ${defaultNoteName(scalePractice.currentTarget)}`;
	});

	function handleRootChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setRoot(value === '' ? null : (Number(value) as PitchClass));
	}

	function handleScaleChange(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setScaleId(value === '' ? null : value);
	}

	function handleMinFretChange(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		scalePractice.setZone(value, Math.max(value, scalePractice.zone.maxFret));
	}

	function handleMaxFretChange(event: Event): void {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		scalePractice.setZone(Math.min(scalePractice.zone.minFret, value), value);
	}

	function handleBpmChange(event: Event): void {
		scalePractice.setBpm(Number((event.currentTarget as HTMLInputElement).value));
	}

	function toggle(): void {
		if (scalePractice.running) {
			scalePractice.stop();
		} else {
			scalePractice.start();
		}
	}
</script>

<div class="scale-practice-controls" class:active={scalePractice.running}>
	<div class="top-row">
		<span class="field-label">Scale Practice</span>
		<button type="button" class="toggle" disabled={!canStart} onclick={toggle}>
			{scalePractice.running ? 'Stop' : 'Start'}
		</button>
	</div>

	<div class="fields">
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
		<label class="field">
			<span class="field-label">Scale</span>
			<select
				aria-label="Scale Practice scale"
				value={scalePractice.scaleId ?? ''}
				onchange={handleScaleChange}
			>
				<option value="">—</option>
				{#each listScales() as scale (scale.id)}
					<option value={scale.id}>{scale.label}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span class="field-label">From fret</span>
			<input
				type="number"
				aria-label="Zone start fret"
				min="0"
				max={DEFAULT_FRET_COUNT}
				value={scalePractice.zone.minFret}
				onchange={handleMinFretChange}
			/>
		</label>
		<label class="field">
			<span class="field-label">To fret</span>
			<input
				type="number"
				aria-label="Zone end fret"
				min="0"
				max={DEFAULT_FRET_COUNT}
				value={scalePractice.zone.maxFret}
				onchange={handleMaxFretChange}
			/>
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
	</div>

	{#if zoneExcludesScale}
		<p class="hint">No notes of this scale fall inside the chosen zone — widen it.</p>
	{:else if !liveInput.enabled}
		<p class="hint">Enable Live Input above to get feedback while you play.</p>
	{/if}

	{#if scalePractice.running}
		<p class="status" role="status">
			♩ = {scalePractice.bpm}
			{#if currentTargetLabel}
				· Target: <strong>{currentTargetLabel}</strong>
			{/if}
			· Step {(scalePractice.stepIndex % Math.max(scalePractice.sequence.length, 1)) + 1} of {scalePractice
				.sequence.length}
		</p>
	{/if}
</div>

<style>
	.scale-practice-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 1rem 1.25rem;
		box-shadow: 0 4px 16px rgb(124 58 237 / 0.08);
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.field-label {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--nut, #7c3aed);
		opacity: 0.85;
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

	.toggle:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.scale-practice-controls.active .toggle {
		background: var(--practice-target-accent, #10b981);
		color: #fff;
	}

	.fields {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
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

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
	}

	.status {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.85;
	}
</style>
