<script lang="ts">
	import type { AcidLfoShape } from '$lib/acid-bass/types';

	/**
	 * A small live preview of one LFO's own modulation waveform -- not a
	 * literal scope tap on the real AudioParam (that would need an
	 * AnalyserNode threaded all the way from AcidBassVoice up through the
	 * store), but a client-rendered re-creation from the same shape/rate/depth
	 * already known here, close enough to answer "what is this LFO actually
	 * doing to its destination" at a glance. Purely decorative (`aria-hidden`)
	 * -- Depth/Destination/Shape/Rate are already separately exposed as their
	 * own accessible controls elsewhere in the same panel, so this doesn't
	 * need its own textual equivalent, only the reduced-motion one below.
	 */
	interface Props {
		shape: AcidLfoShape;
		/** The LFO's actual current rate in Hz (already resolved for Free vs Sync mode by the caller). */
		hz: number;
		/** 0-100. */
		depth: number;
		enabled: boolean;
	}

	let { shape, hz, depth, enabled }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	const BG_COLOR = '#151411';
	const GRID_COLOR = 'rgba(241, 230, 197, 0.15)';
	const TRACE_COLOR = '#e34832';
	const TRACE_WIDTH = 2;
	const VERTICAL_PADDING = 4;
	// Keeps the shape legible across the whole 0.05-20Hz range -- a slow LFO
	// still shows motion within a capped window, a fast one shows several
	// cycles rather than one solid smear.
	const MIN_WINDOW_SECONDS = 0.25;
	const MAX_WINDOW_SECONDS = 4;

	/** Deterministic per-cycle pseudo-random value in -1..1 -- not the real audio S&H voltage (that's genuine `Math.random()`, not reproducible from pure params), just a visually-representative stand-in that holds for one LFO cycle and jumps at the next, the same character as the real thing. */
	function sampleHoldValue(stepIndex: number): number {
		const x = Math.sin(stepIndex * 12.9898) * 43758.5453;
		return (x - Math.floor(x)) * 2 - 1;
	}

	function shapeValue(
		currentShape: AcidLfoShape,
		phase: number,
		t: number,
		rateHz: number
	): number {
		switch (currentShape) {
			case 'sine':
				return Math.sin(phase * 2 * Math.PI);
			case 'triangle':
				return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
			case 'square':
				return phase < 0.5 ? 1 : -1;
			case 'sampleHold':
				return sampleHoldValue(Math.floor(t * rateHz));
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

			const rateHz = Math.max(hz, 0.01);
			const windowSeconds = Math.min(MAX_WINDOW_SECONDS, Math.max(MIN_WINDOW_SECONDS, 4 / rateHz));
			const amplitude = (Math.max(0, Math.min(100, depth)) / 100) * (height / 2 - VERTICAL_PADDING);

			ctx.strokeStyle = TRACE_COLOR;
			ctx.lineWidth = TRACE_WIDTH;
			ctx.beginPath();
			for (let x = 0; x < width; x++) {
				const t = elapsedSeconds - windowSeconds * (1 - x / width);
				const phase = (((t * rateHz) % 1) + 1) % 1;
				const v = shapeValue(shape, phase, t, rateHz);
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

<canvas bind:this={canvasEl} class="lfo-scope" aria-hidden="true"></canvas>

<style>
	.lfo-scope {
		display: block;
		width: 100%;
		height: 40px;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
	}
</style>
