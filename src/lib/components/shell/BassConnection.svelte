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

	// Same auto-reveal LiveInputControls always had: the detail dropdown
	// shows itself whenever there's something to show (connected or errored),
	// with no separate manual open/close state to keep in sync.
	const showDetails = $derived(liveInput.enabled || liveInput.error !== null);

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

<div class="bass-connection">
	{#if supported}
		<button
			type="button"
			class="bass-toggle"
			class:enabled={liveInput.enabled}
			disabled={pending}
			onclick={toggle}
		>
			<span class="dot" aria-hidden="true">{liveInput.enabled ? '●' : '○'}</span>
			{liveInput.enabled ? 'Disconnect' : 'Connect'} Bass
		</button>
	{:else}
		<span class="unsupported">Bass not supported in this browser</span>
	{/if}

	{#if showDetails}
		<div class="live-input">
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

			<p class="status-line" aria-live="polite">
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
				{/if}
			{:else if liveInput.status === 'listening' || liveInput.status === 'silence'}
				<p class="waiting">Play a note…</p>
			{/if}

			{#if liveInput.error}
				<p class="error" role="alert">{liveInput.error}</p>
			{/if}

			<p class="privacy">
				Audio is analyzed locally in your browser and is not recorded or uploaded.
			</p>
		</div>
	{/if}
</div>

<style>
	.bass-connection {
		position: relative;
	}

	.bass-toggle {
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		border: 2px solid var(--live-accent, #06b6d4);
		background: var(--fret-bg, #fff);
		color: var(--live-accent, #06b6d4);
		cursor: pointer;
	}

	.bass-toggle.enabled {
		background: var(--live-accent, #06b6d4);
		color: #fff;
	}

	.bass-toggle:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.bass-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.dot {
		margin-right: 0.2rem;
	}

	.unsupported {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.live-input {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		z-index: 10;
		width: min(20rem, calc(100vw - 3rem));
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 12px;
		padding: 0.85rem 1.1rem;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
		font-size: 0.85rem;
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
	}

	.interpretation {
		margin: 0;
		padding-top: 0.35rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
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
