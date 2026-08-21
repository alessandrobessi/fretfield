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
			aria-label={`${liveInput.enabled ? 'Disconnect' : 'Connect'} Bass`}
			onclick={toggle}
		>
			<span class="dot" aria-hidden="true">{liveInput.enabled ? '●' : '○'}</span>
			<span class="label">{liveInput.enabled ? 'Disconnect' : 'Connect'} Bass</span>
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
	.bass-toggle {
		font: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.4rem 0.75rem;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--live-accent, #e34832);
		background: transparent;
		color: var(--live-accent, #e34832);
		cursor: pointer;
	}

	.bass-toggle.enabled {
		background: var(--live-accent, #e34832);
		color: var(--ff-black, #151411);
	}

	.bass-toggle:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.bass-toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.dot {
		margin-right: 0.2rem;
	}

	/* Icon-only on narrow screens -- the button's aria-label carries the same
	   text, so this is a visual-only change, not an accessibility regression. */
	@media (max-width: 640px) {
		.label {
			display: none;
		}

		.dot {
			margin-right: 0;
		}
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
		background: var(--surface, #262521);
		border: 1px solid var(--surface-border, #3a382f);
		border-radius: var(--ff-radius-panel, 8px);
		padding: 0.85rem 1.1rem;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
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
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--surface-border, #3a382f);
		background: var(--ff-black, #151411);
		color: var(--fg, #f1e6c5);
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
		color: var(--live-accent, #e34832);
	}

	.status-line [data-status='error'] {
		color: var(--ff-red, #e34832);
	}

	.level {
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		border-radius: var(--ff-radius-control, 4px);
		background: color-mix(in srgb, var(--fret-fg, #f1e6c5) 8%, transparent);
	}

	.level[data-level='healthy'] {
		background: color-mix(in srgb, var(--role-stable, #4fd1a5) 16%, transparent);
		color: var(--role-stable, #4fd1a5);
	}

	.level[data-level='too-low'],
	.level[data-level='clipping'] {
		background: color-mix(in srgb, var(--role-tension, #fb923c) 16%, transparent);
		color: var(--role-tension, #fb923c);
	}

	.detected {
		margin: 0;
	}

	.interpretation {
		margin: 0;
		padding-top: 0.35rem;
		border-top: 1px solid var(--fret-border, #3a382f);
	}

	.waiting {
		margin: 0;
		opacity: 0.6;
	}

	.error {
		margin: 0;
		color: var(--ff-red, #e34832);
		font-size: 0.8rem;
	}

	.privacy {
		margin: 0;
		font-size: 0.7rem;
		opacity: 0.55;
	}
</style>
