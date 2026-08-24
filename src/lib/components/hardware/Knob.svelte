<script lang="ts">
	interface Props {
		/** Accessible name -- the visible text label (e.g. "TONE") is the caller's own `.ff-label`, rendered alongside this widget, not duplicated here. */
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		/** Mirrors a native `disabled` control: dimmed, inert to pointer/keyboard, removed from tab order. */
		disabled?: boolean;
		/** Passed straight through as the wrapper's `title` -- e.g. explaining *why* a knob is disabled, the same tooltip a disabled `<input>` would carry. */
		title?: string;
		onChange: (value: number) => void;
	}

	let {
		label,
		value,
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		title,
		onChange
	}: Props = $props();

	let knobEl: HTMLDivElement | undefined;
	let dragging = $state(false);

	function clamp(v: number): number {
		return Math.min(max, Math.max(min, v));
	}

	function setValue(next: number): void {
		const clamped = clamp(Math.round(next / step) * step);
		if (clamped !== value) onChange(clamped);
	}

	// Vertical-drag adjustment, the common audio-plugin convention for a
	// software knob: dragging up increases, down decreases. Chosen over
	// tracking the pointer's angle around the knob's center because it's
	// pixel-precise regardless of how far the cursor drifts from the knob
	// during a drag, and still *reads* as "turning a knob" via the rotating
	// indicator alone.
	const DRAG_PIXELS_PER_RANGE = 150;
	let dragStartY = 0;
	let dragStartValue = 0;

	function handlePointerDown(event: PointerEvent): void {
		if (disabled) return;
		dragging = true;
		dragStartY = event.clientY;
		dragStartValue = value;
		knobEl?.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!dragging) return;
		const deltaY = dragStartY - event.clientY;
		const deltaValue = (deltaY / DRAG_PIXELS_PER_RANGE) * (max - min);
		setValue(dragStartValue + deltaValue);
	}

	function handlePointerUp(event: PointerEvent): void {
		dragging = false;
		knobEl?.releasePointerCapture(event.pointerId);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (disabled) return;
		const bigStep = Math.max(step, (max - min) / 10);
		switch (event.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				event.preventDefault();
				setValue(value + step);
				break;
			case 'ArrowDown':
			case 'ArrowLeft':
				event.preventDefault();
				setValue(value - step);
				break;
			case 'PageUp':
				event.preventDefault();
				setValue(value + bigStep);
				break;
			case 'PageDown':
				event.preventDefault();
				setValue(value - bigStep);
				break;
			case 'Home':
				event.preventDefault();
				setValue(min);
				break;
			case 'End':
				event.preventDefault();
				setValue(max);
				break;
		}
	}

	// A standard 270-degree sweep, -135deg (min) to +135deg (max).
	const rotationDeg = $derived(-135 + ((value - min) / (max - min)) * 270);
</script>

<div class="knob-wrap">
	<div
		bind:this={knobEl}
		class="knob"
		class:disabled
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-disabled={disabled}
		aria-orientation="vertical"
		{title}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onkeydown={handleKeydown}
	>
		<div class="indicator" style:transform={`rotate(${rotationDeg}deg)`}></div>
	</div>
</div>

<style>
	.knob-wrap {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.knob {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--ff-black, #151411);
		border: 2px solid var(--surface-border, #3a382f);
		position: relative;
		cursor: ns-resize;
		touch-action: none;
	}

	.knob:focus-visible {
		outline: 3px solid var(--focus-ring, #e3ac18);
		outline-offset: 2px;
	}

	.knob.disabled {
		cursor: default;
		opacity: 0.4;
	}

	.knob::before {
		content: '';
		position: absolute;
		inset: 0.45rem;
		border-radius: 50%;
		background: var(--ff-carbon, #262521);
	}

	.indicator {
		position: absolute;
		top: 0.3rem;
		left: calc(50% - 1px);
		width: 2px;
		height: 40%;
		background: var(--ff-yellow, #e3ac18);
		transform-origin: bottom center;
		border-radius: 1px;
	}
</style>
