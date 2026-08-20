<script lang="ts">
	import { DRUM_VOICES, type DrumVoice, type Groove } from '$lib/groove/types';
	import { listGroovePresets } from '$lib/groove/presets';
	import type { CountIn } from '$lib/groove/transport';
	import ProgressionSelector from '$lib/components/ProgressionSelector.svelte';
	import { resolvedChordSymbol } from '$lib/music/progressions';
	import { listScales, suggestedScalesFor } from '$lib/music/scales';
	import type { SavedItem } from '$lib/stores/saved-collection.svelte';
	import { savedGrooves } from '$lib/stores/saved-grooves.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const VOICE_LABELS: Record<DrumVoice, string> = {
		kick: 'Kick',
		snare: 'Snare',
		closedHat: 'Closed Hat',
		openHat: 'Open Hat'
	};

	const presets = listGroovePresets();

	let savingAs = $state(false);
	let newGrooveName = $state('');
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function startSaving(): void {
		savingAs = true;
		newGrooveName = '';
	}

	function confirmSave(): void {
		const name = newGrooveName.trim();
		if (!name) return;
		savedGrooves.save(name, scalePractice.groove);
		savingAs = false;
	}

	function cancelSaving(): void {
		savingAs = false;
	}

	function startRenaming(item: SavedItem<Groove>): void {
		renamingId = item.id;
		renameValue = item.name;
	}

	function confirmRename(id: string): void {
		const trimmed = renameValue.trim();
		if (!trimmed) return;
		savedGrooves.rename(id, trimmed);
		renamingId = null;
	}

	function cancelRenaming(): void {
		renamingId = null;
	}

	function handleBpmChange(event: Event): void {
		scalePractice.setBpm(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleSwingChange(event: Event): void {
		scalePractice.setSwing(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleBarsPerChordChange(event: Event): void {
		scalePractice.setBarsPerChord(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleCountInChange(event: Event): void {
		scalePractice.setCountIn((event.currentTarget as HTMLSelectElement).value as CountIn);
	}

	function handleChordScaleChange(index: number, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setProgressionChordScale(index, value === '' ? null : value);
	}

	function handlePresetChange(event: Event): void {
		const id = (event.currentTarget as HTMLSelectElement).value;
		const preset = presets.find((p) => p.id === id);
		if (preset) {
			scalePractice.setGroove(preset.groove);
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

<div class="drum-machine">
	<div class="progression-row">
		<ProgressionSelector
			value={scalePractice.progressionTemplateId}
			onChange={(id) => scalePractice.setProgressionTemplate(id)}
		/>
		<label class="field">
			<span class="field-label">Bars per chord</span>
			<input
				type="number"
				aria-label="Bars per chord"
				min="1"
				max="8"
				value={scalePractice.barsPerChord}
				onchange={handleBarsPerChordChange}
			/>
		</label>
	</div>

	{#if scalePractice.resolvedProgression.length > 0}
		<ol class="chord-strip" aria-label="Chord backing playback position" aria-live="polite">
			{#each scalePractice.resolvedProgression as chord, index (index)}
				{@const suggested = new Set(suggestedScalesFor(chord.chordId).map((s) => s.id))}
				<li class="chord-row">
					<button
						type="button"
						class="chord-chip"
						class:active={index === scalePractice.activeChordIndex}
						aria-current={index === scalePractice.activeChordIndex}
						onclick={() => scalePractice.setActiveChordIndex(index)}
					>
						{resolvedChordSymbol(chord)}
					</button>
					<select
						class="chord-scale-select"
						aria-label={`Chord ${index + 1} scale`}
						value={scalePractice.progressionChordScales[index] ?? ''}
						onchange={(event) => handleChordScaleChange(index, event)}
					>
						<option value="">—</option>
						<optgroup label="Suggested">
							{#each suggestedScalesFor(chord.chordId) as scale (scale.id)}
								<option value={scale.id}>{scale.label}</option>
							{/each}
						</optgroup>
						<optgroup label="All scales">
							{#each listScales().filter((s) => !suggested.has(s.id)) as scale (scale.id)}
								<option value={scale.id}>{scale.label}</option>
							{/each}
						</optgroup>
					</select>
				</li>
			{/each}
		</ol>
	{/if}

	<div class="controls-row">
		<label class="field">
			<span class="field-label">Genre</span>
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
		<label class="field">
			<span class="field-label">Swing</span>
			<span class="swing-control">
				<input
					type="range"
					aria-label="Swing"
					min="0"
					max="100"
					value={scalePractice.groove.swing}
					onchange={handleSwingChange}
				/>
				<span class="swing-readout">{scalePractice.groove.swing}%</span>
			</span>
		</label>
		<label class="field">
			<span class="field-label">Count-in</span>
			<select aria-label="Count-in" value={scalePractice.countIn} onchange={handleCountInChange}>
				<option value="off">Off</option>
				<option value="1-bar">1 bar</option>
				<option value="2-bars">2 bars</option>
			</select>
		</label>
		{#if savingAs}
			<input
				class="name-input"
				type="text"
				placeholder="Name this groove…"
				aria-label="Groove name"
				bind:value={newGrooveName}
				onkeydown={(e) => e.key === 'Enter' && confirmSave()}
			/>
			<button
				type="button"
				class="save-confirm"
				onclick={confirmSave}
				disabled={!newGrooveName.trim()}
			>
				Save
			</button>
			<button type="button" class="save-cancel" onclick={cancelSaving}>Cancel</button>
		{:else}
			<button type="button" class="save-as" onclick={startSaving}>Save as…</button>
		{/if}
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

	<div class="step-grid">
		{#each DRUM_VOICES as voice (voice)}
			<div class="voice-row" role="group" aria-label={`${VOICE_LABELS[voice]} steps`}>
				<span class="voice-label">{VOICE_LABELS[voice]}</span>
				<div class="steps">
					{#each scalePractice.groove.patterns.A.steps[voice] as step, index (index)}
						<button
							type="button"
							class="step"
							class:active={step.velocity > 0}
							class:beat-start={index % 4 === 0}
							class:current={index === scalePractice.activeStepIndex}
							aria-label={`${VOICE_LABELS[voice]} step ${index + 1}`}
							aria-pressed={step.velocity > 0}
							onclick={() => scalePractice.toggleStep(voice, index)}
						>
							{#if step.velocity > 0}
								<span class="dot" aria-hidden="true"></span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if savedGrooves.items.length > 0}
		<div class="saved-list">
			<span class="field-label">My Grooves</span>
			<ul class="saved-items">
				{#each savedGrooves.items as item (item.id)}
					<li class="saved-item">
						{#if renamingId === item.id}
							<input
								class="name-input"
								type="text"
								aria-label="Rename groove"
								bind:value={renameValue}
								onkeydown={(e) => e.key === 'Enter' && confirmRename(item.id)}
							/>
							<button
								type="button"
								onclick={() => confirmRename(item.id)}
								disabled={!renameValue.trim()}>Save</button
							>
							<button type="button" onclick={cancelRenaming}>Cancel</button>
						{:else}
							<button
								type="button"
								class="saved-name"
								onclick={() => scalePractice.setGroove(item.data)}
							>
								{item.name}
							</button>
							<button type="button" onclick={() => startRenaming(item)}>Rename</button>
							<button
								type="button"
								class="remove"
								aria-label={`Delete ${item.name}`}
								onclick={() => savedGrooves.remove(item.id)}
							>
								×
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
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
		padding-top: 0.6rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
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

	.progression-row {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.chord-strip {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.chord-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.chord-chip {
		font: inherit;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		border-radius: 8px;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		cursor: pointer;
		min-width: 4.5rem;
	}

	.chord-chip:hover {
		border-color: var(--nut, #7c3aed);
	}

	.chord-chip:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.chord-chip.active {
		background: linear-gradient(135deg, var(--hero-from, #7c3aed), var(--hero-to, #ec4899));
		color: #fff;
		border-color: transparent;
		box-shadow: 0 2px 8px rgb(124 58 237 / 0.35);
	}

	.chord-scale-select {
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
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

	.name-input {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
	}

	.name-input:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.save-as,
	.save-confirm,
	.save-cancel,
	.saved-item button {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--nut, #7c3aed);
		background: transparent;
		color: var(--nut, #7c3aed);
		cursor: pointer;
	}

	.save-confirm:disabled,
	.saved-item button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.save-as:focus-visible,
	.save-confirm:focus-visible,
	.save-cancel:focus-visible,
	.saved-item button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.saved-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.saved-items {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.saved-item {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.saved-name {
		font-weight: 600;
		flex: 1 1 auto;
		text-align: left;
	}

	.saved-item .remove {
		border-color: var(--fret-border, #ddd3f7);
		color: var(--role-alteration, #ef4444);
	}

	.saved-item .remove:hover {
		border-color: var(--role-alteration, #ef4444);
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

	/* The playhead: whichever 16th-note step is sounding right now, pulsing in
	   time with the beat so the grid gives a visual "click" alongside the audio. */
	.step.current {
		border-color: var(--nut, #7c3aed);
		box-shadow: 0 0 0 2px var(--nut, #7c3aed);
		animation: step-pulse 0.12s ease-out;
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
