<script lang="ts">
	import { listAcidBassFactoryPatches } from '$lib/acid-bass/factory-patches';
	import { lfoRateHzClamp, lfoSyncFrequencyHz } from '$lib/acid-bass/resolve';
	import type {
		AcidAuxModulationPatch,
		AcidDistortionCharacter,
		AcidFilterModel,
		AcidGlideCurve,
		AcidLfoDestination,
		AcidLfoDivision,
		AcidLfoPatch,
		AcidLfoRateMode,
		AcidLfoShape,
		AcidModulationDestination,
		AcidSubOctave,
		AcidSubWave,
		AcidWave
	} from '$lib/acid-bass/types';
	import HardwareButton from '$lib/components/hardware/HardwareButton.svelte';
	import HardwarePanel from '$lib/components/hardware/HardwarePanel.svelte';
	import Knob from '$lib/components/hardware/Knob.svelte';
	import Led from '$lib/components/hardware/Led.svelte';
	import AcidBassLfoScope from './AcidBassLfoScope.svelte';
	import { scalePractice } from '$lib/stores/scale-practice.svelte';

	const FACTORY_PATCHES = listAcidBassFactoryPatches();

	const MAIN_WAVES: { id: AcidWave; label: string }[] = [
		{ id: 'saw', label: 'Saw' },
		{ id: 'square', label: 'Square' },
		{ id: 'triangle', label: 'Triangle' },
		{ id: 'pulse', label: 'Pulse' }
	];
	const SUB_WAVES: { id: AcidSubWave; label: string }[] = [
		{ id: 'square', label: 'Square' },
		{ id: 'triangle', label: 'Triangle' }
	];
	const SUB_OCTAVES: { id: string; label: string }[] = [
		{ id: '-1', label: '−1 oct' },
		{ id: '-2', label: '−2 oct' }
	];
	const FILTER_MODELS: { id: AcidFilterModel; label: string }[] = [
		{ id: 'legacy', label: 'Legacy' },
		{ id: 'svf12', label: 'SVF-12' },
		{ id: 'acid24', label: 'Acid 24' }
	];
	const GLIDE_CURVES: { id: AcidGlideCurve; label: string }[] = [
		{ id: 'linear', label: 'Linear' },
		{ id: 'exponential', label: 'Exponential' }
	];
	// Shared by both Saturation (VCF) and Drive (OUTPUT) -- one character, not
	// two independent pickers, see `AcidDistortionPatch`'s own doc comment.
	const DISTORTION_CHARACTERS: { id: AcidDistortionCharacter; label: string }[] = [
		{ id: 'soft', label: 'Soft' },
		{ id: 'diode', label: 'Diode' },
		{ id: 'hard', label: 'Hard' }
	];
	const LFO_SHAPES: { id: AcidLfoShape; label: string }[] = [
		{ id: 'sine', label: 'Sine' },
		{ id: 'triangle', label: 'Triangle' },
		{ id: 'square', label: 'Square' },
		{ id: 'sampleHold', label: 'S&H' }
	];
	const LFO_DESTINATIONS: { id: AcidLfoDestination; label: string }[] = [
		{ id: 'cutoff', label: 'Cutoff' },
		{ id: 'pitch', label: 'Pitch' },
		{ id: 'pulseWidth', label: 'Pulse Width' },
		{ id: 'subLevel', label: 'Sub Level' },
		{ id: 'osc2Level', label: 'Osc 2 Level' }
	];
	const LFO_RATE_MODES: { id: AcidLfoRateMode; label: string }[] = [
		{ id: 'free', label: 'Free' },
		{ id: 'sync', label: 'Sync' }
	];
	const LFO_DIVISIONS: AcidLfoDivision[] = [
		'1/1',
		'1/2',
		'1/4',
		'1/8',
		'1/8T',
		'1/16',
		'1/16T',
		'1/32'
	];
	// Wider than LFO_DESTINATIONS -- adds Resonance/Drive, which only the aux
	// modulation sources (Envelope/Accent/Random, M15) can reach so far.
	const MOD_DESTINATIONS: { id: AcidModulationDestination; label: string }[] = [
		{ id: 'cutoff', label: 'Cutoff' },
		{ id: 'resonance', label: 'Resonance' },
		{ id: 'pitch', label: 'Pitch' },
		{ id: 'pulseWidth', label: 'Pulse Width' },
		{ id: 'subLevel', label: 'Sub Level' },
		{ id: 'osc2Level', label: 'Osc 2 Level' },
		{ id: 'drive', label: 'Drive' }
	];

	const patch = $derived(scalePractice.groove.acidBass.patch);

	/** An LFO's actual oscillation rate right now, in Sync mode as much as Free -- what its indicator dot's blink rate and Hz readout both key off. Shared by both LFO panels, called with whichever slot's own patch. */
	function lfoHz(lfoPatch: AcidLfoPatch): number {
		return lfoPatch.rateMode === 'sync'
			? lfoSyncFrequencyHz(scalePractice.bpm, lfoPatch.division)
			: lfoRateHzClamp(lfoPatch.rateHz);
	}
