<script lang="ts">
	import { untrack } from 'svelte';
	import { getChordDefinition } from '$lib/music/chords';
	import { intervalCompoundLabel } from '$lib/music/intervals';
	import { defaultNoteName, type PitchClass } from '$lib/music/pitch';
	import { PRACTICE_MODE_STYLES } from '$lib/practice/presets';
	import type {
		HintLevel,
		PracticeMode,
		PracticePrompt,
		PracticeResult
	} from '$lib/practice/types';
	import { fretfield } from '$lib/stores/fretfield.svelte';
	import { liveInput } from '$lib/stores/live-input.svelte';
	import { practice } from '$lib/stores/practice.svelte';

	// Live Input's `noteOnsetId` must be the ONLY tracked dependency here.
	// Svelte tracks `$state` reads by call stack, not lexical scope — reading
	// `liveInput.detectedNote` untracked isn't enough on its own, because
	// `practice.handleDetectedNote()` reads and writes `practice.session`
	// several layers deep (inside the pure `recordAttempt()`), and any of
	// those reads would otherwise get silently captured too, turning the
	// resulting write into a self-retriggering infinite loop. Wrapping the
	// whole call in `untrack` keeps this effect reacting to onsets only.
	$effect(() => {
		const onsetId = liveInput.noteOnsetId;
		if (onsetId === 0) return;
		untrack(() => {
			const detected = liveInput.detectedNote;
			if (detected !== null) practice.handleDetectedNote(detected);
		});
	});

	// Regenerates the current exercise if the tonic/chord/progression changed
	// underneath it (product spec §13). Same `untrack` reasoning as above:
	// `refreshIfStale()` reads/writes `practice.session` and rebuilds context
	// from several more `fretfield` fields internally — only root/chordId/
	// progressionTemplateId should ever trigger this effect.
	$effect(() => {
		// Read unconditionally, not inside the `||` below — `||` short-circuits,
		// and once `root` is set (the common case) that would silently stop
		// `progressionTemplateId` from ever being read, so it'd stop being a
		// tracked dependency and a progression switch would go unnoticed.
		const root = fretfield.root;
		const chordId = fretfield.chordId;
		const progressionTemplateId = fretfield.progressionTemplateId;
		if (root !== null || chordId || progressionTemplateId !== null) {
			untrack(() => practice.refreshIfStale());
		}
	});

	function chordSymbol(root: PitchClass, chordId: string): string {
		return `${defaultNoteName(root)}${getChordDefinition(chordId).symbol}`;
	}

	function promptText(prompt: PracticePrompt): string {
		switch (prompt.kind) {
			case 'find-interval':
				return `Find ${intervalCompoundLabel(prompt.interval)} relative to ${defaultNoteName(prompt.root)}`;
			case 'find-chord-tone':
				return `Find the ${intervalCompoundLabel(prompt.interval)} of ${chordSymbol(prompt.root, prompt.chordId)}`;
			case 'resolve-note':
				return `${chordSymbol(prompt.fromRoot, prompt.fromChordId)} → ${chordSymbol(prompt.toRoot, prompt.toChordId)} — you're on ${defaultNoteName(prompt.currentPitchClass)}. Find a strong resolution.`;
			case 'follow-path':
				return `Step ${prompt.stepIndex + 1} of ${prompt.totalSteps} — ${chordSymbol(prompt.root, prompt.chordId)}`;
		}
	}

	function resultLabel(result: PracticeResult): string {
		switch (result) {
			case 'exact':
				return 'Correct';
			case 'strong-alternative':
				return 'Strong alternative';
			case 'valid-alternative':
				return 'Valid alternative';
			case 'incorrect':
				return 'Not quite';
			case 'ignored':
				return '';
		}
	}

	const exercise = $derived(practice.session.currentExercise);
	const hintText = $derived.by(() => {
		if (practice.session.settings.hintLevel === 'hidden') return null;
		const target = exercise?.targets[0];
		if (!target || target.interval === null) return null;
		return `Target interval: ${intervalCompoundLabel(target.interval)}`;
	});

	function handleModeChange(event: Event): void {
		const mode = (event.currentTarget as HTMLSelectElement).value as PracticeMode;
		practice.start(mode);
	}

	function handleHintChange(event: Event): void {
		practice.setHintLevel((event.currentTarget as HTMLSelectElement).value as HintLevel);
	}
</script>

<!--
	Session-driven, not always-visible: starting a session is now
	PracticeHome's job (the Quick Start cards under the Practice
	destination) — this panel only appears once one is actually running, so
	it stops cluttering Explore's default view for anyone not mid-exercise.
	The mode-picker/Stop button that remain here are for switching modes or
	stopping without a trip back to Practice, not a second entry point.
