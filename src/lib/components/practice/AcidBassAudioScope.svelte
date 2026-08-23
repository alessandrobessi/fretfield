<script lang="ts">
	/**
	 * A genuine live tap on one real point in the Acid Bass voice's own audio
	 * graph -- spectrum on top, waveform below -- unlike `AcidBassLfoScope`/
	 * `AcidBassEnvelopeScope`/`AcidBassAuxModScope`, which are all
	 * client-rendered re-creations from patch values, not a literal scope tap
	 * (see their own doc comments). This one reads real samples every frame
	 * from whichever `AnalyserNode` it's given (`AcidBassVoice.outputAnalyser`
	 * or `.delayAnalyser`, both `acid-bass-voice.ts`), so it shows what that
	 * point in the signal chain actually carries, not any modeled
	 * approximation of it (user-requested, 2026-08; extended to the delay
	 * tap, also user-requested, same month).
	 *
	 * `analyser` is `null` whenever nothing is playing (`scalePractice.running`
	 * is false, or Acid Bass never started) -- shown as a clearly-labeled idle
	 * state rather than a blank canvas, so it reads as "waiting for
	 * playback," not "broken."
	 */
	interface Props {
		analyser: AnalyserNode | null;
		idleLabel?: string;
	}

	let { analyser, idleLabel = 'Play to see the output' }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	const BG_COLOR = '#151411';
	const GRID_COLOR = 'rgba(241, 230, 197, 0.15)';
	const TRACE_COLOR = '#e34832';
	const TRACE_WIDTH = 1.5;
	const IDLE_COLOR = 'rgba(241, 230, 197, 0.4)';
	// Only the bass-relevant end of the spectrum -- this voice never
	// produces meaningful energy above a few kHz, and zooming into the low
	// end is what actually makes a cutoff sweep or a resonance peak visible.
	const SPECTRUM_MAX_HZ = 6000;

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
			ctx.strokeStyle = GRID_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, height / 2);
			ctx.lineTo(width, height / 2);
			ctx.stroke();
			ctx.fillStyle = IDLE_COLOR;
			const fontPx = Math.max(9, Math.round(height * 0.16));
			ctx.font = `${fontPx}px inherit, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(idleLabel, width / 2, height / 2);
		}

		// Captured once per effect run into a non-null local -- `analyser`
		// itself is a reactive prop binding, so TypeScript can't narrow it to
		// non-null across statements the way it would a plain local.
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
		const timeBins = new Uint8Array(liveAnalyser.fftSize);
		const binHz = liveAnalyser.context.sampleRate / liveAnalyser.fftSize;
		const spectrumBinCount = Math.min(freqBins.length, Math.round(SPECTRUM_MAX_HZ / binHz));

		// `analyser` as an explicit parameter, not a closed-over reference --
		// TypeScript can't carry the non-null narrowing above into a nested
		// function closure, even for a `const`.
		function draw(analyser: AnalyserNode): void {
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = BG_COLOR;
			ctx.fillRect(0, 0, width, height);

			const spectrumHeight = height * 0.6;
			const waveformTop = spectrumHeight;
			const waveformHeight = height - spectrumHeight;

			// Spectrum (top) -- bars, low frequencies on the left.
			analyser.getByteFrequencyData(freqBins);
			const barWidth = width / spectrumBinCount;
			ctx.fillStyle = TRACE_COLOR;
			for (let i = 0; i < spectrumBinCount; i++) {
				const magnitude = freqBins[i] / 255;
				const barHeight = magnitude * spectrumHeight;
				ctx.fillRect(
					i * barWidth,
					spectrumHeight - barHeight,
					Math.max(1, barWidth - 0.5),
					barHeight
				);
			}

			// Divider between the two zones.
			ctx.strokeStyle = GRID_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, spectrumHeight);
			ctx.lineTo(width, spectrumHeight);
			ctx.stroke();

			// Waveform (bottom) -- real time-domain samples, centered.
			analyser.getByteTimeDomainData(timeBins);
			ctx.strokeStyle = TRACE_COLOR;
			ctx.lineWidth = TRACE_WIDTH;
			ctx.beginPath();
			const waveformCenter = waveformTop + waveformHeight / 2;
			for (let x = 0; x < width; x++) {
				const sampleIndex = Math.floor((x / width) * timeBins.length);
				const v = (timeBins[sampleIndex] - 128) / 128;
				const y = waveformCenter - v * (waveformHeight / 2 - 2);
				if (x === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
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

<canvas bind:this={canvasEl} class="audio-scope" aria-hidden="true"></canvas>

<style>
	.audio-scope {
		display: block;
		width: 100%;
		height: 72px;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
	}
</style>