</script>

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

{#snippet lfoPanelBody(lfoSlot: 1 | 2, lfoPatch: AcidLfoPatch)}
	{@const hz = lfoHz(lfoPatch)}
	<div class="row">
		<HardwareButton
			variant="secondary"
			pressed={lfoPatch.enabled}
			ariaLabel={`LFO ${lfoSlot}`}
			onclick={() => scalePractice.setAcidBassLfoEnabled(lfoSlot, !lfoPatch.enabled)}
		>
			LFO {lfoPatch.enabled ? 'On' : 'Off'}
		</HardwareButton>
		<div class="lfo-rate-indicator" class:running={lfoPatch.enabled}>
			<span class="lfo-dot" style:animation-duration={`${1 / hz}s`} aria-hidden="true"></span>
			<span class="lfo-hz-readout">
				{hz.toFixed(hz < 10 ? 2 : 1)} Hz
			</span>
		</div>
		{@render pickerField('Destination', LFO_DESTINATIONS, lfoPatch.destination, (id) =>
			scalePractice.setAcidBassLfoDestination(lfoSlot, id as AcidLfoDestination)
		)}
		{@render knobField('Depth', lfoPatch.depth, (v) =>
			scalePractice.setAcidBassLfoDepth(lfoSlot, v)
		)}
	</div>
	<div class="row">
		{@render pickerField('Shape', LFO_SHAPES, lfoPatch.shape, (id) =>
			scalePractice.setAcidBassLfoShape(lfoSlot, id as AcidLfoShape)
		)}
		{@render pickerField('Rate Mode', LFO_RATE_MODES, lfoPatch.rateMode, (id) =>
			scalePractice.setAcidBassLfoRateMode(lfoSlot, id as AcidLfoRateMode)
		)}
		{#if lfoPatch.rateMode === 'free'}
			{@render knobField(
				'Rate',
				lfoPatch.rateHz,
				(v) => scalePractice.setAcidBassLfoRateHz(lfoSlot, v),
				0.05,
				20
			)}
		{:else}
			<label class="field">
				<span class="ff-label field-label">Division</span>
				<select
					aria-label="Division"
					value={lfoPatch.division}
					onchange={(event) =>
						scalePractice.setAcidBassLfoDivision(
							lfoSlot,
							(event.currentTarget as HTMLSelectElement).value as AcidLfoDivision
						)}
				>
					{#each LFO_DIVISIONS as division (division)}
						<option value={division}>{division}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>
	<AcidBassLfoScope shape={lfoPatch.shape} {hz} depth={lfoPatch.depth} enabled={lfoPatch.enabled} />
{/snippet}

{#snippet auxModPanelBody(
	source: 'envelope' | 'accent' | 'random',
	label: string,
	modPatch: AcidAuxModulationPatch
)}
	<div class="row">
		<HardwareButton
			variant="secondary"
			pressed={modPatch.enabled}
			ariaLabel={label}
			onclick={() => scalePractice.setAcidBassModulationEnabled(source, !modPatch.enabled)}
		>
			{label} {modPatch.enabled ? 'On' : 'Off'}
		</HardwareButton>
		{@render pickerField('Destination', MOD_DESTINATIONS, modPatch.destination, (id) =>
			scalePractice.setAcidBassModulationDestination(source, id as AcidModulationDestination)
		)}
		{@render knobField(
			'Depth',
			modPatch.depth,
			(v) => scalePractice.setAcidBassModulationDepth(source, v),
			-100,
			100
		)}
	</div>
{/snippet}

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

<div class="acid-bass-controls">
	<label class="field patch-picker">
		<span class="ff-label field-label">Patch</span>
		<select
			aria-label="Patch"
			onchange={(event) =>
				scalePractice.applyAcidBassFactoryPatch((event.currentTarget as HTMLSelectElement).value)}
		>
			<option value="">Choose a patch…</option>
			{#each FACTORY_PATCHES as preset (preset.id)}
				<option value={preset.id} title={preset.description}>{preset.label}</option>
			{/each}
		</select>
	</label>

	<div class="panel-grid">
		<HardwarePanel title="VCO" tone="carbon">
			<div class="row">
				{@render pickerField('Wave', MAIN_WAVES, patch.oscillator.mainWave, (id) =>
					scalePractice.setAcidBassWave(id as AcidWave)
				)}
			</div>
			<div class="row">
				{@render knobField(
					'Tune',
					patch.oscillator.tune,
					(v) => scalePractice.setAcidBassTune(v),
					-12,
					12
				)}
				{@render knobField(
					'Fine',
					patch.oscillator.fine,
					(v) => scalePractice.setAcidBassFine(v),
					-50,
					50
				)}
				{@render knobField('Main Level', patch.oscillator.mainLevel, (v) =>
					scalePractice.setAcidBassMainLevel(v)
				)}
				{@render knobField(
					'Pulse Width',
					patch.oscillator.pulseWidth,
					(v) => scalePractice.setAcidBassPulseWidth(v),
					5,
					95
				)}
			</div>
		</HardwarePanel>

		<HardwarePanel title="SUB" tone="carbon">
			{#snippet header()}
				<Led state={patch.oscillator.subEnabled ? 'active' : 'off'} />
			{/snippet}
			<div class="row">
				<HardwareButton
					variant="secondary"
					pressed={patch.oscillator.subEnabled}
					ariaLabel="Sub oscillator"
					onclick={() => scalePractice.setAcidBassSubEnabled(!patch.oscillator.subEnabled)}
				>
					Sub {patch.oscillator.subEnabled ? 'On' : 'Off'}
				</HardwareButton>
				{@render pickerField('Octave', SUB_OCTAVES, String(patch.oscillator.subOctave), (id) =>
					scalePractice.setAcidBassSubOctave(Number(id) as AcidSubOctave)
				)}
				{@render pickerField('Wave', SUB_WAVES, patch.oscillator.subWave, (id) =>
					scalePractice.setAcidBassSubWave(id as AcidSubWave)
				)}
			</div>
			<div class="row">
				{@render knobField('Level', patch.oscillator.subLevel, (v) =>
					scalePractice.setAcidBassSubLevel(v)
				)}
			</div>
		</HardwarePanel>

		<HardwarePanel title="OSC 2" tone="carbon">
			{#snippet header()}
				<Led state={patch.oscillator.osc2Enabled ? 'active' : 'off'} />
			{/snippet}
			<div class="row">
				<HardwareButton
					variant="secondary"
					pressed={patch.oscillator.osc2Enabled}
					ariaLabel="Osc 2"
					onclick={() => scalePractice.setAcidBassOsc2Enabled(!patch.oscillator.osc2Enabled)}
				>
					Osc 2 {patch.oscillator.osc2Enabled ? 'On' : 'Off'}
				</HardwareButton>
				{@render pickerField('Wave', MAIN_WAVES, patch.oscillator.osc2Wave, (id) =>
					scalePractice.setAcidBassOsc2Wave(id as AcidWave)
				)}
			</div>
			<div class="row">
				{@render knobField(
					'Tune',
					patch.oscillator.osc2Tune,
					(v) => scalePractice.setAcidBassOsc2Tune(v),
					-12,
					12
				)}
				{@render knobField(
					'Fine',
					patch.oscillator.osc2Fine,
					(v) => scalePractice.setAcidBassOsc2Fine(v),
					-50,
					50
				)}
				{@render knobField('Level', patch.oscillator.osc2Level, (v) =>
					scalePractice.setAcidBassOsc2Level(v)
				)}
				{@render knobField(
					'Pulse Width',
					patch.oscillator.osc2PulseWidth,
					(v) => scalePractice.setAcidBassOsc2PulseWidth(v),
					5,
					95
				)}
			</div>
		</HardwarePanel>

		<HardwarePanel title="VCF" tone="carbon">
			<div class="row">
				{@render pickerField('Model', FILTER_MODELS, patch.filter.model, (id) =>
					scalePractice.setAcidBassFilterModel(id as AcidFilterModel)
				)}
				{@render knobField('Cutoff', patch.filter.cutoff, (v) =>
					scalePractice.setAcidBassCutoff(v)
				)}
				{@render knobField('Resonance', patch.filter.resonance, (v) =>
					scalePractice.setAcidBassResonance(v)
				)}
				{@render knobField(
					'Env Mod',
					patch.filter.envAmount,
					(v) => scalePractice.setAcidBassEnvAmount(v),
					-100,
					100
				)}
			</div>
			<div class="row">
				{@render knobField('Key Tracking', patch.filter.keyTracking, (v) =>
					scalePractice.setAcidBassKeyTracking(v)
				)}
				{@render knobField('Saturation', patch.filter.saturation, (v) =>
					scalePractice.setAcidBassSaturation(v)
				)}
			</div>
		</HardwarePanel>

		<HardwarePanel title="ENV" tone="carbon">
			<div class="row">
				{@render knobField('Decay', patch.envelope.decay, (v) => scalePractice.setAcidBassDecay(v))}
				{@render knobField('Accent', patch.envelope.accentAmount, (v) =>
					scalePractice.setAcidBassAccentAmount(v)
				)}
			</div>
			<div class="row">
				{@render knobField('Attack', patch.envelope.attack, (v) =>
					scalePractice.setAcidBassAttack(v)
				)}
				{@render knobField('Release', patch.envelope.release, (v) =>
					scalePractice.setAcidBassRelease(v)
				)}
				{@render knobField('Glide Time', patch.glide.time, (v) =>
					scalePractice.setAcidBassGlideTime(v)
				)}
				{@render pickerField('Glide Curve', GLIDE_CURVES, patch.glide.curve, (id) =>
					scalePractice.setAcidBassGlideCurve(id as AcidGlideCurve)
				)}
			</div>
		</HardwarePanel>

		<HardwarePanel title="LFO 1" tone="carbon">
			{@render lfoPanelBody(1, patch.lfo1)}
		</HardwarePanel>

		<HardwarePanel title="LFO 2" tone="carbon">
			{@render lfoPanelBody(2, patch.lfo2)}
		</HardwarePanel>

		<HardwarePanel title="ENV MOD" tone="carbon">
			{@render auxModPanelBody('envelope', 'Env Mod', patch.modulation.envelope)}
		</HardwarePanel>

		<HardwarePanel title="ACCENT MOD" tone="carbon">
			{@render auxModPanelBody('accent', 'Accent Mod', patch.modulation.accent)}
		</HardwarePanel>

		<HardwarePanel title="RANDOM MOD" tone="carbon">
			{@render auxModPanelBody('random', 'Random Mod', patch.modulation.random)}
		</HardwarePanel>

		<HardwarePanel title="OUTPUT" tone="carbon">
			<div class="row">
				{@render pickerField(
					'Character',
					DISTORTION_CHARACTERS,
					patch.distortion.character,
					(id) => scalePractice.setAcidBassDistortionCharacter(id as AcidDistortionCharacter)
				)}
			</div>
			<div class="row">
				{@render knobField('Drive', patch.output.drive, (v) => scalePractice.setAcidBassDrive(v))}
				{@render knobField('Volume', patch.output.volume, (v) =>
					scalePractice.setAcidBassVolume(v)
				)}
			</div>
		</HardwarePanel>
	</div>
</div>

<style>
	.acid-bass-controls {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	/* Five panels side by side wherever there's room, wrapping down to fewer
	   columns (never fewer than one) on narrower viewports -- far more
	   compact than the original single stacked column, since most panels
	   only hold a handful of knobs and don't need the full row width.
	   Every HardwarePanel nested inside inherits these tighter spacing
	   tokens via plain CSS custom-property cascade (not global -- scoped to
	   just this grid, the shared HardwarePanel component and its other call
	   sites elsewhere in the app are untouched). */
	.panel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0.5rem;
		align-items: start;
		--ff-panel-gap: 0.6rem;
		--ff-control-gap: 0.5rem;
	}

	/* Grid/flex items default to a content-based min-width, which lets a
	   wide picker (see .picker below) force its ancestors open instead of
	   shrinking to the column's own width -- explicit min-width: 0 at every
	   nested flex/grid level is what actually lets things wrap/shrink to
	   fit instead of visually spilling past the panel's edge. */
	.panel-grid > :global(.hardware-panel) {
		min-width: 0;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.7rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		min-width: 0;
	}

	.field-label {
		color: inherit;
	}

	.lfo-rate-indicator {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding-bottom: 0.35rem;
	}

	.lfo-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: var(--ff-red-dim, #6d2a22);
		flex: 0 0 auto;
		animation: lfo-pulse 1s ease-in-out infinite;
		animation-play-state: paused;
	}

	.lfo-rate-indicator.running .lfo-dot {
		background: var(--ff-red, #e34832);
		animation-play-state: running;
	}

	.lfo-hz-readout {
		font-size: 0.7rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}

	@keyframes lfo-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.7;
		}
		50% {
			transform: scale(1.35);
			opacity: 1;
		}
	}

	/* Same non-motion equivalent every other pulsing indicator in this app
	   gets -- a lit, un-animated dot rather than motion, per AGENTS.md §17. */
	@media (prefers-reduced-motion: reduce) {
		.lfo-dot {
			animation: none;
		}
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

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.5rem;
		background: var(--ff-black, #151411);
		color: var(--ff-ivory, #f1e6c5);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	select:hover {
		border-color: var(--ff-yellow-dark, #c9910d);
	}

	select:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 1px;
	}
</style>
