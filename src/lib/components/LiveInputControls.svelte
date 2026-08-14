<script lang="ts">
	import { MicrophoneAudioSource } from '$lib/audio/audio-input';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { liveInput } from '$lib/stores/live-input.svelte';

	// A static capability check purely for UI convenience — enable() would
	// already fail gracefully (liveInput.error) without this, but checking up
	// front avoids showing a broken "Enable" button that always errors.
	const supported = MicrophoneAudioSource.isSupported();

	let pending = $state(false);

	const statusLabel = $derived.by(() => {
		switch (liveInput.status) {
			case 'idle':
				return 'Off';
			case 'listening':
				return 'Listening…';
			case 'tracking':
				return 'Tracking';
			case 'silence':
				return 'Silence';
			case 'error':
				return 'Error';
		}
	});

	const inputLevelLabel = $derived.by(() => {
		switch (liveInput.inputLevel) {
			case 'no-signal':
				return 'No signal';
			case 'too-low':
				return 'Too low';
			case 'healthy':
				return 'Healthy';
			case 'clipping':
				return 'Clipping — turn it down';
		}
	});

	const liveNote = $derived(fretfield.liveNote);
	const chordInterpretation = $derived(fretfield.liveChordInterpretation);
	const progressionInterpretation = $derived(fretfield.liveProgressionInterpretation);
	const pathMatch = $derived(fretfield.livePathMatch);

	async function toggle(): Promise<void> {
		pending = true;
		try {
			if (liveInput.enabled) {
				liveInput.disable();
			} else {
				await liveInput.enable();
			}
		} finally {
			pending = false;
		}
	}

	async function handleDeviceChange(event: Event): Promise<void> {
		const deviceId = (event.currentTarget as HTMLSelectElement).value;
		pending = true;
		try {
			await liveInput.selectDevice(deviceId);
		} finally {
			pending = false;
		}
	}
</script>

<div class="live-input" class:enabled={liveInput.enabled}>
	<div class="top-row">
		<span class="title">Live Input</span>
		{#if supported}
			<button type="button" class="toggle" disabled={pending} onclick={toggle}>
				{liveInput.enabled ? 'Disable' : 'Enable'} Live Input
			</button>
		{:else}
			<span class="unsupported">Not supported in this browser</span>
		{/if}
	</div>

	{#if liveInput.enabled || liveInput.error}
		<div class="details">
			{#if liveInput.devices.length > 0}
				<label class="device-picker">
					Input:
					<select
						value={liveInput.selectedDeviceId ?? ''}
						disabled={pending}
						onchange={handleDeviceChange}
					>
						{#each liveInput.devices as device (device.deviceId)}
							<option value={device.deviceId}>{device.label}</option>
						{/each}
					</select>
				</label>
			{/if}

			<p class="status-line">
				Status: <span data-status={liveInput.status}>{statusLabel}</span>
				<span class="level" data-level={liveInput.inputLevel}>{inputLevelLabel}</span>
			</p>

			{#if liveNote}
				<p class="detected">
					Detected: <strong>{liveNote.noteName}{liveNote.octave}</strong>
					/ {liveNote.frequencyHz.toFixed(1)} Hz / {liveNote.cents > 0
						? '+'
						: ''}{liveNote.cents.toFixed(0)} cents
				</p>

				{#if fretfield.mode === 'chord' && chordInterpretation}
					<p class="interpretation">
						{chordInterpretation.noteName} — {chordInterpretation.intervalLabel}, {chordInterpretation.roleLabel}
					</p>
				{:else if fretfield.mode === 'progression' && progressionInterpretation}
					<p class="interpretation">
						{progressionInterpretation.noteName} — {progressionInterpretation.intervalLabel} of current
						chord, {progressionInterpretation.roleLabel}
						{#if progressionInterpretation.bestTargetNoteName !== null}
							<br />Best resolution: {progressionInterpretation.bestTargetNoteName} ({progressionInterpretation.semitoneMovement !==
							null
								? `${progressionInterpretation.semitoneMovement > 0 ? '+' : ''}${progressionInterpretation.semitoneMovement} semitone${Math.abs(progressionInterpretation.semitoneMovement) === 1 ? '' : 's'}`
								: ''}) into {progressionInterpretation.nextChordSymbol}
						{/if}
					</p>
				{:else if fretfield.mode === 'paths' && pathMatch}
					<p class="interpretation" data-matched={pathMatch.matched}>
						Expected {pathMatch.expectedNoteName} — played {pathMatch.detectedNoteName} ({pathMatch.matched
							? 'matched'
							: 'not yet'})
					</p>
				{/if}
			{:else if liveInput.status === 'listening' || liveInput.status === 'silence'}
				<p class="waiting">Play a note…</p>
			{/if}

			{#if liveInput.error}
				<p class="error" role="alert">{liveInput.error}</p>
			{/if}
		</div>
	{/if}

	<p class="privacy">Audio is analyzed locally in your browser and is not recorded or uploaded.</p>
</div>

<style>
	.live-input {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 0.85rem 1.1rem;
		font-size: 0.85rem;
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.title {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.toggle {
		font: inherit;
		font-weight: 700;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--live-accent, #06b6d4);
		background: transparent;
		color: var(--live-accent, #06b6d4);
		cursor: pointer;
	}

	.live-input.enabled .toggle {
		background: var(--live-accent, #06b6d4);
		color: #fff;
	}

	.toggle:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.unsupported {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.device-picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.device-picker select {
		font: inherit;
		padding: 0.2rem 0.4rem;
		border-radius: 8px;
		border: 1px solid var(--fret-border, #ddd3f7);
	}

	.status-line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.status-line [data-status] {
		font-weight: 700;
	}

	.status-line [data-status='tracking'] {
		color: var(--live-accent, #06b6d4);
	}

	.status-line [data-status='error'] {
		color: var(--role-alteration, #ef4444);
	}

	.level {
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--fret-fg, #241a3d) 8%, transparent);
	}

	.level[data-level='healthy'] {
		background: color-mix(in srgb, var(--role-stable, #10b981) 16%, transparent);
		color: var(--role-stable, #059669);
	}

	.level[data-level='too-low'],
	.level[data-level='clipping'] {
		background: color-mix(in srgb, var(--role-tension, #f97316) 16%, transparent);
		color: var(--role-tension, #f97316);
	}

	.detected {
		margin: 0;
		font-size: 0.85rem;
	}

	.interpretation {
		margin: 0;
		padding-top: 0.35rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
		font-size: 0.85rem;
	}

	.interpretation[data-matched='true'] {
		color: var(--role-stable, #059669);
		font-weight: 600;
	}

	.waiting {
		margin: 0;
		opacity: 0.6;
	}

	.error {
		margin: 0;
		color: var(--role-alteration, #ef4444);
		font-size: 0.8rem;
	}

	.privacy {
		margin: 0;
		font-size: 0.7rem;
		opacity: 0.55;
	}
</style>