-->
{#if practice.session.status !== 'idle'}
	<div class="guided-practice active">
		<div class="top-row">
			<span class="title">Guided Practice</span>
			<div class="controls">
				<label class="mode-picker">
					Mode:
					<select
						aria-label="Practice mode"
						value={practice.session.mode}
						onchange={handleModeChange}
					>
						{#each Object.values(PRACTICE_MODE_STYLES) as style (style.mode)}
							<option value={style.mode}>{style.label}</option>
						{/each}
					</select>
				</label>
				<button type="button" class="toggle" onclick={() => practice.stop()}>Stop</button>
			</div>
		</div>

		<div class="details">
			<label class="hint-picker">
				Hint:
				<select
					aria-label="Hint level"
					value={practice.session.settings.hintLevel}
					onchange={handleHintChange}
				>
					<option value="hidden">Hidden</option>
					<option value="interval">Interval</option>
					<option value="positions">Positions</option>
				</select>
			</label>
			<label class="local-field-toggle">
				<input
					type="checkbox"
					checked={practice.session.settings.localFieldOnly}
					onchange={(e) => practice.setLocalFieldOnly(e.currentTarget.checked)}
				/>
				Local Field only
			</label>

			{#if practice.session.status === 'completed'}
				<p class="prompt" role="status">Path complete.</p>
			{:else if exercise}
				<p class="prompt" role="status">{promptText(exercise.prompt)}</p>
				{#if hintText}
					<p class="hint">{hintText}</p>
				{/if}

				{#if practice.session.exerciseStatus === 'waiting-for-note'}
					<p class="status-line">
						Listening… <span class="attempts">Attempts: {practice.stats.attempts}</span>
					</p>
				{:else if practice.session.exerciseStatus === 'feedback' && practice.session.lastEvaluation}
					{@const evaluation = practice.session.lastEvaluation}
					<div class="feedback" data-result={evaluation.result} role="status">
						<p class="result-label">{resultLabel(evaluation.result)}</p>
						{#if evaluation.explanation}
							<p class="explanation">
								{defaultNoteName(evaluation.explanation.pitchClass)}
								{#if evaluation.explanation.interval}
									— {intervalCompoundLabel(evaluation.explanation.interval)}
								{/if}
								{#if evaluation.explanation.roleDescription}
									— {evaluation.explanation.roleDescription}
								{/if}
							</p>
						{/if}
						{#if evaluation.positionAmbiguous}
							<p class="ambiguous-note">Correct note — position ambiguous.</p>
						{/if}
						<button type="button" class="next" onclick={() => practice.next()}>Next</button>
					</div>
				{/if}
			{:else}
				<p class="prompt empty">Not enough context for this mode yet.</p>
			{/if}

			<p class="stats">
				Attempts: {practice.stats.attempts} · Correct: {practice.stats.correct} · Strong: {practice
					.stats.strongAlternatives}
				· Completed: {practice.stats.exercisesCompleted}
			</p>
		</div>
	</div>
{/if}

<style>
	.guided-practice {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: var(--fret-bg, #fff);
		border: 1px solid var(--fret-border, #ddd3f7);
		border-radius: 14px;
		padding: 0.85rem 1.1rem;
		font-size: 0.85rem;
	}

	.top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.title {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.mode-picker,
	.hint-picker,
	.local-field-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
	}

	select {
		font: inherit;
		padding: 0.2rem 0.4rem;
		border-radius: 8px;
		border: 1px solid var(--fret-border, #ddd3f7);
	}

	select:focus-visible,
	.local-field-toggle input:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 1px;
	}

	.toggle {
		font: inherit;
		font-weight: 700;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--practice-target-accent, #10b981);
		background: transparent;
		color: var(--practice-target-accent, #10b981);
		cursor: pointer;
	}

	.toggle:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.guided-practice.active .toggle {
		background: var(--practice-target-accent, #10b981);
		color: #fff;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.prompt {
		margin: 0;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.prompt.empty {
		font-weight: 400;
		opacity: 0.6;
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}

	.status-line {
		margin: 0;
		display: flex;
		gap: 0.6rem;
		opacity: 0.75;
	}

	.feedback {
		margin-top: 0.2rem;
		padding-top: 0.4rem;
		border-top: 1px dashed var(--fret-border, #ddd3f7);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
	}

	.result-label {
		margin: 0;
		font-weight: 700;
	}

	.feedback[data-result='exact'] .result-label,
	.feedback[data-result='strong-alternative'] .result-label {
		color: var(--practice-correct-accent, #10b981);
	}

	.feedback[data-result='valid-alternative'] .result-label {
		/* --practice-caution-accent (#eab308, defined in app.css) is FretCell's
		   fretboard border/fill color -- too light to also use directly as
		   text (1.92:1 against white), so darken it here the same way
		   NoteInspector.svelte's role colors are darkened for text use,
		   rather than defining a second, disconnected token. */
		color: color-mix(in srgb, var(--practice-caution-accent, #eab308) 70%, black);
	}

	.feedback[data-result='incorrect'] .result-label {
		color: var(--fret-fg, #241a3d);
		opacity: 0.8;
	}

	.explanation {
		margin: 0;
		font-size: 0.85rem;
	}

	.ambiguous-note {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.65;
	}

	.next {
		font: inherit;
		font-weight: 700;
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		border: none;
		background: var(--nut, #7c3aed);
		color: #fff;
		cursor: pointer;
	}

	.next:focus-visible {
		outline: 3px solid var(--focus-ring, #7c3aed);
		outline-offset: 2px;
	}

	.stats {
		margin: 0.2rem 0 0;
		font-size: 0.72rem;
		opacity: 0.6;
	}
</style>
