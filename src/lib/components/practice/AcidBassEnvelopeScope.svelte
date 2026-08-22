<script lang="ts">
	import {
		attackToSeconds,
		decayToSeconds,
		releaseToSeconds,
		sustainToRatio
	} from '$lib/acid-bass/resolve';

	/**
	 * A small live preview of the amplitude envelope's own Attack/Decay/
	 * Sustain/Release shape -- redraws instantly whenever any of the four
	 * knobs change, plus a looping playhead so the stage order (rise, settle
	 * to Sustain, hold, release) reads at a glance. Not a literal scope tap on
	 * the real `vca.gain` AudioParam (same reasoning `AcidBassLfoScope`'s own
	 * doc comment gives) -- a client-rendered re-creation using the exact same
	 * `attackToSeconds`/`decayToSeconds`/`releaseToSeconds`/`sustainToRatio`
	 * mappings `acid-bass-voice.ts` itself uses, so the shape shown here is
	 * genuinely the shape the DSP schedules, not just a stylized approximation.
	 *
	 * The hold between Decay and Release is a fixed illustrative duration
	 * (`HOLD_SECONDS`) -- a real note's actual hold length depends on that
	 * step's own gate/duration, which this component (living in the patch
	 * panel, not a per-step view) has no access to and shouldn't pretend to.
	 */
	interface Props {
		attack: number;
		decay: number;
		sustain: number;
		release: number;
	}

	let { attack, decay, sustain, release }: Props = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	const BG_COLOR = '#151411';
	const GRID_COLOR = 'rgba(241, 230, 197, 0.15)';
	const TRACE_COLOR = '#e34832';
	const TRACE_WIDTH = 2;
	const VERTICAL_PADDING = 4;
	const HOLD_SECONDS = 0.3;
	// Exponential ramps can't start from or reach exactly 0 -- the same small
	// visual floor `MIN_GAIN` serves in the real DSP, just for the curve math
	// here rather than an actual AudioParam.
	const FLOOR = 0.002;
	// A full playhead sweep takes at least this long, so a mostly-instant
	// envelope (every knob near 0) doesn't blur into an unreadable flash.
	const MIN_LOOP_SECONDS = 0.6;

	function expRamp(from: number, to: number, fraction: number): number {
		const f = Math.min(1, Math.max(0, fraction));
		const start = Math.max(FLOOR, from);
		const end = Math.max(FLOOR, to);
		return start * Math.pow(end / start, f);
	}

	function envelopeValueAt(
		t: number,
		attackSeconds: number,
		decaySeconds: number,
		sustainRatio: number,
		releaseSeconds: number
	): number {
		const decayEnd = attackSeconds + decaySeconds;
		const holdEnd = decayEnd + HOLD_SECONDS;
		const releaseEnd = holdEnd + releaseSeconds;
		if (t <= attackSeconds) return expRamp(FLOOR, 1, attackSeconds > 0 ? t / attackSeconds : 1);
		if (t <= decayEnd) {
			return expRamp(1, sustainRatio, decaySeconds > 0 ? (t - attackSeconds) / decaySeconds : 1);
		}
		if (t <= holdEnd) return sustainRatio;
		if (t <= releaseEnd) {
			return expRamp(sustainRatio, FLOOR, releaseSeconds > 0 ? (t - holdEnd) / releaseSeconds : 1);
		}
		return FLOOR;
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

		function draw(playheadT: number | null): void {
			const attackSeconds = attackToSeconds(attack);
			const decaySeconds = decayToSeconds(decay);
			const releaseSeconds = releaseToSeconds(release);
			const sustainRatio = sustainToRatio(sustain);
			const totalSeconds = Math.max(
				MIN_LOOP_SECONDS,
				attackSeconds + decaySeconds + HOLD_SECONDS + releaseSeconds
			);

			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			ctx.fillStyle = BG_COLOR;
			ctx.fillRect(0, 0, width, height);
			ctx.strokeStyle = GRID_COLOR;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, height - VERTICAL_PADDING);
			ctx.lineTo(width, height - VERTICAL_PADDING);
			ctx.stroke();

			ctx.strokeStyle = TRACE_COLOR;
			ctx.lineWidth = TRACE_WIDTH;
			ctx.beginPath();
			for (let x = 0; x < width; x++) {
				const t = (x / width) * totalSeconds;
				const v = envelopeValueAt(t, attackSeconds, decaySeconds, sustainRatio, releaseSeconds);
				const y = height - VERTICAL_PADDING - v * (height - 2 * VERTICAL_PADDING);
				if (x === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();

			if (playheadT !== null) {
				const phaseT = playheadT % totalSeconds;
				const v = envelopeValueAt(
					phaseT,
					attackSeconds,
					decaySeconds,
					sustainRatio,
					releaseSeconds
				);
				const x = (phaseT / totalSeconds) * width;
				const y = height - VERTICAL_PADDING - v * (height - 2 * VERTICAL_PADDING);
				ctx.fillStyle = TRACE_COLOR;
				ctx.beginPath();
				ctx.arc(x, y, TRACE_WIDTH * 1.8, 0, 2 * Math.PI);
				ctx.fill();
			}
		}

		resize();
		draw(reduceMotion ? null : 0);

		const resizeObserver = new ResizeObserver(() => {
			resize();
			draw(reduceMotion ? null : 0);
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

<canvas bind:this={canvasEl} class="envelope-scope" aria-hidden="true"></canvas>

<style>
	.envelope-scope {
		display: block;
		width: 100%;
		height: 40px;
		border-radius: var(--ff-radius-control, 4px);
		border: 1px solid var(--ff-black, #151411);
	}
</style>
