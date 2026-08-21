<script lang="ts">
	import { TIME_SIGNATURES } from '$lib/groove/time-signature';
	import type { CountIn } from '$lib/groove/transport';
	import type { GrooveFeel } from '$lib/groove/types';
	import GrooveEditor from '$lib/components/practice/GrooveEditor.svelte';
	import { defaultNoteName } from '$lib/music/pitch';
	import { resolvedChordSymbol } from '$lib/music/progressions';
	import {
		getScaleDefinition,
		listScales,
		scalePitchClasses,
		suggestedScalesFor
	} from '$lib/music/scales';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	type BandTab = 'drums' | 'harmony';
	let activeTab = $state<BandTab>('drums');
	let editorExpanded = $state(false);

	/** Whichever pattern is currently sounding (while playing) or was last selected for editing (while stopped) -- the Drums tab's readout. */
	const activePatternRole = $derived(
		scalePractice.activeBarIndex !== null
			? scalePractice.groove.arrangement[scalePractice.activeBarIndex]
			: scalePractice.selectedPatternRole
	);

	const barPositionLabel = $derived(
		scalePractice.running && scalePractice.activeBarIndex !== null
			? `${scalePractice.activeBarIndex + 1}/${scalePractice.groove.arrangement.length}`
			: null
	);

	function handleFeelChange(event: Event): void {
		scalePractice.setFeel((event.currentTarget as HTMLSelectElement).value as GrooveFeel);
	}

	function handleFeelAmountChange(event: Event): void {
		scalePractice.setFeelAmount(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleIntensityChange(event: Event): void {
		scalePractice.setIntensity(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handleCountInChange(event: Event): void {
		scalePractice.setCountIn((event.currentTarget as HTMLSelectElement).value as CountIn);
	}

	function handleChordScaleChange(index: number, event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		scalePractice.setProgressionChordScale(index, value === '' ? null : value);
	}

	const isCompoundMeter = $derived(TIME_SIGNATURES[scalePractice.groove.timeSignature].isCompound);
</script>

<div class="band-panel">
	<div class="band-tabs" role="group" aria-label="Band">
		<button
			type="button"
			class="band-tab"
			class:active={activeTab === 'drums'}
			onclick={() => (activeTab = 'drums')}
		>
			Drums
		</button>
		<button
			type="button"
			class="band-tab"
			class:active={activeTab === 'harmony'}
			onclick={() => (activeTab = 'harmony')}
		>
			Harmony
		</button>
	</div>

	{#if activeTab === 'drums'}
		<div class="drums-view">
			<label class="field">
				<span class="field-label">Feel</span>
				<select aria-label="Feel" value={scalePractice.groove.feel} onchange={handleFeelChange}>
					<option value="straight">Straight</option>
					<option value="shuffle">Shuffle</option>
					<option value="swing">Swing</option>
				</select>
			</label>
			<label class="field">
				<span class="field-label">Amount</span>
				<span class="swing-control">
					<input
						type="range"
						aria-label="Amount"
						min="0"
						max="100"
						disabled={scalePractice.groove.feel === 'straight' || isCompoundMeter}
						title={isCompoundMeter
							? `${scalePractice.groove.timeSignature} already has its own compound feel -- swing doesn't apply`
							: undefined}
						value={scalePractice.groove.feelAmount}
						onchange={handleFeelAmountChange}
					/>
					<span class="swing-readout">{scalePractice.groove.feelAmount}%</span>
				</span>
			</label>
			<label class="field">
				<span class="field-label">Intensity</span>
				<span class="swing-control">
					<input
						type="range"
						aria-label="Intensity"
						min="0"
						max="100"
						value={scalePractice.intensity}
						onchange={handleIntensityChange}
					/>
					<span class="swing-readout">{scalePractice.intensity}%</span>
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
			<span class="pattern-readout"
				>Pattern {activePatternRole}{#if barPositionLabel}<span class="bar-suffix"
						>· Bar {barPositionLabel}</span
					>{/if}</span
			>
			<button
				type="button"
				class="edit-groove-toggle"
				aria-expanded={editorExpanded}
				onclick={() => (editorExpanded = !editorExpanded)}
			>
				{editorExpanded ? 'Hide Groove Editor' : 'Edit Groove'}
			</button>
		</div>

		{#if editorExpanded}
			<GrooveEditor />
		{/if}
	{:else}
		<ol class="chord-strip" aria-label="Chord backing playback position" aria-live="polite">
			{#if scalePractice.resolvedProgression.length === 0}
				<li class="empty">Choose a progression above to see the current form.</li>
			{/if}
			{#each scalePractice.resolvedProgression as chord, index (index)}
				{@const isActive = index === scalePractice.activeChordIndex}
				{@const suggested = new Set(suggestedScalesFor(chord.chordId).map((s) => s.id))}
				{@const scaleId = scalePractice.progressionChordScales[index]}
				{@const scaleNotes = scaleId
					? scalePitchClasses(chord.root, getScaleDefinition(scaleId))
							.map(defaultNoteName)
							.join(' ')
					: null}
				<li class="chord-row">
					<button
						type="button"
						class="chord-chip"
						class:active={isActive}
						aria-current={isActive}
						onclick={() => scalePractice.setActiveChordIndex(index)}
					>
						{resolvedChordSymbol(chord)}
					</button>
					{#if isActive}
						<select
							class="chord-scale-select"
							aria-label={`Chord ${index + 1} scale`}
							value={scaleId ?? ''}
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
						{#if scaleNotes}
							<span class="scale-notes">{scaleNotes}</span>
						{/if}
					{:else}
						<span class="scale-label-compact"
							>{scaleId ? getScaleDefinition(scaleId).label : '—'}</span
						>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.band-panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
	}

	.band-tabs {
		display: flex;
		gap: 0.3rem;
	}

	.band-tab {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		border: 2px solid var(--fret-border, #ddd3f7);
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		cursor: pointer;
	}

	.band-tab.active {
		border-color: var(--nut, #7c3aed);
		background: color-mix(in srgb, var(--nut, #7c3aed) 10%, var(--fret-bg, #fff));
		color: var(--nut, #7c3aed);
	}

	.band-tab:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.drums-view {
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

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--fret-bg, #fff);
		color: var(--fret-fg, #241a3d);
		border: 2px solid var(--fret-border, #ddd3f7);
		border-radius: 8px;
		cursor: pointer;
	}

	select:hover {
		border-color: var(--nut, #7c3aed);
	}

	select:focus-visible,
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

	.pattern-readout {
		font-size: 0.85rem;
		font-weight: 700;
		opacity: 0.85;
	}

	.bar-suffix {
		margin-left: 0.35em;
	}

	.edit-groove-toggle {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--nut, #7c3aed);
		background: transparent;
		color: var(--nut, #7c3aed);
		cursor: pointer;
		margin-left: auto;
	}

	.edit-groove-toggle:hover {
		background: color-mix(in srgb, var(--nut, #7c3aed) 10%, transparent);
	}

	.edit-groove-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.chord-strip {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.empty {
		font-size: 0.85rem;
		opacity: 0.6;
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

	.scale-notes {
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		opacity: 0.7;
	}

	.scale-label-compact {
		font-size: 0.8rem;
		opacity: 0.65;
	}
</style>
