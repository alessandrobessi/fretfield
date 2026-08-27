<script lang="ts">
	/**
	 * Radio Mode's full-bleed audio-reactive visual (user-requested, 2026-08 --
	 * an autonomous 24/7 stream to promote FretField on YouTube). A radial
	 * spectrum ring reading real samples from `scalePractice.getMasterAnalyser()`
	 * every frame -- same "genuine live tap, not a modeled re-creation" idiom
	 * `AcidBassAudioScope.svelte` already established, just full-screen and
	 * arranged in a circle instead of a small bars-then-waveform strip, and in
	 * the app's own yellow/black hardware-brand palette (not that scope's own
	 * red/orange trace colors) since this is explicitly a promotional surface --
	 * it should read as unmistakably FretField on a stream thumbnail.
	 *
	 * `analyser` is `null` only very briefly (before `scale-practice.svelte.ts`'s
	 * `start()` has run) -- shown as an idle ring rather than a blank canvas,
	 * same reasoning as the existing scope component's own idle state.
	 */
	interface Props {
		analyser: AnalyserNode | null;
		/** A single formatted line, e.g. "C · 12-Bar Dominant Blues · Chicago Shuffle · Acid · 92 BPM" -- formatting the combo into words is the page's job, not this component's. */
		nowPlaying: string | null;
	}

	let { analyser, nowPlaying }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	const BG_COLOR = '#151411';
	const RING_COLOR = 'rgba(241, 230, 197, 0.12)';
	const BAR_COLOR = '#e3ac18';
	const BAR_DIM_COLOR = 'rgba(227, 172, 24, 0.35)';
	const PULSE_COLOR = 'rgba(227, 172, 24, 0.15)';

	const BAR_COUNT = 90;
	// Same reasoning as AcidBassAudioScope's own SPECTRUM_MAX_HZ -- the bulk of
	// a drum/bass/pad mix's visually interesting energy sits well under this,
	// and zooming into that range is what actually makes the ring move.
	const SPECTRUM_MAX_HZ = 8000;

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

		function drawIdle(): void {
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = BG_COLOR;
			ctx.fillRect(0, 0, width, height);
			const cx = width / 2;
			const cy = height / 2;
			const radius = Math.min(width, height) * 0.28;
			ctx.strokeStyle = RING_COLOR;
			ctx.lineWidth = Math.max(1, radius * 0.01);
			ctx.beginPath();
			ctx.arc(cx, cy, radius, 0, Math.PI * 2);
			ctx.stroke();
		}

		const liveAnalyser = analyser;
		if (liveAnalyser === null) {
			resize();
			drawIdle();
			const idleResizeObserver = new ResizeObserver(() => {
				resize();
				drawIdle();
			});
			idleResizeObserver.observe(canvas);
			return () => idleResizeObserver.disconnect();
		}

		const freqBins = new Uint8Array(liveAnalyser.frequencyBinCount);
		const binHz = liveAnalyser.context.sampleRate / liveAnalyser.fftSize;
		const spectrumBinCount = Math.min(freqBins.length, Math.round(SPECTRUM_MAX_HZ / binHz));
		const binsPerBar = Math.max(1, Math.floor(spectrumBinCount / BAR_COUNT));

		function draw(analyser: AnalyserNode): void {
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = BG_COLOR;
			ctx.fillRect(0, 0, width, height);

			analyser.getByteFrequencyData(freqBins);

			const cx = width / 2;
			const cy = height / 2;
			const innerRadius = Math.min(width, height) * 0.18;
			const maxBarLength = Math.min(width, height) * 0.32;

			// Low-frequency average drives a soft center pulse -- the kick/bass
			// "thump" reads as a genuine size change, not just ring motion.
			let bassSum = 0;
			const bassBinCount = Math.max(1, Math.round(spectrumBinCount * 0.12));
			for (let i = 0; i < bassBinCount; i++) bassSum += freqBins[i];
			const bassLevel = bassSum / bassBinCount / 255;

			ctx.fillStyle = PULSE_COLOR;
			ctx.beginPath();
			ctx.arc(cx, cy, innerRadius * (0.85 + bassLevel * 0.5), 0, Math.PI * 2);
			ctx.fill();

			ctx.strokeStyle = RING_COLOR;
			ctx.lineWidth = Math.max(1, innerRadius * 0.01);
			ctx.beginPath();
			ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
			ctx.stroke();

			for (let bar = 0; bar < BAR_COUNT; bar++) {
				let sum = 0;
				const startBin = bar * binsPerBar;
				for (let i = 0; i < binsPerBar; i++) sum += freqBins[startBin + i] ?? 0;
				const magnitude = sum / binsPerBar / 255;
				const barLength = magnitude * maxBarLength;

				const angle = (bar / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				const x0 = cx + cos * innerRadius;
				const y0 = cy + sin * innerRadius;
				const x1 = cx + cos * (innerRadius + barLength);
				const y1 = cy + sin * (innerRadius + barLength);

				ctx.strokeStyle = magnitude > 0.05 ? BAR_COLOR : BAR_DIM_COLOR;
				ctx.lineWidth = Math.max(
					1.5,
					(Math.min(width, height) * 0.006) / (bar % 2 === 0 ? 1 : 1.4)
				);
				ctx.beginPath();
				ctx.moveTo(x0, y0);
				ctx.lineTo(x1, y1);
				ctx.stroke();
			}
		}

		resize();
		draw(liveAnalyser);

		const resizeObserver = new ResizeObserver(() => {
			resize();
			draw(liveAnalyser);
		});
		resizeObserver.observe(canvas);

		let raf: number | null = null;
		if (!reduceMotion) {
			const loop = () => {
				draw(liveAnalyser);
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

<div class="radio-visualizer">
	<canvas bind:this={canvasEl} aria-hidden="true"></canvas>
	{#if nowPlaying}
		<p class="now-playing">{nowPlaying}</p>
	{/if}
</div>

<style>
	.radio-visualizer {
		position: fixed;
		inset: 0;
		background: var(--ff-black, #151411);
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.now-playing {
		position: absolute;
		left: 0;
		right: 0;
		bottom: clamp(1.5rem, 5vh, 3rem);
		margin: 0;
		text-align: center;
		font-weight: 700;
		font-size: clamp(1rem, 2.2vw, 1.5rem);
		letter-spacing: 0.02em;
		color: var(--ff-yellow, #e3ac18);
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
	}
</style>
