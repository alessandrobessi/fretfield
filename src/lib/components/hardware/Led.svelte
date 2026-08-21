<script lang="ts">
	interface Props {
		/** `off` = dim/dark, `active` = lit signal red, `current` = lit + a static glow (playhead) plus an optional pulse -- see spec §10/§15. The glow is what makes `current` distinguishable from `active` without motion, so reduced-motion users still get the "this one, right now" cue. */
		state: 'off' | 'active' | 'current';
		/** Purely decorative by default (the calling text/label already carries the meaning) -- pass a label when the LED is the *only* indicator of a state change. */
		label?: string;
	}

	let { state, label }: Props = $props();
</script>

<span
	class="led"
	class:active={state === 'active' || state === 'current'}
	class:current={state === 'current'}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
></span>

<style>
	.led {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: var(--ff-radius-led, 999px);
		background: var(--ff-red-dim, #6d2a22);
		flex: 0 0 auto;
	}

	.led.active {
		background: var(--ff-red, #e34832);
	}

	.led.current {
		box-shadow: 0 0 0.4rem 0.05rem var(--ff-red, #e34832);
		animation: led-pulse 500ms ease-in-out infinite;
	}

	/* Scale/opacity pulse per spec §10 -- reduced-motion users still see a
	   lit, glowing LED (the static cues above), just without the motion. */
	@keyframes led-pulse {
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
