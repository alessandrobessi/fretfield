<script lang="ts">
	import type {
		AcidBassMode,
		AcidBassStep,
		AcidOctaveOffset,
		AcidStepLocks,
		BassHarmonyMode,
		BasslineStyleId,
		BassRegisterMode
	} from '$lib/acid-bass/types';
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
	import HardwareButton from '$lib/components/hardware/HardwareButton.svelte';
	import HardwarePanel from '$lib/components/hardware/HardwarePanel.svelte';
	import Knob from '$lib/components/hardware/Knob.svelte';
	import AcidBassStepEditor from '$lib/components/practice/AcidBassStepEditor.svelte';
	import AcidBassStepGrid from '$lib/components/practice/AcidBassStepGrid.svelte';
	import GrooveArrangementStrip from '$lib/components/GrooveArrangementStrip.svelte';
	import { recommendBasslineStyles } from '$lib/music/bassline/recommendations';
	import { listBasslineStyleProfiles } from '$lib/music/bassline/styles';
	import { intervalLabel, type IntervalId } from '$lib/music/intervals';
	import { defaultNoteName } from '$lib/music/pitch';
	import type { SavedItem } from '$lib/stores/saved-collection.svelte';
	import { savedGrooves } from '$lib/stores/saved-grooves.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	/** Transient UI focus only -- which Bass step the step editor below is showing, not part of saved groove data. */
	let selectedAcidStepIndex = $state<number | null>(null);

	// Acid Bass Intelligence V4: Manual/Generated mode and the generation
	// controls live here, co-located with "Bass Steps" -- whichever mode is
	// active, this is the one place "the bass pattern" is shown (manual
	// editable steps, or the generated read-only line), rather than the mode
	// switch living in a disconnected panel while this tab kept showing a
	// stale manual editor regardless of it.
	const MODES: { id: AcidBassMode; label: string }[] = [
		{ id: 'manual', label: 'Manual' },
		{ id: 'generated', label: 'Generated' }
	];
	const STYLES: { id: BasslineStyleId; label: string }[] = listBasslineStyleProfiles().map(
		(profile) => ({ id: profile.id, label: profile.label })
	);
	const HARMONY_MODES: { id: BassHarmonyMode; label: string }[] = [
		{ id: 'chord', label: 'Chord' },
		{ id: 'key', label: 'Key' },
		{ id: 'voice-leading', label: 'Voice Lead' }
	];
	const REGISTER_MODES: { id: BassRegisterMode; label: string }[] = [
		{ id: 'low', label: 'Low' },
		{ id: 'mid', label: 'Mid' },
		{ id: 'high', label: 'High' },
		{ id: 'zone', label: 'Zone' }
	];

	const generation = $derived(scalePractice.groove.acidBass.generation);
	const generatedPlan = $derived(scalePractice.generatedBasslinePlan);

	/**
	 * Acid Bass Intelligence V4 §23 -- ranked purely from the current
	 * progression's own chord-family sequence, never from `generation.style`
	 * itself (a recommendation must never look like it's reacting to the
	 * user's own current pick). `scaleId: null` throughout: `recommendBasslineStyles`
	 * only reads each chord's family, so the per-chord scale assignment is
	 * irrelevant here.
	 */
	const styleRecommendations = $derived(
		recommendBasslineStyles(
			scalePractice.resolvedProgression.map((chord) => ({
				root: chord.root,
				chordId: chord.chordId,
				scaleId: null
			}))
		).slice(0, 3)
	);

	let selectedGeneratedBarIndex = $state(0);
	let selectedGeneratedStepIndex = $state<number | null>(null);

	/** Same "follow while playing, remember the manual pick once stopped" convention `BandPanel.svelte`'s own `activePatternRole` already uses for the drum/manual Acid Bass grids -- otherwise Generated mode has no way to show which step is actually sounding right now, unlike Manual mode's `activeStepIndex` highlight. */
	const displayedGeneratedBarIndex = $derived(
		scalePractice.running && scalePractice.activeGeneratedBarIndex !== null
			? scalePractice.activeGeneratedBarIndex
			: selectedGeneratedBarIndex
	);
	/** Whether the bar currently shown is genuinely the one playing right now -- guards the step grid's `current` playhead highlight so it never lights up a manually-browsed bar that isn't actually sounding. */
	const isViewingPlayingGeneratedBar = $derived(
		scalePractice.running &&
			scalePractice.activeGeneratedBarIndex !== null &&
			scalePractice.activeGeneratedBarIndex === displayedGeneratedBarIndex
	);

	/** Clamped to the plan's own current bar count -- an arrangement/progression edit can shrink the cycle out from under whatever bar was previously selected. */
	const selectedGeneratedBar = $derived.by(() => {
		if (generatedPlan === null || generatedPlan.bars.length === 0) return null;
		const index = Math.min(displayedGeneratedBarIndex, generatedPlan.bars.length - 1);
		return generatedPlan.bars[index];
	});
	const selectedGeneratedStep = $derived(
		selectedGeneratedBar !== null && selectedGeneratedStepIndex !== null
			? (selectedGeneratedBar.steps[selectedGeneratedStepIndex] ?? null)
			: null
	);

	function selectGeneratedBar(index: number): void {
		selectedGeneratedBarIndex = index;
		selectedGeneratedStepIndex = null;
	}

	/** "chord-tone" -> "Chord Tone" -- musical-language labels throughout (spec §48), never the raw camelCase/kebab-case identifier. */
	function functionLabel(fn: string): string {
		return fn
			.split('-')
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
	}

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

	const selectedAcidPattern = $derived(
		scalePractice.groove.acidBass.patterns[scalePractice.selectedPatternRole]
	);
	const selectedAcidStep = $derived(
		selectedAcidStepIndex !== null ? (selectedAcidPattern[selectedAcidStepIndex] ?? null) : null
	);

	function handleSetAcidStepActive(active: boolean): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepActive(selectedAcidStepIndex, active);
	}

	function handleSetAcidStepInterval(interval: IntervalId): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepInterval(selectedAcidStepIndex, interval);
	}

	function handleSetAcidStepOctave(octave: AcidOctaveOffset): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepOctave(selectedAcidStepIndex, octave);
	}

	function handleToggleAcidStepAccent(): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.toggleAcidStepAccent(selectedAcidStepIndex);
	}

	function handleToggleAcidStepSlide(): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.toggleAcidStepSlide(selectedAcidStepIndex);
	}

	function handleSetAcidStepProbability(probability: number): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepProbability(selectedAcidStepIndex, probability);
	}

	function handleSetAcidStepRatchet(ratchet: AcidBassStep['ratchet']): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepRatchet(selectedAcidStepIndex, ratchet);
	}

	function handleSetAcidStepGate(gate: number): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepGate(selectedAcidStepIndex, gate);
	}

	function handleSetAcidStepLock(target: keyof AcidStepLocks, value: number | undefined): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.setAcidStepLock(selectedAcidStepIndex, target, value);
	}

	function handleClearAcidStepLocks(): void {
		if (selectedAcidStepIndex === null) return;
		scalePractice.clearAcidStepLocks(selectedAcidStepIndex);
	}
