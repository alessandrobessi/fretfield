<script lang="ts">
	import type { AcidBassStep, AcidOctaveOffset, AcidStepLocks } from '$lib/acid-bass/types';
	import { ALL_INTERVALS, intervalLabel, type IntervalId } from '$lib/music/intervals';

	interface Props {
		step: AcidBassStep | null;
		stepIndex: number | null;
		onSetActive: (active: boolean) => void;
		onSetInterval: (interval: IntervalId) => void;
		onSetOctave: (octave: AcidOctaveOffset) => void;
		onToggleAccent: () => void;
		onToggleSlide: () => void;
		onSetProbability: (probability: number) => void;
		onSetRatchet: (ratchet: AcidBassStep['ratchet']) => void;
		onSetGate: (gate: number) => void;
		onSetLock: (target: keyof AcidStepLocks, value: number | undefined) => void;
		onClearLocks: () => void;
	}

	const {
		step,
		stepIndex,
		onSetActive,
		onSetInterval,
		onSetOctave,
		onToggleAccent,
		onToggleSlide,
		onSetProbability,
		onSetRatchet,
		onSetGate,
		onSetLock,
		onClearLocks
	}: Props = $props();

	const OCTAVES: AcidOctaveOffset[] = [-1, 0, 1];
	const RATCHETS: AcidBassStep['ratchet'][] = [1, 2, 3, 4];

	const LOCK_TARGETS: { id: keyof AcidStepLocks; label: string; min: number; max: number }[] = [
		{ id: 'cutoff', label: 'Cutoff', min: 0, max: 100 },
		{ id: 'resonance', label: 'Resonance', min: 0, max: 100 },
		{ id: 'envAmount', label: 'Env Mod', min: -100, max: 100 },
		{ id: 'drive', label: 'Drive', min: 0, max: 100 },
		{ id: 'lfoDepth', label: 'LFO Depth', min: 0, max: 100 }
	];

	let locksExpanded = $state(false);

	function octaveButtonLabel(octave: AcidOctaveOffset): string {
		if (octave === 1) return '+1';
		if (octave === -1) return '−1';
		return '0';
	}

	function handleIntervalChange(event: Event): void {
		onSetInterval((event.currentTarget as HTMLSelectElement).value as IntervalId);
	}

	function lockCount(locks: AcidStepLocks | undefined): number {
		if (!locks) return 0;
		return Object.keys(locks).length;
	}
</script>

