# AGENTS.md — FretField

This file defines the operating rules for coding agents working on FretField.

Read `BLUEPRINT.md` and `ROADMAP.md` before making architectural or product changes.

---

## 1. Mission

FretField is an interactive bass-fretboard application that visualizes harmonic function relative to a selected root and chord.

Its central idea is:

> The fretboard is a harmonic field, not merely a grid of note names.

Every implementation decision should reinforce that idea. By deliberate, explicit product direction the app was stripped down from its original six-lens design to just the two features actually in use, each a `FieldMode`:

```text
Chord Field       "What can I play now?"   — Explore's only lens
Scale Practice    "Can you play this scale in time?"   — Practice's only content
```

The four other lenses this app originally had (Progression Field, Voice-Leading Paths, Local Fields, Scale Blocks, Scale Explorer), all four Guided Practice exercise modes, the Presets feature (curated one-click sessions and user-saved "My Presets"), the Progress tab, and the saved-material features (Favorite Chords, Scale Maps, custom Progressions) were all removed entirely — not hidden, not superseded, deleted from the codebase along with their stores/components/tests. Do not resurrect any of them without an explicit, direct product request; if you find a stale reference to one, that's doctrine drift to fix, not a feature to restore.

Scale Practice holds its own independent root/fret-zone/tempo session (`scale-practice.svelte.ts`, not `fretfield.svelte.ts`, and with no import relationship in either direction): every note of the active chord's scale is highlighted at once, whatever's played is highlighted live, and a synthesized drum machine (Play/Stop), with an optional chord-progression backing, plays independently of both — timing that Chord Field has no equivalent of. There is no standalone manual scale (see §4's `scale-practice.svelte.ts` entry) — the highlighted scale always comes from the picked progression's active chord. `fretfield.mode`/`FieldMode` still distinguishes the two (`'chord' | 'scale-practice'`), but purely as `FretCell.svelte`/`NoteInspector.svelte`'s internal "which layer am I rendering" flag — there's no user-facing switcher anymore, since Explore only ever shows Chord Field and Practice only ever shows Scale Practice.

---

## 2. Product stack

Use:

```text
pnpm
TypeScript
SvelteKit
Svelte 5
Vitest
Playwright
```

Prefer browser-side logic for the core application.

Do not add a backend, database, authentication layer, or external state service unless a roadmap feature genuinely requires one.

---

## 3. Core engineering rule

Keep music theory independent from UI code.

Correct:

```text
music engine → analyzed fretboard model → Svelte rendering
```

Incorrect:

```text
Svelte component contains chord formulas, pitch arithmetic, and styling decisions together
```

No Svelte component should need to know how to calculate a major third, transpose a pitch class, or determine the notes in a chord.

---

## 4. Architecture boundaries

### `src/lib/music/`

Pure TypeScript only.

Responsibilities:

- pitch classes
- intervals
- tunings
- fretboard generation
- chord formulas
- harmonic analysis
- progression templates (used by Scale Practice's chord backing, not a resolution/voice-leading engine anymore — see below)
- scale definitions and chord-family-aware scale suggestions (`scales.ts`)

Must not import:

- Svelte
- browser APIs
- DOM utilities
- CSS
- route modules

### `src/lib/audio/`

Pure TypeScript, acoustic-pitch domain only (Live Input's DSP layer). Responsibilities: Web Audio capture, YIN pitch detection, temporal stabilization, frequency/MIDI/pitch-class conversion. Its only output type, `DetectedNote`, is neutral — frequency, MIDI, pitch class, octave, cents, confidence.

Must not know about, or import: chords, keys, `HarmonicRole`, progressions, or anything else from `src/lib/music/` beyond the bare `PitchClass` type. Harmonic meaning is layered on afterward by `src/lib/stores/live-input.svelte.ts` combined with the main store's already-computed analysis — never a second, parallel harmonic engine living in this domain.

Must not depend on a real microphone for tests — real capture (`audio-input.ts`) and the deterministic test double (`fake-audio-source.ts`) both implement the same `LiveAudioSource` interface, so DSP logic is tested with synthetic buffers and integration is tested with the fake source.

`drum-voices.ts`/`chord-voices.ts`/`acid-bass-voice.ts` are this directory's one exception to "acoustic-pitch domain only": they're audio _output_ (the Groove Engine's synthesized drum kit, its optional chord-progression backing pad, and the optional Acid Bass synth voice — see `src/lib/groove/`/`src/lib/acid-bass/` below), not analysis. They still must not import anything theory-related — no scales, no chord/key concepts, only step timing, synthesized percussion/oscillators, and plain Hz frequencies/MIDI numbers and durations. `chord-voices.ts`'s `triggerChordPad(ctx, time, frequenciesHz, durationSeconds, gain?)` takes frequencies, never a chord/root/interval — `scale-practice.svelte.ts` resolves theory (via `$lib/music/chords`'s `required` intervals and `$lib/music/intervals`'s `intervalSemitones`) before calling in, same boundary `drum-voices.ts` already keeps. `drum-voices.ts`'s six trigger functions (`triggerKick`/`triggerSnare`/`triggerClosedHat`/`triggerOpenHat`/`triggerRide`/`triggerRim`) all take a plain `gain` parameter — that's how step velocity (ghost/normal/accent) reaches the actual sound, with no theory or sequencing concept inside this file. `acid-bass-voice.ts`'s `createAcidBassVoice(ctx, destination?)` is architecturally different from the other two by necessity, not inconsistency: `drum-voices.ts`/`chord-voices.ts` build a fresh node graph per hit/chord (stateless, fire-and-forget trigger functions), but Acid Bass's slide/legato behavior needs one long-lived monophonic node graph that persists across the whole playback session — `AcidBassVoice`'s `setPatch`/`schedule`/`setTempo`/`silence`/`dispose` interface, not a plain `trigger*` function. As of the V2 engine (`~/Downloads/ACID-BASS-ENGINE-V2.md`) plus a later Osc 2/dual-LFO follow-up, that graph is substantially larger than "two oscillators and a filter": four always-running main-wave oscillators (saw/square/triangle/Pulse) crossfaded by waveform, an optional sub oscillator, a second full oscillator (Osc 2 — a single type-switched node, the same simplification Sub uses, own independent tune/fine/level), a pre-filter saturation stage, a filter section that runs the Biquad path (`legacy`/`svf12`) and the `acid24` `AudioWorkletNode` (`acid-worklet-node.ts`) permanently in parallel and crossfades between them, a Pulse oscillator that does the same crossfade trick between a static `PeriodicWave` and its own live-PWM `AudioWorkletNode`, and two independent free-running LFOs (`acid-bass-lfo.ts`, one instance each) each routed to whichever single destination its own patch slot names via its own bank of depth-scaling gains — still not a many-to-many modulation matrix. Every one of those "two implementations of the same thing" pairs uses the identical idiom: both stay connected all the time, only their crossfade gain changes, so switching between them (or a worklet finishing its async load) never audibly glitches — worth knowing before adding a fourth. `sequencer.ts` (probability/ratchet/parameter locks) and the migration/factory-patch modules stay outside this file entirely — see the `$lib/acid-bass/` entry below for the full module breakdown. `scale-practice.svelte.ts` still resolves all theory (interval → MIDI, via `$lib/acid-bass/resolve.ts`'s `resolveAcidStepMidi` and `$lib/audio/note-mapping.ts`'s existing `midiToFrequency`) before calling in — `acid-bass-voice.ts` itself only ever sees plain Hz/MIDI, same boundary. All three share `scale-practice.svelte.ts`'s one `AudioContext`, entirely separate from the capture context `audio-input.ts` owns — never merged into one context, and never a second `AudioContext` for Acid Bass specifically.

### `src/lib/groove/`

Pure TypeScript, the Groove Engine's domain model — no Svelte, no `AudioContext`, no theory. Supersedes the old `$lib/audio/groove.ts`/`groove-presets.ts` single-pattern model.

```text
types.ts pattern.ts migrate.ts presets.ts transport.ts feel.ts intensity.ts time-signature.ts pattern-role.ts
```

`types.ts` is the data model: `GrooveStep` (a `StepVelocity` of `0`/`0.35`/`0.7`/`1` plus an optional `minIntensity`), `GroovePattern` (one pattern across the six-voice `DrumVoice` kit, its step count derived from the groove's meter — see `time-signature.ts` below, not a hardcoded 16), `PatternRole` (`'A' | 'B' | 'F' | 'T'` — main/variation/fill/turnaround, a fixed four-slot set, not an arbitrary/open-ended list — see §26; defined in the leaf module `pattern-role.ts` and re-exported here, same precedent as `TimeSignature`/`time-signature.ts`, so it has no dependency on `Groove` itself), and `Groove` (four named patterns, an `arrangement: PatternRole[]` mapping each bar of a loop to a role, `feel`/`feelAmount`, one `timeSignature` for the whole groove, and `acidBass: AcidBassState` — the Acid Bass Engine's own state, see `src/lib/acid-bass/` below; it shares this same `arrangement`/`PatternRole` mapping rather than an independent one). `pattern-role.ts` exists specifically so `types.ts` can import `AcidBassState` from `$lib/acid-bass/types` without a cycle — `acid-bass/types.ts` needs `PatternRole` back, and importing it from `groove/types.ts` directly would cycle. `pattern.ts` holds every pure mutator (`cycleStepVelocity`, `setStepVelocity`, `setArrangementBar`, `setArrangementLength`, `setFeel`/`setFeelAmount`, `setTimeSignature`) plus `stepOffsetMs`, the swing-timing math — `setTimeSignature`/`createEmptyGroove` also build/resize `acidBass`'s patterns alongside the drum ones, so the two step counts can never drift apart. `feel.ts`'s `effectiveSwing(feel, amount)` is the only thing standing between the user-facing Feel/Amount controls and `stepOffsetMs` — Straight is always `0` regardless of a leftover `amount`. `intensity.ts`'s `stepShouldSound(step, intensity)` is the only place a step's `minIntensity` is interpreted (drum steps only — Acid Bass has no Intensity concept, see below). `migrate.ts`'s `coerceGroove` reads any prior persisted shape (the pre-Groove-Engine single boolean pattern, the pre-Feel-engine `Groove` with a bare `swing` number, the pre-time-signature `Groove` missing `timeSignature`, or the pre-Acid-Bass `Groove` missing `acidBass`) and always returns a current-model `Groove` — required reading before touching `Groove`'s shape again, since another migration step will be needed the next time a field changes. A migrated old groove always gets `acidBass.enabled: false`, even though its default pattern itself has active notes — an old groove must not suddenly gain audible bass on load. `presets.ts`'s `listGroovePresets()` is the curated genre library, including the flagship 12-bar "Chicago Shuffle" multi-pattern groove; every curated preset keeps `acidBass.enabled: false` too (no sonic change to existing presets).

`time-signature.ts` is the meter lookup table: `TIME_SIGNATURES` maps each supported `TimeSignature` (`'3/4' | '4/4' | '5/4' | '6/8' | '9/8' | '12/8'`) to its `stepsPerBar`, `stepsPerBeatGroup` (4 for simple meters, 6 for compound — a felt beat in a compound meter is a dotted quarter, i.e. 3 eighth-notes' worth of 16th-note-equivalent steps), and `isCompound`. One time signature per groove, not per-bar/mixed-meter — every pattern's step count derives from it via `setTimeSignature`, which resizes (truncate-or-pad, same shape `setArrangementLength` uses for bars) every pattern's every voice. Two things worth knowing before touching this: (1) BPM always means the quarter-note pulse in every meter including compound ones, so `stepDurationSeconds = 60/bpm/4` never changes across meters — only bar length and beat-grouping do; (2) Feel/Amount are deliberately inert for compound meters (`stepOffsetMs` returns `0` unconditionally when `stepsPerBeatGroup !== 4`) since their own 3-against-2 subdivision already carries an inherent shuffle feel that 16th-note swing math has no clean way to layer on top of.

`transport.ts`'s `GrooveTransport` is the single authoritative clock: a lookahead scheduler (`setInterval` checker, `AudioContext.currentTime`-precise scheduling) that calls back per-bar and per-step, plus count-in. It does no audio triggering itself — `scale-practice.svelte.ts` owns that, registering callbacks that call into `drum-voices.ts`/`chord-voices.ts`/`acid-bass-voice.ts`. Don't let a second timer/scheduler grow anywhere else in the app (§4's `scale-practice.svelte.ts` entry already says the same about `live-input.svelte.ts`) — drums, the chord-pad backing, the Acid Bass line, and the arrangement/chord-highlight bookkeeping all read off this one clock so they can never drift apart onto separate timers; Acid Bass in particular must never gain its own scheduling, per the Acid Bass Engine's own "no second scheduler" rule (§26). `start(ctx, bpm, countIn, stepsPerBar)` takes the current meter's bar length from the caller rather than assuming 16 — a count-in bar is always the same length as a real one in whatever meter is playing. `setBpm(bpm)`/`setStepsPerBar(stepsPerBar)` are the two _live_ mid-playback update paths — changing Tempo or Time Signature while the transport is running must go through these rather than waiting for the next Stop/Play; `setStepsPerBar` also snaps `currentStep` back to `0` if the new (shorter) meter would otherwise leave it pointing past the end of the freshly-resized pattern arrays. A live meter change is a two-part fix, not one: the transport's own `stepsPerBar`/`currentStep` (here) _and_ the store's per-bar-cached `currentBarPattern`/`currentBarAcidPattern` (see `scale-practice.svelte.ts` below) both have to stay in sync with a mid-bar resize, or a step index valid by one measure can still index past the end of a pattern array valid by the other.

### `src/lib/acid-bass/`

Pure TypeScript, the Acid Bass Engine's domain model — no Svelte, no `AudioContext` (the two DSP-adjacent modules, `acid24-ladder.ts`/`pulse-oscillator.ts`, are pure math too — see below). A monophonic, 303-inspired synth bass voice living inside Scale Practice's Groove Engine as a third accompaniment layer alongside drums and the chord pad, sharing the drum engine's persistence, migration, and `A`/`B`/`F`/`T` arrangement roles — there is no independent bass arrangement (see §26 for the full product scope and "must not add" list).

```text
types.ts pattern.ts resolve.ts migrate.ts sequencer.ts
factory-patches.ts acid24-ladder.ts pulse-oscillator.ts
```

`types.ts` is the data model, grouped by signal-path responsibility (V2, `~/Downloads/ACID-BASS-ENGINE-V2.md`, superseding the flat V1 shape; extended by a later Osc 2/dual-LFO follow-up, no separate spec doc): `AcidBassPatch` nests `oscillator`/`filter`/`envelope`/`glide`/`lfo1`/`lfo2`/`output` sub-patches rather than six flat macros — `oscillator.mainWave` now spans Saw/Square/Triangle/Pulse plus a sub oscillator (octave/wave/level) and a second full oscillator, Osc 2 (own wave including Pulse, own independent tune/fine/level — `osc2Enabled`/`osc2Wave`/`osc2Tune`/`osc2Fine`/`osc2Level`/`osc2PulseWidth`), `filter` picks a `model` (`legacy`/`svf12`/`acid24`) alongside cutoff/resonance/bipolar `envAmount`/key tracking/saturation, `envelope` splits attack/decay/release/accent into their own fields, and `lfo1`/`lfo2` (two independent full `AcidLfoPatch`s, each still single-destination — cutoff/pitch/pulseWidth/subLevel/osc2Level — not a many-to-many matrix) each hold shape/destination/rate-mode/rate-or-division/depth. `AcidBassStep` gained software-only sequencer powers: `probability` (0–100, default 100), `ratchet` (1–4, subdividing one step into that many evenly-spaced hits), `gate` (10–100, replacing a fixed ratio constant), and an optional `locks: AcidStepLocks` (up to five targets — cutoff/resonance/envAmount/drive/lfoDepth, the last applying to LFO 1 only, never LFO 2 — each overriding the patch for that one step only). `AcidBassState`'s `version` (the runtime discriminant `migrate.ts` uses — deliberately not a `V2`/`V3` type-name suffix anywhere, the same way V1 never had a `V1` suffix) is now `3`: `1` was the original flat shape (no `version` field at all), `2` the nested-but-singular-`lfo` shape, `3` the current Osc 2/dual-LFO shape. `crossBarSlide` (whether a pattern's last step, if sliding, glides into the next bar's first active step) defaults `true` for new state, `false` for anything migrated from V1 (V1 never had the concept), preserved as-is across a V2→V3 migration (V2 already modeled it correctly) — so a migrated groove never gains new articulation it wasn't authored with. Deliberately reuses the app's existing `IntervalId` (`$lib/music/intervals.ts`) for `AcidBassStep.interval` rather than inventing a second numeric interval type. `pattern.ts` holds the pure mutators, now including `setAcidStepProbability`/`Ratchet`/`Gate`/`Lock`/`clearAcidStepLocks` alongside the original `setAcidStepActive`/`Interval`/`Octave`/`toggleAccent`/`Slide` — same shape as `groove/pattern.ts`'s drum-pattern mutators, deliberately. `resolve.ts` is pure mapping/resolution: `resolveAcidStepMidi` (unchanged from V1 — interval + octave + a per-bar harmonic root → a MIDI number) plus every patch-macro-to-DSP-parameter mapping the voice consumes, including the model-specific `resonanceToModelParameter` (a `BiquadFilterNode.Q` for `legacy`/`svf12`, a ladder-feedback amount for `acid24` — same 0–100 UI range, different unit entirely underneath) and a parallel set of `v1*ToV2Value` inverse-mapping helpers used only by `migrate.ts`, co-located next to the forward mapping they invert. `migrate.ts`'s `coerceAcidBassState(raw, meter)` owns all V1→V3 and V2→V3 migration and untrusted-persisted-data validation for `acidBass` specifically — `groove/migrate.ts` delegates to it rather than growing further inline. `sequencer.ts` holds the sequencer-powers logic that isn't DSP: a deterministic (never `Math.random`) probability roll seeded off the absolute bar/step/role (so a groove's feel is stable and testable, yet still varies across repeats since the bar counter never resets), `ratchetOffsetsSeconds` (splits a step's duration into evenly-spaced hits), and `resolveStepLocks`. `factory-patches.ts` holds the eight curated patch-only presets — `getAcidBassFactoryPatch` always rebuilds a fresh patch object per call, so applying one and then tweaking a knob can never mutate the preset definition. `acid24-ladder.ts`/`pulse-oscillator.ts` are pure ports of the two `AudioWorkletProcessor`s' own DSP math (`static/acid-filter-processor.js`/`static/acid-pulse-oscillator-processor.js`), existing solely so that math is unit-testable — `AudioWorkletProcessor` can't run inside Vitest's jsdom environment, which has no Web Audio API at all; the two plain-JS worklet files re-implement the same algorithms by hand rather than importing these modules (worklets must stay dependency-free, not run through Vite's bundler — see `acid-worklet-node.ts` in `$lib/audio/`). Nothing here schedules anything or knows about `AudioContext.currentTime` — that stays in `scale-practice.svelte.ts`/`GrooveTransport`, same boundary the rest of the Groove Engine keeps.

### `src/lib/scale-practice/`

Pure TypeScript, Scale Practice's fretboard-position layer (`positions.ts`): `scalePositions(root, scale, zone, tuning, fretCount)` — every position in the zone belonging to the scale, the whole scale shown at once — and `positionsForPitchClass`, reused by the store for the live "what's currently played" lookup. No dependency on any Svelte store — pure functions, directly testable. Deliberately has no evaluation/grading logic at all — Scale Practice doesn't judge correctness or timing (see §26); it only reports which positions match a pitch class.

Must not duplicate scale theory: pitch classes come from `scalePitchClasses` in `$lib/music/scales.ts`, never a re-derivation. Must not know about `AudioContext`/wall-clock scheduling — that lives in the store (`scale-practice.svelte.ts`), the one place `$lib/audio/drum-voices.ts`'s and `$lib/audio/chord-voices.ts`'s voice triggers get called.

### `src/lib/components/`

Rendering and interaction only.

Components consume analyzed music data.

`src/lib/components/hardware/` holds the 2026 visual-rebrand's reusable primitives: `Led.svelte` (off/active/current, with a static glow plus an optional `prefers-reduced-motion`-safe pulse — every animated state has a non-motion equivalent, per §17), `HardwarePanel.svelte` (the branded yellow-chassis/carbon-panel wrapper; `tone="yellow"` is reserved for the handful of modules the rebrand calls out — Groove Engine, Acid Bass — not general app chrome), `HardwareButton.svelte` (primary yellow/black and secondary black/yellow variants, with a shared `pressed` deep-yellow state for toggle buttons), and `Knob.svelte` (a real rotary control: vertical-drag plus full keyboard support — arrows/Home/End/PageUp/PageDown — `role="slider"`, `aria-valuenow` always exposed but no visible numeric readout, by explicit user preference; used specifically for Acid Bass's patch macros — now three dozen-plus across its VCO/VCF/ENV/LFO 1/LFO 2/OUTPUT panels rather than the original six, still not a blanket replacement for every slider — Groove Engine's Amount/Intensity stay plain range inputs). Toggle/switch state elsewhere in the app still uses the existing `aria-pressed`-button pattern directly rather than a dedicated Switch component — a deliberate scope decision, not an oversight.

### `src/lib/stores/`

Application state only.

Do not duplicate derived harmonic logic here.

`live-input.svelte.ts` is a deliberately separate store from `fretfield.svelte.ts`: it owns the Web Audio lifecycle (`AudioContext`, `MediaStream`, `AnalyserNode`, device selection). Those must never leak into the main music-theory store — it only ever consumes plain `DetectedNote`/`FretPosition` state from `live-input.svelte.ts`, the same way a component consumes analyzed music data. `fretfield.svelte.ts` reads it directly for Chord Field's played-pitch highlighting; `scale-practice.svelte.ts` reads it independently for its own `playedPositions` — the two never share a code path.

`scale-practice.svelte.ts` is a third, fully independent store — no import relationship with `fretfield.svelte.ts` in either direction, confirmed and load-bearing (it's what let the app be stripped down to Chord Field + Scale Practice without a rearchitecture). It reads `liveInput.detectedNote` directly inside a `$derived` (`playedPositions`) — there's no "one attempt per note" bookkeeping to do here, just "what's sounding right now," so a live, continuously-updating derived is the right shape, not an event. It's also the one store allowed to touch `$lib/audio/drum-voices.ts`/`$lib/audio/chord-voices.ts`/`$lib/audio/acid-bass-voice.ts`; the scheduling itself lives in `$lib/groove/transport.ts`'s `GrooveTransport` (see above) — the store owns one `GrooveTransport` instance and registers callbacks on it, rather than running its own `setInterval` loop directly. No other store should grow timer-based logic. `playedPositions` is computed independently of `running` on purpose, and touching that decoupling needs a product conversation first, not just a refactor. `activeChordIndex` is always a valid index (default `0`, never `null`) that doubles as both playback position and click-to-preview selection — `setActiveChordIndex` wraps around the progression's length; picking a progression or clicking a chord row works whether or not the drum machine is running, and stopping playback freezes it rather than clearing it. `activeBarIndex` (which bar of `groove.arrangement` is sounding) and `selectedPatternRole` (which pattern the 16-step grid is currently editing) follow the same "always a sensible value, driven by the transport while running" shape.

The store owns one `acidBassVoice: AcidBassVoice | null`, created alongside `audioContext` in `start()` and disposed in `stop()` — never a second `AudioContext`, and never recreated mid-session (patch changes call `acidBassVoice.setPatch()` on the live instance instead, so slider edits apply to the running voice immediately, per-spec "live parameter editing"; `setBpm()` also calls the voice's `setTempo()`, since either LFO's Sync mode needs the current BPM and only a live tempo edit changes that outside of `setPatch()`). `handleBarStart` resolves and caches `currentBarPattern` (drums), `currentBarAcidPattern` (Acid Bass, same arrangement-role lookup — no independent bass arrangement), and `currentBarChordRoot` (the active progression chord's own root for this bar, or `this.root` with no progression) once per bar, all read by every step's `handleStep` call within that bar rather than recomputed per step — three parallel instances of the same "resolve once per bar" shape, deliberately, not three different patterns. `handleStep` calls the exact same `stepOffsetMs`-derived swung `time` for the Acid Bass step it schedules as it already computed for the drum voices at that step — one definition of "when does step N sound," never a second timing calculation for Acid Bass. `scheduleAcidBassStep` (V2, `~/Downloads/ACID-BASS-ENGINE-V2.md`) rolls a step's `probability` once via `sequencer.ts`'s `stepShouldTrigger` before anything else, and fans a `ratchet > 1` step out into several ordinary `voice.schedule()` calls sharing the same accent/locks (each a shorter slice of the step's own duration) rather than teaching the voice itself about ratchets — silently dropping that step's own outgoing `slide` in the process (spec: undefined which of several hits would glide). A step's `slide` glides toward the _immediately following_ step's own pitch when active, or — if `groove.acidBass.crossBarSlide` is on — the _next bar's_ first active step, via a `legato` trigger flag: the source step's own `schedule()` call ramps frequency toward the destination near the end of its own duration without releasing, and the destination step's own later `schedule()` call passes `legato: true` to skip the attack/filter-envelope retrigger while still scheduling its own release. Cross-bar resolution peeks one bar ahead via the same `activeAcidPatternForBar`/`resolveBarChordRoot` lookups `handleBarStart` itself will use once that bar starts (it hasn't run yet at the point the _previous_ bar's last step is scheduled — see `GrooveTransport`'s own callback order) and carries the "yes, glide into it" decision forward via a `pendingCrossBarLegato` flag, consumed the moment that next bar's own step 0 is scheduled. Migrated V1 grooves default `crossBarSlide` to `false`, so this path stays inert for them — a bar's last step drops its slide at the boundary exactly like V1 always did.

A mid-playback meter change (`setTimeSignature`, driven by `GrooveEditor.svelte`'s Time Signature `<select>`) is a two-part fix, not one — this bit the codebase for real once, worth restating here: `transport.setStepsPerBar(...)` keeps the transport's own step-counter bound to the new pattern length, but `currentBarPattern`/`currentBarAcidPattern` were already cached for the bar in progress at its last `onBarStart` and won't otherwise refresh until the _next_ one. If the new meter is longer than the old one and this bar is still playing, the next `onStep` would index past the end of the still-short, stale cached pattern arrays and throw (`groove/intensity.ts`'s `stepShouldSound` reading `.velocity` off `undefined`) — silently stalling the transport forever, since an uncaught exception inside `tick()`'s scheduling loop aborts before `nextStepTime`/`currentStep` ever advance, so the _same_ bad step gets retried, and rethrows, on every subsequent scheduler tick. `setTimeSignature` re-resolves both caches immediately (for `this.currentBar`, tracked alongside them for exactly this) whenever `this.running`, not just at the next bar boundary. Keep this in mind for _any_ future per-bar cache added here — each one needs the same immediate-refresh treatment on a mid-bar resize, not just the bar-boundary one.

The optional chord backing (`progressionTemplateId`/`barsPerChord`, off by default) is this store's one deliberate exception to Scale Practice having no chord concept in its harmonic model: a local `resolveProgressionTemplate` wraps `getProgressionTemplate` (`$lib/music/progressions.ts`) in a try/catch — the curated template list only, no user-saved/custom progressions (that feature was removed along with the rest of saved-material) — built on `scalePractice.root`, never an independent tonic, and voices each chord's `getChordDefinition(chordId).required` intervals via `intervalSemitones` before handing plain frequencies to `triggerChordPad`.

That same mechanism drives the fretboard too: `progressionChordScaleOverrides` (session-only — an intentional "doesn't survive reload" buffer, not an oversight) plus `progressionChordScales` (each chord's assigned scale, defaulting to `suggestedScalesFor(chord.chordId)[0]` unless overridden) combine into `activeChordScale`: the root+scale of whichever chord `activeChordIndex` points at. `displayRoot` (`activeChordScale?.root ?? root`) is what `FretCell.svelte` keys its Scale-Practice root-marker/interval labels against — so both the highlighted notes _and_ their labels re-root to whichever chord is currently active. This is a plain scale-note highlight reusing the same `scalePositions()` pure function Scale Practice always used — never Harmonic Field's nine-role analysis, which stays exclusive to Chord Field.

There is no standalone manual scale — no `scaleId`/`scale`/`setScaleId`, no "Scale" `<select>` next to Root. `root` stays (it's still the progression's transposition base and the fallback for `displayRoot`), but there is no fallback scale: `scalePositions` returns empty whenever `activeChordScale` is null (no progression picked, or the active chord's scale explicitly cleared to "—") — a scale only ever comes from a progression chord now. `barChordLabels` (index-aligned with `groove.arrangement`, the chord symbol sounding on each bar) is a `$derived` shared by two consumers — the always-visible read-only arrangement strip and the Groove Editor's own editable one — so they can never disagree.

Practice's UI (`src/lib/components/practice/`, see §4) is fretboard-first, not controls-first: `ScalePracticeSession.svelte` renders `PracticeSessionBar → LiveMusicalContext → Fretboard → FretboardStatus → BandPanel → NoteInspector`, three progressive-disclosure tiers deep. **PLAY** (`PracticeSessionBar.svelte`, always visible): Root, Progression, Groove preset, Tempo, Play/Stop. **ADJUST** (`BandPanel.svelte`'s Drums tab, the default tab, always visible once there): Feel/Amount, Intensity, Count-in, the "Pattern X · Bar Y/N" readout, and the "Edit Groove" trigger; its Harmony tab shows the chord-progression strip, with only the _active_ chord's scale `<select>` expanded (inactive rows show a plain scale-label — clicking a chord row makes it active, which reveals its own picker). **EDIT** (`GrooveEditor.svelte`, collapsed by default behind "Edit Groove"): Time Signature, Bars per chord, the editable arrangement strip, the pattern-role picker, the 16-step grid, and "My Grooves" save/rename/delete. `LiveMusicalContext.svelte` holds the live chord/scale/bar-position line, the always-visible _read-only_ arrangement strip (`GrooveArrangementStrip` with `readOnly`, hidden entirely for a single-bar groove), and the Zone (position) fields. `FretboardStatus.svelte` is a live-input-driven single-line readout (connection status, played note, interval-from-`displayRoot`, fret) — additive to, and independent from, `NoteInspector.svelte`'s hover/focus-driven explanation card.

### `src/routes/`

Composition and page-level concerns.

Keep route files thin.

---

## 5. Data model philosophy

Represent music mathematically internally and musically at the presentation boundary.

A good internal pitch-class model:

```text
0..11
```

A good display model:

```text
C Db D Eb E F F# G Ab A Bb B
```

Do not use note-name strings as the basis for interval arithmetic.

Enharmonic spelling is a display/context problem, not the primary pitch identity.

---

## 6. Harmonic analysis rule

Never treat an interval as having one universal function.

Bad:

```ts
const roles = {
	b3: 'color',
	4: 'tension'
};
```

Good:

```ts
analyzeInterval({ root, chord, interval });
```

The role depends on the selected harmonic context.

Examples:

- `b3` is structural over a minor chord.
- `b3/#9` may be altered/blues tension over a dominant chord.
- `4` is structural over sus4.
- `4/11` may create significant tension over a major chord containing the major third.

If the theory is ambiguous or genre-dependent, encode that explicitly rather than pretending there is a single universal truth.

---

## 7. Prefer semantic categories over arbitrary colors

UI styling must derive from semantic roles such as:

```text
root
structural
stable
extension
color
tension
alteration
chromatic-approach
avoid
```

Do not assign one unrelated color to every pitch class.

The color system communicates function, not note identity.

Also use non-color signals where practical:

- border
- opacity
- shape
- outline
- label

This is both pedagogically clearer and more accessible.

**Brand palette semantics (2026 visual rebrand, `src/app.css`'s `--ff-*` tokens):** yellow (`--ff-yellow`/`--ff-yellow-dark`) means selected/structural/intentional, near-black (`--ff-black`/`--ff-carbon`) is machine structure and app chrome, signal red (`--ff-red`) means live/current/sounding — reserved exclusively for the playhead, a connected live input, or an actively-playing transport, never a generic highlight or a destructive/danger color's excuse — and ivory (`--ff-ivory`) is neutral information. This is a _separate, additive_ layer on top of the nine role categories above, not a replacement for them: root/structural specifically live in the brand's two yellow shades (they already mean "selected/structural" in both systems at once), but the other seven roles keep distinguishing hues of their own, deliberately steered away from pure red so a harmonic role can never be mistaken for a live-signal cue. If a future palette change is tempted to collapse the nine roles down to fewer colors "for brand consistency," that's the wrong move — this section's own rule (nine semantic categories, not brand chrome) still governs the fretboard, and predates the brand spec.

---

## 8. Intervals are the default language

The primary display mode is intervals.

Supported modes:

```text
intervals
notes
both
```

Default:

```text
intervals
```

Do not design features that force the user back into note-name memorization when interval geometry is the clearer representation.

---

## 9. Root selection semantics

Clicking a fret selects its pitch class as root.

Distinguish:

1. the exact fret the user clicked;
2. all other occurrences of the same root pitch class.

The clicked position may receive an additional marker, but all equivalent roots must remain semantically recognized.

---

## 10. Interaction requirements

Prefer direct manipulation.

Good:

```text
click fret → state changes immediately
select chord → fretboard changes immediately
```

Avoid unnecessary confirmation buttons.

Hover must not mutate persistent harmonic state.

Keyboard interaction must remain possible.

---

## 11. Component design

Prefer small semantic components.

Examples:

```text
Fretboard
BassString
FretCell
ChordExplorer
ChordSelector
AnalysisModeToggle
DisplayModeToggle
Legend
NoteInspector
PracticeSessionBar
LiveMusicalContext
FretboardStatus
BandPanel
GrooveEditor
GrooveArrangementStrip
ProgressionSelector
AcidBassControls
AcidBassStepGrid
AcidBassStepEditor
Led
HardwarePanel
HardwareButton
Knob
```

Avoid premature micro-components for trivial wrappers.

A component should exist because it has a meaningful visual/behavioral responsibility, not merely because markup can be split.

---

## 12. Svelte rules

Use idiomatic current Svelte patterns.

Before introducing a legacy pattern, confirm it is appropriate for the current Svelte version.

Prefer derived state over duplicated mutable state.

Avoid custom global state infrastructure until ordinary Svelte state becomes insufficient.

Do not introduce React-style patterns merely out of habit.

---

## 13. TypeScript rules

Use strict typing.

Avoid:

```ts
any;
```

unless interacting with an unavoidable external boundary and the use is locally justified.

Prefer discriminated unions for semantic states.

Example:

```ts
type HarmonicRole =
	| 'root'
	| 'structural'
	| 'stable'
	| 'extension'
	| 'color'
	| 'tension'
	| 'alteration'
	| 'chromatic-approach'
	| 'avoid';
```

Use exhaustive checks where practical.

---

## 14. Testing requirements

Music-theory code requires unit tests.

Any change to:

- pitch arithmetic
- interval mapping
- chord formulas
- fretboard generation
- harmonic role classification
- voice leading

must add or update tests.

Visual changes do not require exhaustive snapshot testing.

Prefer behavior assertions over brittle DOM snapshots.

---

## 15. Theory test invariants

Preserve these invariants:

### Transposition invariance

A chord formula must preserve its interval structure under every root.

### Fretboard invariance

Equivalent pitch classes separated by 12 frets must produce equivalent harmonic analyses.

### Tuning correctness

The default open strings are:

```text
E A D G
```

### Root identity

Every occurrence of the selected pitch class has interval `1`.

### Chord-tone identity

Chord tones always remain chord tones regardless of fret/string location.

---

## 16. Musical correctness over implementation convenience

Do not simplify theory merely because a lookup table is easier to write.

If a concept is genuinely context-dependent, model that context.

If an implementation is uncertain musically, leave a focused TODO and avoid presenting speculation as authoritative behavior.

Useful TODO format:

```ts
// TODO(theory): Review treatment of 11 over maj7 across jazz vs modal contexts.
```

Avoid vague TODOs.

---

## 17. Accessibility requirements

Every interactive fret must be reachable and interpretable without a mouse.

Use meaningful accessible labels.

Example:

```text
A string, fret 3, C, interval 1, root
```

Do not encode harmonic role only through color.

Preserve visible focus states.

Respect reduced-motion preferences.

---

## 18. Responsive behavior

The fretboard is information-dense.

Do not destroy its geometry merely to fit narrow screens.

Acceptable strategies include:

- horizontal scrolling
- reduced fret count in viewport
- zoom controls
- compact labels

Do not stack individual frets vertically or otherwise destroy the spatial relationship of the neck.

---

## 19. Performance

The application is small enough that clarity matters more than premature optimization.

Still:

- derive the full fretboard once per relevant state change;
- avoid redundant note calculations inside every component render;
- use stable typed data structures;
- avoid heavy dependencies for trivial functions.

A four-string × twenty-four-fret grid should update essentially instantly.

---

## 20. Dependency policy

Before adding a package, ask:

1. Does native TypeScript/Svelte already solve this clearly?
2. Is the dependency actively maintained?
3. Does it materially reduce complexity?
4. Is its bundle/runtime cost justified?

Do not add a music-theory library solely to avoid implementing simple mod-12 pitch arithmetic.

The core theory model is central intellectual property of FretField and should remain understandable inside the repository.

---

## 21. UI copy

Prefer concise musical language.

Good:

```text
Structural
Stable
Color
Tension
Chromatic approach
```

Avoid pseudo-scientific claims such as:

```text
This note has 73% harmonic stability.
```

Internal numeric scores are modeling tools, not objective laws of music.

---

## 22. No “wrong note” framing

Avoid marking every non-chord tone as incorrect.

The product philosophy is functional:

```text
Where can this note go?
What effect does it create?
How does it relate to the harmony?
```

If a note is usually problematic in a specific context, label it carefully as context-dependent tension/avoid rather than universally wrong.

---

## 23. Commit discipline

Prefer small coherent commits.

Examples:

```text
feat: add pitch-class interval engine
feat: render interactive four-string fretboard
feat: add dominant seventh harmonic roles
fix: preserve selected root marker across chord changes
test: cover transposition invariance for chord formulas
```

Do not mix large formatting refactors with theory changes.

---

## 24. Definition of done for a feature

A feature is complete when:

- behavior matches `BLUEPRINT.md`;
- relevant roadmap item is satisfied;
- TypeScript passes;
- lint passes;
- tests pass;
- keyboard behavior is reasonable;
- no musical logic is duplicated in components;
- user-facing terminology is musically defensible;
- no obvious mobile regression is introduced.

---

## 25. Priority order

When tradeoffs arise, optimize in this order:

1. musical correctness
2. clarity of mental model
3. interaction quality
4. accessibility
5. maintainability
6. visual polish
7. number of features

Never sacrifice the first three merely to ship a broader feature list.

---

## 26. Features agents must not add opportunistically

Unless explicitly requested or scheduled in the roadmap, do not add:

- authentication
- cloud persistence
- social features
- user profiles
- guitar mode
- AI-generated bass lines
- notation editor
- tablature editor
- DAW features
- analytics SDKs
- advertising code

Within Live Input specifically, also do not add: polyphonic pitch detection, chord recognition from audio, MIDI input, recording, audio playback, a metronome, ML-based pitch models, or automatic progression advancement. Live Input stays a thin layer over Chord Field (and Scale Practice's own played-note highlighting); it is not the place to build a second product. (Scale Practice's own rhythm engine — the Groove Engine, a synthesized multi-voice drum machine, not a plain click — is a deliberately separate, single-purpose feature living entirely inside Scale Practice's own store; see below. Not an exception to this rule.)

Scale Practice's rhythm engine is the Groove Engine (`$lib/groove/` — types/pattern/migrate/presets/transport/feel/intensity/time-signature, see §4 — driving `$lib/audio/drum-voices.ts`, all called from `scale-practice.svelte.ts`): a six-voice synthesized kit (kick/snare/closed-hat/open-hat/ride/rim), patterns (16 steps in the default 4/4 meter; other supported meters resize the pattern — see `$lib/groove/time-signature.ts`) with four-state expressive velocity (off/ghost/normal/accent — click cycles, Shift-click jumps to accent, Alt/Option-click clears), a Feel (Straight/Shuffle/Swing) + Amount control (inert for compound meters — their own 3-against-2 subdivision already carries a shuffle-like feel), a global Intensity control gating any step's optional `minIntensity`, a count-in (Off/1 bar/2 bars), a Time Signature control (3/4, 4/4, 5/4, 6/8, 9/8, 12/8 — one meter for the whole groove, not per-bar/mixed-meter), and curated genre presets including a flagship multi-bar 12-bar blues groove ("Chicago Shuffle"). A groove holds exactly four pattern roles — `A`/`B`/`F`/`T` (main/variation/fill/turnaround) — mapped bar-by-bar via an `arrangement: PatternRole[]`; within Scale Practice specifically, do not add: sample-based drum sounds (every voice stays synthesized — no asset-loading pipeline), arbitrary/custom-named pattern roles or a "Duplicate Pattern" affordance beyond the fixed four, a Pause control distinct from Stop (Stop always resets to bar 1), automatic tempo ramps (BPM is adjusted by hand), deterministic timing/velocity humanization, a mute toggle, persistent session stats, per-beat pitch/timing grading (no target/evaluation concept — Scale Practice doesn't judge correctness or timing), or mixed/per-bar meters (one time signature governs the whole groove). Don't move its scheduling into `live-input.svelte.ts` — the transport stays in `$lib/groove/transport.ts`, driven from `scale-practice.svelte.ts` (§4). Don't gate `scalePositions`/`playedPositions` on `running` — the drum machine and the highlighting are deliberately independent.

That same transport can optionally layer an audible chord-progression backing underneath the beat (`$lib/audio/chord-voices.ts`'s synthesized pad, off by default, picked via `ProgressionSelector` in `PracticeSessionBar.svelte` — see §4). Within that addition specifically, do not add: an independent tonic for the progression (it always derives from `scalePractice.root`), per-chord duration overrides (one `barsPerChord` applies to every chord), independent drum/chord volume mixing, voice-leading between consecutive chords (every chord is the same simple closed voicing, root position, tones ascending), or a way to build/save a custom progression (that feature was removed — only the curated template list remains).

That same Groove Engine also carries an optional Acid Bass Engine (`$lib/acid-bass/` — types/pattern/resolve/migrate/sequencer/factory-patches/transforms/acid24-ladder/pulse-oscillator, see §4 — driving `$lib/audio/acid-bass-voice.ts`/`acid-bass-lfo.ts`/`acid-worklet-node.ts`, all called from `scale-practice.svelte.ts`): a monophonic, 303-inspired synth bass voice, off by default, toggled via "Bass On/Off" in `PracticeSessionBar.svelte`. Following a separately-supplied V2 spec (`~/Downloads/ACID-BASS-ENGINE-V2.md`) and a later Osc 2/dual-LFO follow-up, its once-flat six-macro patch grew into a nested `oscillator`/`filter`/`envelope`/`glide`/`lfo1`/`lfo2`/`output` shape exposed across `BandPanel.svelte`'s Bass tab as six nested VCO/VCF/ENV/LFO 1/LFO 2/OUTPUT panels laid out as a compact responsive grid, every control always visible (no disclosure — see §4's `AcidBassControls.svelte`-adjacent hardware-component entry), plus an 8-preset factory-patch picker (`factory-patches.ts`) and pattern-wide transform buttons (Rotate L/R, Simplify, Densify, Octave shift, Clear All Locks — `transforms.ts`, deliberately basic/not chord-or-scale-aware) inside `GrooveEditor.svelte`'s "Bass Steps" sub-tab, alongside its step grid + selected-step editor (now also Probability/Ratchet/Gate/a parameter-lock disclosure, not just Active/Interval/Octave/Accent/Slide) — a "Drum Steps | Bass Steps" toggle switches which pattern the grid edits, both reading the _same_ `selectedPatternRole`, since Acid Bass shares the drum engine's `A`/`B`/`F`/`T` arrangement rather than an independent one. Its interval storage reuses the app's existing `IntervalId` (`$lib/music/intervals.ts`), not a bespoke numeric type — one canonical interval representation everywhere, per §3.1. A step's `slide` glides to the immediately following step, or — if `crossBarSlide` is on (default for new patches, off for anything migrated from V1) — the next bar's first active step; `ratchet > 1` silently drops that step's own outgoing slide (undefined which of several hits would glide) and disables the Slide checkbox in the UI. The `acid24` filter model and the Pulse oscillator's live PWM both run on dedicated `AudioWorkletNode`s (`static/acid-filter-processor.js`/`static/acid-pulse-oscillator-processor.js`) that silently fall back to a Biquad/`PeriodicWave` approximation if the worklet never loads — never a user-facing error. Within Acid Bass specifically, do not add: DAW features (no piano-roll, no automation lanes, no MIDI export), a hardware-clone 303 UI (no fake knobs/faceplate skeuomorphism — controls stay this app's existing slider/select language, now including real rotary `Knob`s), AI-generated bass lines (already covered app-wide above, restated because it's the single most likely opportunistic addition here), a second `AudioContext` or a second scheduler (schedules off the exact same `GrooveTransport`/swung `stepOffsetMs` timing the drums already use — see `scale-practice.svelte.ts` above), an independent bass arrangement or pattern-role set (always the drum engine's own `A`/`B`/`F`/`T`, via the same `selectedPatternRole`), an independent bass tempo/swing/meter, polyphony, a many-to-many modulation matrix (still just two LFOs, each single-destination), an effects rack, chord/scale-aware pattern transforms (the transforms above are deliberately basic — see `transforms.ts`'s own doc comment), an Intensity/velocity-gating concept of its own (Acid Bass has no `minIntensity` equivalent — every active step always sounds, modulo its own `probability` roll), sample-based tone generation (stays synthesized oscillators + filters, no asset-loading pipeline), or persistence/config separate from the rest of the Groove Engine (it lives inside `Groove.acidBass`, migrates and saves/loads with the rest of a groove, including "My Grooves" — never a parallel storage key).

Each chord in the backing can be assigned its own scale (`BandPanel.svelte`'s Harmony tab, per-chord-row `<select>` shown only for the active chord, reusing `suggestedScalesFor`/`listScales`), and the fretboard shows whichever chord is active — clicking a chord row previews it even while stopped, and playback advances it automatically (see §4's `scale-practice.svelte.ts` entry for the full mechanics). This must not grow into: Harmonic Field-style role analysis or coloring (stays a plain scale-note highlight — that stays Chord Field's job), persistence of chord-scale choices or the active/preview index (session-only), or a "common notes across chords" callout.

Maintain product focus.

---

## 27. Long-term architectural direction

Built so far, in `src/lib/music/`:

```text
pitch.ts intervals.ts tuning.ts fretboard.ts chords.ts harmony.ts
progressions.ts absolute-pitch.ts live-position.ts scales.ts
```

And in `src/lib/audio/` (Live Input's acoustic-pitch domain, plus the Groove Engine's drum/chord-pad/Acid-Bass synthesis — see §4):

```text
types.ts pitch-detector.ts pitch-tracker.ts note-mapping.ts
audio-input.ts fake-audio-source.ts drum-voices.ts chord-voices.ts
acid-bass-voice.ts acid-bass-lfo.ts acid-worklet-node.ts
```

And in `src/lib/groove/` (the Groove Engine's domain model — see §4):

```text
types.ts pattern.ts migrate.ts presets.ts transport.ts feel.ts intensity.ts time-signature.ts pattern-role.ts
```

And in `src/lib/acid-bass/` (the Acid Bass Engine's domain model — see §4):

```text
types.ts pattern.ts resolve.ts migrate.ts sequencer.ts
factory-patches.ts transforms.ts acid24-ladder.ts pulse-oscillator.ts
```

And in `static/` (served verbatim by `adapter-static`, never run through Vite's bundler — see §4's `acid-worklet-node.ts` entry):

```text
acid-filter-processor.js acid-pulse-oscillator-processor.js
```

And in `src/lib/scale-practice/` (Scale Practice's decision layer — see §4):

```text
types.ts positions.ts
```

Future modules may include:

```text
music/approaches.ts
audio/playback.ts
```

(`audio/playback.ts` above would be audio _output_ — playing selected notes/chords on demand from Explore — a distinct, still-unbuilt feature from both Live Input's audio _input_/detection and Scale Practice's own audio output (`drum-voices.ts`, rhythm-only, and `chord-voices.ts`, a scheduled backing pad rather than an on-demand player).)

These must build on the existing pure music engine rather than replacing it with UI-specific logic. `progressions.ts` (declarative `ProgressionTemplate`s) is Scale Practice's chord-backing layer now, not a resolution/voice-leading engine — that machinery (`connection-score.ts`, `voice-leading.ts`, `voice-leading-paths.ts`, `local-fields.ts`) was removed along with Progression Field/Voice-Leading Paths/Local Fields. Don't rebuild resolution scoring or path-ranking inside `progressions.ts` or `scale-practice.svelte.ts` — if a future feature genuinely needs that kind of engine again, it's a new module, not a revival of the deleted ones (check git history for the last shape they had, if useful as a reference).

---

## 28. Final agent check

Before finishing any substantial task, ask internally:

- Does this help the bassist understand function rather than memorize shapes blindly?
- Does the interval geometry remain visible?
- Is harmonic context treated correctly?
- Is the UI simpler or more confusing after this change?
- Did theory remain independent from rendering?
- Are new assumptions covered by tests?

If the answer to any critical question is no, fix that before declaring the task complete.
