<script lang="ts">
	/**
	 * A small looping illustration of what one aux modulation source
	 * (Envelope/Accent/Random, M15) actually does -- deliberately NOT a
	 * continuous oscillating trace like `AcidBassLfoScope`, because these
	 * three sources are fundamentally not LFOs: each only ever produces one
	 * shaped contribution per note trigger, never a free-running wave. Drawing
	 * a fake continuous wave here would reinforce exactly the wrong mental
	 * model (a real user question this was built to answer: "do they work
	 * like the LFOs?" -- no). Each loop of the animation stands in for one
	 * note being triggered:
	 *
	 * - Envelope: a rise-then-decay pulse every trigger, mirroring the
	 *   filter envelope's own timing (spec §30.2's "uses the existing
	 *   note-envelope timing as the modulation contour").
	 * - Accent: mostly flat -- a pulse appears only on roughly every third
	 *   trigger, standing in for "only accented notes get anything" (§30.3).
	 * - Random: a new, differently-sized held bar every trigger, standing in
	 *   for "one deterministic held bipolar value per trigger, never audio-
	 *   rate noise" (§30.4) -- the actual heights shown are illustrative, not
	 *   the real deterministic sequence (that depends on step/bar/seed data
	 *   this component doesn't have).
	 *
	 * Purely decorative (`aria-hidden`) -- On/Off, Destination, and Depth are
	 * already separately exposed as their own accessible controls in the same
	 * panel.
	 */
	interface Props {
		kind: 'envelope' | 'accent' | 'random';
		/** -100..100, bipolar -- a negative depth flips the trace below the centerline instead of above it. */
		depth: number;
		enabled: boolean;
	}

	let { kind, depth, enabled }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	const BG_COLOR = '#151411';
	const GRID_COLOR = 'rgba(241, 230, 197, 0.15)';
	const TRACE_COLOR = '#e34832';
	const TRACE_WIDTH = 2;
	const VERTICAL_PADDING = 4;
	// One full loop stands in for a handful of note triggers -- slow enough
	// to read as "this happens per note," not a smear.
	const CYCLE_SECONDS = 1.4;
	const TRIGGERS_PER_CYCLE = 4;

	/** Same deterministic pseudo-random stand-in `AcidBassLfoScope`'s own sample-and-hold uses -- illustrative only, not the real per-step/bar/seed sequence. */
	function pseudoRandom(index: number): number {
		const x = Math.sin(index * 12.9898) * 43758.5453;
		return (x - Math.floor(x)) * 2 - 1;
	}

	/** Envelope contour: quick rise, slower decay, back to 0 well before the next trigger -- same rise/decay shape `retriggerFilterEnvelope` gives the filter itself. */
	function envelopeValue(triggerPhase: number): number {
		const rise = 0.12;
		const decay = 0.55;
		if (triggerPhase < rise) return triggerPhase / rise;
		if (triggerPhase < decay) {
			return 1 - (triggerPhase - rise) / (decay - rise);
		}
		return 0;
	}

	/** Accent contour: silent unless this trigger is the "accented" one (every third), then the same rise/decay shape held through a wider gate. */
	function accentValue(triggerIndex: number, triggerPhase: number): number {
		if (triggerIndex % 3 !== 0) return 0;
		const rise = 0.1;
		const hold = 0.5;
		if (triggerPhase < rise) return triggerPhase / rise;
		if (triggerPhase < hold) return 1;
		if (triggerPhase < hold + 0.2) return 1 - (triggerPhase - hold) / 0.2;
		return 0;
	}

	/** Random contour: a flat held value for the whole trigger, a new (illustrative) value each time -- never a continuously varying signal. */
	function randomValue(triggerIndex: number, triggerPhase: number): number {
		const rise = 0.08;
		const held = pseudoRandom(triggerIndex);
		if (triggerPhase < rise) return held * (triggerPhase / rise);
		if (triggerPhase > 0.85) return held * (1 - (triggerPhase - 0.85) / 0.15);
		return held;
	}

	function valueAt(currentKind: Props['kind'], elapsedSeconds: number): number {
		const cyclePhase = ((elapsedSeconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
		const triggerSeconds = CYCLE_SECONDS / TRIGGERS_PER_CYCLE;
		const triggerIndex = Math.floor(elapsedSeconds / triggerSeconds);
		const triggerPhase = (cyclePhase % triggerSeconds) / triggerSeconds;
		switch (currentKind) {
			case 'envelope':
				return envelopeValue(triggerPhase);
			case 'accent':
				return accentValue(triggerIndex, triggerPhase);
			case 'random':
				return randomValue(triggerIndex, triggerPhase);
		}
	}

	$effect(() => {
		if (!canvasEl) return;
		const context = canvasEl.getContext('2d');
		if (!context) return;
		const ctx: CanvasRenderingContext2D = context;
		const canvas = canvasEl;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		function resize(): void {
			const rect = canvas.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.max(1, Math.round(rect.width * dpr));
			canvas.height = Math.max(1, Math.round(rect.height * dpr));
		}

		function draw(elapsedSeconds: number): void {
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = BG_COLOR;
			ctx.fillRect(0, 0, width, height);
			ctx.strokeStyle = GRID_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, height / 2);
			ctx.lineTo(width, height / 2);
			ctx.stroke();

			if (!enabled) return;

			const sign = depth < 0 ? -1 : 1;
			const amplitude = (Math.min(100, Math.abs(depth)) / 100) * (height / 2 - VERTICAL_PADDING);

			ctx.strokeStyle = TRACE_COLOR;
			ctx.lineWidth = TRACE_WIDTH;
			ctx.beginPath();
			for (let x = 0; x < width; x++) {
				const t = elapsedSeconds - CYCLE_SECONDS * (1 - x / width);
				const v = valueAt(kind, Math.max(0, t)) * sign;
				const y = height / 2 - v * amplitude;
				if (x === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}

		resize();
		draw(0);

		const resizeObserver = new ResizeObserver(() => {
			resize();
			if (reduceMotion) draw(0);
		});
		resizeObserver.observe(canvas);

		let raf: number | null = null;
		if (!reduceMotion) {
			const start = performance.now();
			const loop = (now: number) => {
				draw((now - start) / 1000);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		}

		return () => {
			if (raf !== null) cancelAnimationFrame(raf);
			resizeObserver.disconnect();
		};
	});
</script>

<canvas bind:this={canvasEl} class="aux-mod-scope" aria-hidden="true"></canvas>

<style>
	.aux-mod-scope {
		display: block;
		width: 100%;
		height: 40px;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
	}
</style>