<div class="acid-bass-step-editor">
	{#if step === null || stepIndex === null}
		<p class="hint">Click a Bass step above to edit it.</p>
	{:else}
		<span class="field-label">Bass step {stepIndex + 1}</span>
		<label class="toggle-field">
			<input
				type="checkbox"
				aria-label="Active"
				checked={step.active}
				onchange={(event) => onSetActive((event.currentTarget as HTMLInputElement).checked)}
			/>
			Active
		</label>

		{#if step.active}
			<label class="field">
				<span class="field-label">Interval</span>
				<select aria-label="Interval" value={step.interval} onchange={handleIntervalChange}>
					{#each ALL_INTERVALS as interval (interval)}
						<option value={interval}>{intervalLabel(interval)}</option>
					{/each}
				</select>
			</label>

			<div class="octave-picker" role="group" aria-label="Octave">
				{#each OCTAVES as octave (octave)}
					<button
						type="button"
						class="octave-button"
						class:active={step.octave === octave}
						aria-pressed={step.octave === octave}
						onclick={() => onSetOctave(octave)}
					>
						{octaveButtonLabel(octave)}
					</button>
				{/each}
			</div>

			<label class="toggle-field">
				<input
					type="checkbox"
					aria-label="Accent"
					checked={step.accent}
					onchange={onToggleAccent}
				/>
				Accent
			</label>

			<label class="toggle-field" class:disabled={step.ratchet > 1}>
				<input
					type="checkbox"
					aria-label="Slide"
					checked={step.slide}
					disabled={step.ratchet > 1}
					onchange={onToggleSlide}
				/>
				Slide{#if step.ratchet > 1}<span class="hint-inline"> (off while ratcheted)</span>{/if}
			</label>

			<label class="field slider-field">
				<span class="field-label">Probability</span>
				<span class="slider-row">
					<input
						type="range"
						aria-label="Probability"
						min="0"
						max="100"
						value={step.probability}
						oninput={(event) =>
							onSetProbability(Number((event.currentTarget as HTMLInputElement).value))}
					/>
					<span class="readout">{step.probability}%</span>
				</span>
			</label>

			<div class="octave-picker" role="group" aria-label="Ratchet">
				{#each RATCHETS as ratchet (ratchet)}
					<button
						type="button"
						class="octave-button"
						class:active={step.ratchet === ratchet}
						aria-pressed={step.ratchet === ratchet}
						onclick={() => onSetRatchet(ratchet)}
					>
						x{ratchet}
					</button>
				{/each}
			</div>

			<label class="field slider-field">
				<span class="field-label">Gate</span>
				<span class="slider-row">
					<input
						type="range"
						aria-label="Gate"
						min="10"
						max="100"
						value={step.gate}
						oninput={(event) => onSetGate(Number((event.currentTarget as HTMLInputElement).value))}
					/>
					<span class="readout">{step.gate}%</span>
				</span>
			</label>

			<div class="locks-disclosure">
				<button
					type="button"
					class="locks-toggle"
					aria-expanded={locksExpanded}
					onclick={() => (locksExpanded = !locksExpanded)}
				>
					{locksExpanded ? '− Locks' : '+ Add Lock'}{#if lockCount(step.locks) > 0}
						<span class="lock-count">({lockCount(step.locks)})</span>
					{/if}
				</button>
				{#if locksExpanded}
					<div class="locks-panel">
						{#each LOCK_TARGETS as target (target.id)}
							{@const locked = step.locks?.[target.id] !== undefined}
							<label class="lock-row">
								<input
									type="checkbox"
									aria-label={`Lock ${target.label}`}
									checked={locked}
									onchange={(event) => {
										const checked = (event.currentTarget as HTMLInputElement).checked;
										onSetLock(
											target.id,
											checked ? Math.round((target.min + target.max) / 2) : undefined
										);
									}}
								/>
								<span class="lock-label">{target.label}</span>
								{#if locked}
									<input
										type="range"
										aria-label={`${target.label} lock value`}
										min={target.min}
										max={target.max}
										value={step.locks?.[target.id]}
										oninput={(event) =>
											onSetLock(target.id, Number((event.currentTarget as HTMLInputElement).value))}
									/>
									<span class="readout">{step.locks?.[target.id]}</span>
								{/if}
							</label>
						{/each}
						{#if lockCount(step.locks) > 0}
							<button type="button" class="clear-locks" onclick={onClearLocks}>Clear locks</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.acid-bass-step-editor {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
		min-height: 2.5rem;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.65;
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
		color: inherit;
	}

	select {
		font: inherit;
		font-weight: 600;
		padding: 0.35rem 0.5rem;
		background: var(--ff-black, #151411);
		color: var(--fg, #f1e6c5);
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

	.toggle-field {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.toggle-field.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hint-inline {
		font-weight: 400;
		font-size: 0.7rem;
		opacity: 0.75;
	}

	.octave-picker {
		display: flex;
		gap: 0.3rem;
	}

	.octave-button {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
		width: 2.2rem;
		padding: 0.3rem 0;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
		cursor: pointer;
	}

	.octave-button:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.octave-button.active {
		border-color: var(--ff-black, #151411);
		background: var(--ff-yellow-dark, #c9910d);
		color: var(--ff-black, #151411);
	}

	.octave-button:focus-visible,
	input[type='checkbox']:focus-visible,
	input[type='range']:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.slider-field {
		min-width: 8rem;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.readout {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		font-size: 0.75rem;
		min-width: 2.5em;
	}

	.locks-disclosure {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.locks-toggle {
		font: inherit;
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.35rem 0.6rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
		cursor: pointer;
	}

	.locks-toggle:hover {
		border-color: var(--ff-yellow, #e3ac18);
	}

	.locks-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.lock-count {
		opacity: 0.75;
	}

	.locks-panel {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-control, 4px);
		background: color-mix(in srgb, var(--ff-black, #151411) 40%, transparent);
	}

	.lock-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.lock-label {
		min-width: 5.5rem;
	}

	.clear-locks {
		align-self: flex-start;
		font: inherit;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.3rem 0.6rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-yellow, #e3ac18);
		background: transparent;
		color: var(--ff-yellow, #e3ac18);
		cursor: pointer;
	}

	.clear-locks:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}
</style>
