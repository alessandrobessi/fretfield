<script lang="ts">
	import {
		DRUM_VOICES,
		PATTERN_ROLES,
		type DrumVoice,
		type Groove,
		type PatternRole
	} from '$lib/groove/types';
	import {
		listTimeSignatures,
		TIME_SIGNATURES,
		type TimeSignature
	} from '$lib/groove/time-signature';
	import GrooveArrangementStrip from '$lib/components/GrooveArrangementStrip.svelte';
	import type { SavedItem } from '$lib/stores/saved-collection.svelte';
	import { savedGrooves } from '$lib/stores/saved-grooves.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const VOICE_LABELS: Record<DrumVoice, string> = {
		kick: 'Kick',
		snare: 'Snare',
		closedHat: 'Closed Hat',
		openHat: 'Open Hat',
		ride: 'Ride',
		rim: 'Rim'
	};

	const VELOCITY_LABELS: Record<number, string> = {
		0: 'off',
		0.35: 'ghost',
		0.7: 'normal',
		1: 'accent'
	};

	const timeSignatures = listTimeSignatures();
	const stepsPerBeatGroup = $derived(
		TIME_SIGNATURES[scalePractice.groove.timeSignature].stepsPerBeatGroup
	);

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

	function handleTimeSignatureChange(event: Event): void {
		scalePractice.setTimeSignature(
			(event.currentTarget as HTMLSelectElement).value as TimeSignature
		);
	}

	function handleBarsPerChordChange(event: Event): void {
		scalePractice.setBarsPerChord(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleAssignBar(barIndex: number, role: PatternRole): void {
		scalePractice.setArrangementBar(barIndex, role);
		scalePractice.setSelectedPatternRole(role);
	}

	/** Click cycles off->ghost->normal->accent->off; Shift-click jumps straight to accent; Alt/Option-click clears to off. */
	function handleStepClick(voice: DrumVoice, index: number, event: MouseEvent): void {
		if (event.altKey) {
			scalePractice.setStepVelocity(voice, index, 0);
		} else if (event.shiftKey) {
			scalePractice.setStepVelocity(voice, index, 1);
		} else {
			scalePractice.cycleStep(voice, index);
		}
	}

	function addBar(): void {
		scalePractice.setArrangementLength(scalePractice.groove.arrangement.length + 1);
	}

	function removeBar(): void {
		scalePractice.setArrangementLength(scalePractice.groove.arrangement.length - 1);
	}
</script>

<div class="groove-editor">
	<div class="controls-row">
		<label class="field">
			<span class="field-label">Time Signature</span>
			<select
				aria-label="Time Signature"
				value={scalePractice.groove.timeSignature}
				onchange={handleTimeSignatureChange}
			>
				{#each timeSignatures as ts (ts)}
					<option value={ts}>{TIME_SIGNATURES[ts].label}</option>
				{/each}
			</select>
		</label>
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
	</div>

	<div class="arrangement-row">
		<span class="field-label">Arrangement</span>
		<GrooveArrangementStrip
			arrangement={scalePractice.groove.arrangement}
			activeBarIndex={scalePractice.activeBarIndex}
			onAssign={handleAssignBar}
			chordLabels={scalePractice.barChordLabels}
		/>
		<button
			type="button"
			class="bar-count"
			onclick={removeBar}
			disabled={scalePractice.groove.arrangement.length <= 1}
			aria-label="Remove last bar"
		>
			− Bar
		</button>
		<button type="button" class="bar-count" onclick={addBar} aria-label="Add bar">+ Bar</button>
	</div>

	<div class="pattern-row">
		<span class="field-label">Editing pattern</span>
		<div class="role-picker" role="group" aria-label="Pattern to edit">
			{#each PATTERN_ROLES as role (role)}
				<button
					type="button"
					class="role-button"
					class:active={scalePractice.selectedPatternRole === role}
					onclick={() => scalePractice.setSelectedPatternRole(role)}
				>
					{role}
				</button>
			{/each}
		</div>
	</div>

	<div class="step-grid">
		{#each DRUM_VOICES as voice (voice)}
			<div class="voice-row" role="group" aria-label={`${VOICE_LABELS[voice]} steps`}>
				<span class="voice-label">{VOICE_LABELS[voice]}</span>
				<div class="steps">
					{#each scalePractice.groove.patterns[scalePractice.selectedPatternRole].steps[voice] as step, index (index)}
						<button
							type="button"
							class="step"
							class:active={step.velocity > 0}
							class:velocity-ghost={step.velocity === 0.35}
							class:velocity-accent={step.velocity === 1}
							class:beat-start={index % stepsPerBeatGroup === 0}
							class:current={index === scalePractice.activeStepIndex}
							data-velocity={step.velocity}
							aria-label={`${VOICE_LABELS[voice]} step ${index + 1}`}
							aria-pressed={step.velocity > 0}
							title={`${VOICE_LABELS[voice]} step ${index + 1}: ${VELOCITY_LABELS[step.velocity]}`}
							onclick={(event) => handleStepClick(voice, index, event)}
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
	.groove-editor {
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
	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
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

	.arrangement-row,
	.pattern-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.bar-count {
		font: inherit;
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--nut, #7c3aed);
		background: transparent;
		color: var(--nut, #7c3aed);
		cursor: pointer;
	}

	.bar-count:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.bar-count:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.role-picker {
		display: flex;
		gap: 0.3rem;
	}

	.role-button {
		font: inherit;
		font-weight: 700;
		width: 2.2rem;
		padding: 0.3rem 0;
		border-radius: 6px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
	}

	.role-button:hover {
		border-color: var(--nut, #7c3aed);
	}

	.role-button.active {
		border-color: var(--nut, #7c3aed);
		background: linear-gradient(135deg, var(--hero-from, #7c3aed), var(--hero-to, #ec4899));
		color: #fff;
	}

	.role-button:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.step-grid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		/* Horizontal scroll rather than wrap once the row is wider than the
		   viewport (a narrow screen, or a compound meter's 24-step pattern) --
		   same fallback Fretboard.svelte's own .fretboard-scroll uses. */
		overflow-x: auto;
		max-width: 100%;
	}

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

	/* Velocity is encoded by more than color alone (AGENTS.md): dot size,
	   opacity, and (for accent) a thicker border ring. */
	.step.velocity-ghost .dot {
		width: 0.3rem;
		height: 0.3rem;
		opacity: 0.6;
	}

	.step.velocity-accent {
		border-width: 2px;
	}

	.step.velocity-accent .dot {
		width: 0.8rem;
		height: 0.8rem;
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