</script>

{#snippet pickerField(
	label: string,
	options: { id: string; label: string }[],
	selected: string,
	onSelect: (id: string) => void
)}
	<div class="field">
		<span class="ff-label field-label">{label}</span>
		<div class="picker" role="group" aria-label={label}>
			{#each options as opt (opt.id)}
				<button
					type="button"
					class="picker-button"
					class:active={selected === opt.id}
					aria-pressed={selected === opt.id}
					onclick={() => onSelect(opt.id)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet knobField(
	label: string,
	value: number,
	onChange: (v: number) => void,
	min = 0,
	max = 100
)}
	<div class="field">
		<span class="ff-label field-label">{label}</span>
		<Knob {label} {value} {min} {max} {onChange} />
	</div>
{/snippet}

<HardwarePanel title="Groove Editor" class="groove-editor">
	<div class="controls-row">
		<label class="field">
			<span class="ff-label field-label">Time Signature</span>
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
			<span class="ff-label field-label">Bars per chord</span>
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
			<HardwareButton variant="secondary" onclick={confirmSave} disabled={!newGrooveName.trim()}>
				Save
			</HardwareButton>
			<HardwareButton variant="secondary" onclick={cancelSaving}>Cancel</HardwareButton>
		{:else}
			<HardwareButton variant="secondary" onclick={startSaving}>Save as…</HardwareButton>
		{/if}
	</div>

	<div class="arrangement-row">
		<span class="ff-label field-label">Arrangement</span>
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
		<span class="ff-label field-label">Editing pattern</span>
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

	<div class="step-grid-tabs" role="group" aria-label="Step grid">
		<button
			type="button"
			class="step-grid-tab"
			class:active={scalePractice.selectedStepGridTab === 'drums'}
			onclick={() => (scalePractice.selectedStepGridTab = 'drums')}
		>
			Drum Steps
		</button>
		<button
			type="button"
			class="step-grid-tab"
			class:active={scalePractice.selectedStepGridTab === 'bass'}
			onclick={() => (scalePractice.selectedStepGridTab = 'bass')}
		>
			Bass Steps
		</button>
	</div>

	{#if scalePractice.selectedStepGridTab === 'drums'}
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
	{:else}
		{@render pickerField('Mode', MODES, scalePractice.groove.acidBass.mode, (id) =>
			scalePractice.setAcidBassMode(id as AcidBassMode)
		)}

		{#if scalePractice.groove.acidBass.mode === 'manual'}
			<div class="transform-row" role="group" aria-label="Bass pattern transforms">
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.rotateAcidPatternLeft()}
				>
					Rotate ◀
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.rotateAcidPatternRight()}
				>
					Rotate ▶
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.simplifyAcidPattern()}
				>
					Simplify
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.densifyAcidPattern()}
				>
					Densify
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.octaveShiftAcidPattern(1)}
				>
					Octave ▲
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.octaveShiftAcidPattern(-1)}
				>
					Octave ▼
				</button>
				<button
					type="button"
					class="transform-button"
					onclick={() => scalePractice.clearAcidPatternLocks()}
				>
					Clear All Locks
				</button>
			</div>
			<div class="step-grid">
				<AcidBassStepGrid
					pattern={selectedAcidPattern}
					{stepsPerBeatGroup}
					activeStepIndex={scalePractice.activeStepIndex}
					selectedStepIndex={selectedAcidStepIndex}
					onSelectStep={(index) => (selectedAcidStepIndex = index)}
				/>
			</div>
			<AcidBassStepEditor
				step={selectedAcidStep}
				stepIndex={selectedAcidStepIndex}
				onSetActive={handleSetAcidStepActive}
				onSetInterval={handleSetAcidStepInterval}
				onSetOctave={handleSetAcidStepOctave}
				onToggleAccent={handleToggleAcidStepAccent}
				onToggleSlide={handleToggleAcidStepSlide}
				onSetProbability={handleSetAcidStepProbability}
				onSetRatchet={handleSetAcidStepRatchet}
				onSetGate={handleSetAcidStepGate}
				onSetLock={handleSetAcidStepLock}
				onClearLocks={handleClearAcidStepLocks}
			/>
		{:else}
			{#if styleRecommendations.length > 0}
				<p class="style-recommendation">
					Recommended:
					{#each styleRecommendations as recommendation, index (recommendation.style)}
						{#if index > 0}<span aria-hidden="true"> · </span>{/if}<button
							type="button"
							class="style-recommendation-pick"
							title={recommendation.reason}
							onclick={() => scalePractice.setAcidBassGenerationStyle(recommendation.style)}
							>{STYLES.find((style) => style.id === recommendation.style)?.label ??
								recommendation.style}</button
						>
					{/each}
				</p>
			{/if}
			{@render pickerField('Style', STYLES, generation.style, (id) =>
				scalePractice.setAcidBassGenerationStyle(id as BasslineStyleId)
			)}
			{@render pickerField('Harmony', HARMONY_MODES, generation.harmonyMode, (id) =>
				scalePractice.setAcidBassGenerationHarmonyMode(id as BassHarmonyMode)
			)}
			{@render pickerField('Register', REGISTER_MODES, generation.register, (id) =>
				scalePractice.setAcidBassGenerationRegister(id as BassRegisterMode)
			)}
			<div class="row">
				{@render knobField('Density', generation.density, (v) =>
					scalePractice.setAcidBassGenerationDensity(v)
				)}
				{@render knobField('Chromatic', generation.chromaticism, (v) =>
					scalePractice.setAcidBassGenerationChromaticism(v)
				)}
				{@render knobField('Movement', generation.movement, (v) =>
					scalePractice.setAcidBassGenerationMovement(v)
				)}
				{@render knobField('Playability', generation.playability, (v) =>
					scalePractice.setAcidBassGenerationPlayability(v)
				)}
				{@render knobField('Intelligence', generation.intelligence, (v) =>
					scalePractice.setAcidBassGenerationIntelligence(v)
				)}
			</div>

			<HardwareButton variant="secondary" onclick={() => scalePractice.newAcidBassVariation()}>
				New Variation
			</HardwareButton>

			{#if generatedPlan === null}
				<p class="generation-unavailable">
					Choose a root and progression above to generate a bassline.
				</p>
			{:else if selectedGeneratedBar !== null}
				<div class="generated-inspector">
					<div class="bar-strip" role="group" aria-label="Generated bar">
						{#each generatedPlan.bars as bar, index (bar.barIndex)}
							<button
								type="button"
								class="bar-strip-button"
								class:active={index === displayedGeneratedBarIndex}
								aria-pressed={index === displayedGeneratedBarIndex}
								onclick={() => selectGeneratedBar(index)}
							>
								{index + 1}
							</button>
						{/each}
					</div>

					<div
						class="generated-step-grid"
						role="group"
						aria-label={`Bar ${displayedGeneratedBarIndex + 1} steps`}
					>
						{#each selectedGeneratedBar.steps as step, index (index)}
							<button
								type="button"
								class="generated-step"
								class:active={step.active}
								class:accent={step.active && step.accent}
								class:slide={step.active && step.slide}
								class:selected={index === selectedGeneratedStepIndex}
								class:current={isViewingPlayingGeneratedBar &&
									index === scalePractice.activeStepIndex}
								aria-pressed={index === selectedGeneratedStepIndex}
								aria-label={step.active
									? `Step ${index + 1}, ${defaultNoteName(step.pitchClass)}${step.accent ? ', accent' : ''}${step.slide ? ', slide' : ''}`
									: `Step ${index + 1}, rest`}
								disabled={!step.active}
								onclick={() => (selectedGeneratedStepIndex = index)}
							>
								{step.active ? intervalLabel(step.intervalFromChord) : ''}
							</button>
						{/each}
					</div>

					{#if selectedGeneratedStep !== null && selectedGeneratedStep.active}
						<dl class="step-inspector">
							<div>
								<dt>Note</dt>
								<dd>{defaultNoteName(selectedGeneratedStep.pitchClass)}</dd>
							</div>
							<div>
								<dt>Interval</dt>
								<dd>{intervalLabel(selectedGeneratedStep.intervalFromChord)}</dd>
							</div>
							<div>
								<dt>Function</dt>
								<dd>{functionLabel(selectedGeneratedStep.function)}</dd>
							</div>
							<div>
								<dt>Position</dt>
								<dd>
									{#if selectedGeneratedStep.preferredPosition}
										String {selectedGeneratedStep.preferredPosition.stringIndex + 1} · Fret {selectedGeneratedStep
											.preferredPosition.fret}
									{:else}
										—
									{/if}
								</dd>
							</div>
							<div class="explanation">
								<dt>{selectedGeneratedStep.explanation.headline}</dt>
								<dd>{selectedGeneratedStep.explanation.detail}</dd>
							</div>
						</dl>
					{:else}
						<p class="generation-unavailable">Select an active step to inspect it.</p>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}

	{#if savedGrooves.items.length > 0}
		<div class="saved-list">
			<span class="ff-label field-label">My Grooves</span>
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
</HardwarePanel>

<style>
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
		color: inherit;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.style-recommendation {
		margin: 0;
		font-size: 0.78rem;
		color: var(--ff-black, #151411);
	}

	.style-recommendation-pick {
		font: inherit;
		font-weight: 700;
		padding: 0;
		background: transparent;
		color: var(--ff-black, #151411);
		border: none;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.style-recommendation-pick:focus-visible {
		outline: 3px solid var(--ff-black, #151411);
		outline-offset: 1px;
	}

	.picker {
		display: flex;
		flex-wrap: wrap;
		max-width: 100%;
		border: 1px solid var(--ff-black, #151411);
		border-radius: var(--ff-radius-control, 4px);
		overflow: hidden;
		background: var(--ff-black, #151411);
	}

	.picker-button {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.4rem 0.7rem;
		background: transparent;
		color: var(--ff-yellow, #e3ac18);
		border: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.picker-button.active {
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
	}

	.picker-button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: -3px;
	}

	select,
	input[type='number'] {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--ff-black, #151411);
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
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	select:focus-visible,
	input[type='number']:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}

	.name-input {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--surface-border, #3a382f);
		background: var(--ff-black, #151411);
		color: var(--fg, #f1e6c5);
	}

	.name-input:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}

	.saved-item button {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.35rem 0.8rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.saved-item button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.saved-item button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.saved-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid color-mix(in srgb, currentColor 25%, transparent);
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

	/* Red, not a role color: this is a destructive action (delete), the same
	   restrained reuse of Signal Red the rest of the app gives error/danger
	   UI now that --role-alteration itself no longer means "danger." */
	.saved-item .remove {
		border-color: var(--ff-red, #e34832);
		color: var(--ff-red, #e34832);
	}

	.saved-item .remove:hover {
		background: color-mix(in srgb, var(--ff-red, #e34832) 16%, transparent);
	}

	.arrangement-row,
	.pattern-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding-top: 0.6rem;
		border-top: 1px solid color-mix(in srgb, currentColor 25%, transparent);
	}

	.bar-count {
		font: inherit;
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.3rem 0.6rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.bar-count:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.bar-count:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.transform-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.transform-button {
		font: inherit;
		font-weight: 700;
		font-size: 0.7rem;
		padding: 0.3rem 0.6rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.transform-button:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.transform-button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.generation-unavailable {
		font-size: 0.8rem;
		opacity: 0.8;
		margin: 0;
	}

	.generated-inspector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}

	.bar-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		max-width: 100%;
		overflow-x: auto;
	}

	.bar-strip-button {
		font: inherit;
		font-weight: 600;
		font-size: 0.7rem;
		min-width: 1.6rem;
		padding: 0.25rem 0.4rem;
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	.bar-strip-button.active {
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	/* Accent/slide are shown via border weight/style, not color alone --
	   selection via filled background -- so the grid stays legible without
	   relying on color perception. */
	.generated-step-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(1.8rem, 1fr));
		gap: 0.2rem;
		width: 100%;
	}

	.generated-step {
		font: inherit;
		font-weight: 700;
		font-size: 0.7rem;
		aspect-ratio: 1;
		background: var(--ff-black, #151411);
		color: var(--ff-ivory, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
		opacity: 0.4;
	}

	.generated-step.active {
		opacity: 1;
		color: var(--ff-yellow, #e3ac18);
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	.generated-step.active.accent {
		border-width: 2px;
	}

	.generated-step.active.slide {
		border-style: dashed;
	}

	.generated-step.selected {
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
	}

	.generated-step:disabled {
		cursor: default;
	}

	.generated-step:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}

	/* The playhead -- same red-glow-pulse convention as the manual grid's own `.step.current` (`step-pulse`, defined once below, is shared by both). */
	.generated-step.current {
		border-color: var(--ff-red, #e34832);
		box-shadow:
			0 0 0 2px var(--ff-red, #e34832),
			0 0 0.5rem 0.05rem var(--ff-red, #e34832);
		animation: step-pulse 500ms ease-in-out;
	}

	.step-inspector {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem 1rem;
		margin: 0;
		font-size: 0.8rem;
		width: 100%;
	}

	.step-inspector dt {
		font-weight: 700;
		opacity: 0.7;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.step-inspector dd {
		margin: 0;
	}

	.step-inspector .explanation {
		grid-column: 1 / -1;
	}

	/* The A/B/F/T pattern-role selector -- hardware toggle group per spec §12. */
	.role-picker {
		display: flex;
		gap: 0.3rem;
	}

	.role-button {
		font: inherit;
		font-weight: 700;
		width: 2.2rem;
		padding: 0.3rem 0;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
		cursor: pointer;
	}

	.role-button:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.role-button.active {
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
		border-color: var(--ff-black, #151411);
	}

	.role-button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.step-grid-tabs {
		display: inline-flex;
		border: 1px solid var(--ff-black, #151411);
		border-radius: var(--ff-radius-control, 4px);
		overflow: hidden;
	}

	.step-grid-tab {
		font: inherit;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.35rem 0.75rem;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.step-grid-tab.active {
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
	}

	.step-grid-tab:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: -3px;
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
		color: inherit;
		background: var(--ff-yellow, #e3ac18);
	}

	.steps {
		display: flex;
		gap: 0.2rem;
		flex-wrap: nowrap;
	}

	/* Black step keys set into the yellow chassis (spec §12/§15), not a
	   lighter/neutral control -- this is the one place "black controls on a
	   yellow faceplate" reads most literally. */
	.step {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		padding: 0;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-carbon, #262521);
		background: var(--ff-black, #151411);
		cursor: pointer;
	}

	/* A subtle visual break every 4 steps (one beat), matching a real step sequencer's grid. */
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

	/* Programmed on -- yellow (selected/intentional), not a status color:
	   this is authored pattern data, not a live/transient signal. */
	.step.active {
		background: color-mix(in srgb, var(--ff-yellow, #e3ac18) 22%, var(--ff-black, #151411));
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	.step .dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--ff-yellow, #e3ac18);
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

	/* The playhead: whichever 16th-note step is sounding right now -- red LED
	   glow (a static cue, so it survives reduced-motion) plus the spec's own
	   recommended pulse timing (§10) layered on top. */
	.step.current {
		border-color: var(--ff-red, #e34832);
		box-shadow:
			0 0 0 2px var(--ff-red, #e34832),
			0 0 0.5rem 0.05rem var(--ff-red, #e34832);
		animation: step-pulse 500ms ease-in-out;
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
