<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `primary` = yellow face / black text / black border (spec §15's "primary musical action"). `secondary` = black face / yellow text, for a lower-emphasis action beside a primary one. */
		variant?: 'primary' | 'secondary';
		/** For a toggle-style button (Bass On/Off, Wave Saw/Square) -- drives both `aria-pressed` and the pressed-state (deep yellow) visual treatment. Omit for a plain momentary action button (Save, Delete). */
		pressed?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit';
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		pressed,
		disabled = false,
		type = 'button',
		ariaLabel,
		onclick,
		children
	}: Props = $props();
</script>

<button
	{type}
	class="hardware-button"
	class:secondary={variant === 'secondary'}
	class:pressed
	aria-pressed={pressed}
	aria-label={ariaLabel}
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style>
	.hardware-button {
		font: inherit;
		font-weight: 700;
		font-size: 0.85rem;
		padding: 0.5rem 1rem;
		background: var(--ff-yellow, #e3ac18);
		color: var(--ff-black, #151411);
		border: var(--ff-border-strong, 2px solid #151411);
		border-radius: var(--ff-radius-control, 4px);
		cursor: pointer;
	}

	.hardware-button.secondary {
		background: var(--ff-black, #151411);
		color: var(--ff-yellow, #e3ac18);
		border-color: var(--ff-yellow, #e3ac18);
	}

	/* Pressed/active surface -- deep yellow, per spec §15. Applies to both
	   variants: a pressed secondary button still reads as "on" via the same
	   deep-yellow fill, just with its own border color kept. */
	.hardware-button.pressed {
		background: var(--ff-yellow-dark, #c9910d);
	}

	.hardware-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.hardware-button:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}
</style>
