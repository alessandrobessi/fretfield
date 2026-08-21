<script lang="ts">
	import { listAcidBassFactoryPatches } from '$lib/acid-bass/factory-patches';
	import type {
		AcidFilterModel,
		AcidGlideCurve,
		AcidLfoDestination,
		AcidLfoDivision,
		AcidLfoRateMode,
		AcidLfoShape,
		AcidSubOctave,
		AcidSubWave,
		AcidWave
	} from '$lib/acid-bass/types';
	import HardwareButton from '$lib/components/hardware/HardwareButton.svelte';
	import HardwarePanel from '$lib/components/hardware/HardwarePanel.svelte';
	import Knob from '$lib/components/hardware/Knob.svelte';
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
		{ id: 'subLevel', label: 'Sub Level' }
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

	let showAdvanced = $state(false);

	const patch = $derived(scalePractice.groove.acidBass.patch);
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

	<HardwarePanel title="VCO" tone="carbon">
		<div class="row">
			{@render pickerField('Wave', MAIN_WAVES, patch.oscillator.mainWave, (id) =>
				scalePractice.setAcidBassWave(id as AcidWave)
			)}
			<HardwareButton
				variant="secondary"
				pressed={patch.oscillator.subEnabled}
				ariaLabel="Sub oscillator"
				onclick={() => scalePractice.setAcidBassSubEnabled(!patch.oscillator.subEnabled)}
			>
				Sub {patch.oscillator.subEnabled ? 'On' : 'Off'}
			</HardwareButton>
		</div>
		{#if showAdvanced}
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
			<div class="row">
				{@render pickerField('Sub Octave', SUB_OCTAVES, String(patch.oscillator.subOctave), (id) =>
					scalePractice.setAcidBassSubOctave(Number(id) as AcidSubOctave)
				)}
				{@render pickerField('Sub Wave', SUB_WAVES, patch.oscillator.subWave, (id) =>
					scalePractice.setAcidBassSubWave(id as AcidSubWave)
				)}
				{@render knobField('Sub Level', patch.oscillator.subLevel, (v) =>
					scalePractice.setAcidBassSubLevel(v)
				)}
			</div>
		{/if}
	</HardwarePanel>

	<HardwarePanel title="VCF" tone="carbon">
		<div class="row">
			{@render pickerField('Model', FILTER_MODELS, patch.filter.model, (id) =>
				scalePractice.setAcidBassFilterModel(id as AcidFilterModel)
			)}
			{@render knobField('Cutoff', patch.filter.cutoff, (v) => scalePractice.setAcidBassCutoff(v))}
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
		{#if showAdvanced}
			<div class="row">
				{@render knobField('Key Tracking', patch.filter.keyTracking, (v) =>
					scalePractice.setAcidBassKeyTracking(v)
				)}
				{@render knobField('Saturation', patch.filter.saturation, (v) =>
					scalePractice.setAcidBassSaturation(v)
				)}
			</div>
		{/if}
	</HardwarePanel>

	<HardwarePanel title="ENV" tone="carbon">
		<div class="row">
			{@render knobField('Decay', patch.envelope.decay, (v) => scalePractice.setAcidBassDecay(v))}
			{@render knobField('Accent', patch.envelope.accentAmount, (v) =>
				scalePractice.setAcidBassAccentAmount(v)
			)}
		</div>
		{#if showAdvanced}
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
		{/if}
	</HardwarePanel>

	<HardwarePanel title="MOD" tone="carbon">
		<div class="row">
			<HardwareButton
				variant="secondary"
				pressed={patch.lfo.enabled}
				ariaLabel="LFO"
				onclick={() => scalePractice.setAcidBassLfoEnabled(!patch.lfo.enabled)}
			>
				LFO {patch.lfo.enabled ? 'On' : 'Off'}
			</HardwareButton>
			{@render pickerField('Destination', LFO_DESTINATIONS, patch.lfo.destination, (id) =>
				scalePractice.setAcidBassLfoDestination(id as AcidLfoDestination)
			)}
			{@render knobField('Depth', patch.lfo.depth, (v) => scalePractice.setAcidBassLfoDepth(v))}
		</div>
		{#if showAdvanced}
			<div class="row">
				{@render pickerField('Shape', LFO_SHAPES, patch.lfo.shape, (id) =>
					scalePractice.setAcidBassLfoShape(id as AcidLfoShape)
				)}
				{@render pickerField('Rate Mode', LFO_RATE_MODES, patch.lfo.rateMode, (id) =>
					scalePractice.setAcidBassLfoRateMode(id as AcidLfoRateMode)
				)}
				{#if patch.lfo.rateMode === 'free'}
					{@render knobField(
						'Rate',
						patch.lfo.rateHz,
						(v) => scalePractice.setAcidBassLfoRateHz(v),
						0.05,
						20
					)}
				{:else}
					<label class="field">
						<span class="ff-label field-label">Division</span>
						<select
							aria-label="Division"
							value={patch.lfo.division}
							onchange={(event) =>
								scalePractice.setAcidBassLfoDivision(
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
		{/if}
	</HardwarePanel>

	<HardwarePanel title="OUTPUT" tone="carbon">
		<div class="row">
			{@render knobField('Drive', patch.output.drive, (v) => scalePractice.setAcidBassDrive(v))}
			{@render knobField('Volume', patch.output.volume, (v) => scalePractice.setAcidBassVolume(v))}
		</div>
	</HardwarePanel>

	<HardwareButton
		variant="secondary"
		ariaExpanded={showAdvanced}
		onclick={() => (showAdvanced = !showAdvanced)}
	>
		{showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
	</HardwareButton>
</div>

<style>
	.acid-bass-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 1.1rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
	}

	.field-label {
		color: inherit;
	}

	.picker {
		display: flex;
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
