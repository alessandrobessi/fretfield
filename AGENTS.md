# AGENTS.md — FretField

This file defines the operating rules for coding agents working on FretField.

Read `BLUEPRINT.md` and `ROADMAP.md` before making architectural or product changes.

---

## 1. Mission

FretField is an interactive bass-fretboard application that visualizes harmonic function relative to a selected root and chord.

Its central idea is:

> The fretboard is a harmonic field, not merely a grid of note names.

Every implementation decision should reinforce that idea. Concretely, the product answers six increasingly powerful questions, each a `FieldMode`:

```text
Chord Field           "What can I play now?"
Progression Field      "Where can I go next?"
Voice-Leading Paths    "What route should I take?"
Local Fields           "Where on the neck should I play it?"
Scale Blocks           "What scales fit across this progression?" — nested inside Progression -> Scales as "Custom Scale Map", not a tab of its own
Scale Practice          "Can you play this scale in time?"
```

(This table predates the app's 1.0 navigation restructure into Explore/Practice/Progress destinations — see `ROADMAP.md`'s current-status note — and is kept here only to describe the six underlying `FieldMode` questions, not the current top-level tab layout.)

Local Fields is a spatial lens usable from any of the other three single-chord modes (region state lives in the store independent of `mode`), not an isolated feature. Root selection, display mode, and progression selection persist across mode switches — switching tabs changes the lens, not the underlying selection.

Scale Blocks and Scale Practice are the two modes that don't fit that "shared root/chordId" model. Scale Blocks holds its own independent `chordBlocks` list (up to `MAX_CHORD_BLOCKS`, currently 8, each with its own root/chord/scale) and shows all their scales on the fretboard simultaneously, not one chord's role field at a time — reached today as "Custom Scale Map", an advanced escape hatch nested inside Explore → Progression → Scales (`ProgressionScales.svelte`'s "Open Custom Scale Map" button, rendered via `CustomScaleMap.svelte`), not its own primary tab; the auto-suggested per-chord `progressionScaleBlocks` view is the default experience there instead. Scale Practice holds its own independent root/scale/fret-zone/tempo session (`scale-practice.svelte.ts`, not `fretfield.svelte.ts`): every note of the scale is highlighted at once, whatever's played is highlighted live, and a synthesized drum machine (Play/Stop), with an optional chord-progression backing, plays independently of both — timing that Guided Practice deliberately excludes (§26). Both are genuine `FieldMode`s like the other four, not layers (contrast with Live Input/Guided Practice below, which explicitly are layers).

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
- progression templates
- resolution rules
- voice-leading calculations
- spatial/regional (Local Field) analysis
- scale definitions and chord-family-aware scale suggestions (`scales.ts`)

Must not import:

- Svelte
- browser APIs
- DOM utilities
- CSS
- route modules

### `src/lib/audio/`

Pure TypeScript, acoustic-pitch domain only (Live Input's DSP layer). Responsibilities: Web Audio capture, YIN pitch detection, temporal stabilization, frequency/MIDI/pitch-class conversion. Its only output type, `DetectedNote`, is neutral — frequency, MIDI, pitch class, octave, cents, confidence.

Must not know about, or import: chords, keys, `HarmonicRole`, progressions, Voice-Leading Paths, Local Fields, or anything else from `src/lib/music/` beyond the bare `PitchClass` type. Harmonic meaning is layered on afterward by `src/lib/stores/live-input.svelte.ts` combined with the main store's already-computed analysis — never a second, parallel harmonic engine living in this domain.

Must not depend on a real microphone for tests — real capture (`audio-input.ts`) and the deterministic test double (`fake-audio-source.ts`) both implement the same `LiveAudioSource` interface, so DSP logic is tested with synthetic buffers and integration is tested with the fake source.

`drum-voices.ts`/`groove.ts`/`groove-presets.ts`/`chord-voices.ts` are this directory's one exception to "acoustic-pitch domain only": they're audio _output_ (Scale Practice's drum machine and its optional chord-progression backing), not analysis. They still must not import anything theory-related — no scales, no chord/key concepts, only step timing, synthesized percussion, and (for `chord-voices.ts`) plain Hz frequencies and durations. `chord-voices.ts`'s `triggerChordPad(ctx, time, frequenciesHz, durationSeconds, gain?)` takes frequencies, never a chord/root/interval — `scale-practice.svelte.ts` resolves theory (via `$lib/music/chords`'s `required` intervals and `$lib/music/intervals`'s `intervalSemitones`) before calling in, same boundary `drum-voices.ts` already keeps. `drum-voices.ts`/`chord-voices.ts` share `scale-practice.svelte.ts`'s one `AudioContext`, entirely separate from the capture context `audio-input.ts` owns — the two must never be merged into one context.

### `src/lib/practice/`

Pure TypeScript, Guided Practice's decision layer. Responsibilities: deciding what exercise is active (`exercise-generators.ts`), whether a played note satisfies it (`evaluation.ts`), and the session state machine (`practice-engine.ts`). Sits _above_ `src/lib/music/` and `src/lib/audio/` (it may import both — that boundary is the other direction, see above) but has no dependency on any Svelte store; a `PracticeContext` is plain data (root, chord, progression, selected path, active region) assembled by the caller, so generators/evaluation stay pure and directly testable.

Must not duplicate harmonic logic: a Resolve Note target's role/interval comes from calling `analyzeConnection`/`connectionFor` (the same functions Progression Field uses), never a parallel scoring table. Find Chord Tone/Find Interval's "valid alternative" ranking reuses `roleStability`. If a new exercise needs a "how good is this note" judgment the existing engine doesn't already expose, extend `$lib/music`, not `$lib/practice`.

Must not depend on a real microphone for tests, same reasoning as `src/lib/audio/` — exercise generation and evaluation are tested with synthetic `DetectedNote` objects; only the Playwright layer touches the injected `FakeAudioSource`.

This module's own doctrine — self-paced, no timers, no tempo — is deliberate (§26). Do not add timing concepts here to support Scale Practice; that lives in `src/lib/scale-practice/` instead.

### `src/lib/scale-practice/`

Pure TypeScript, Scale Practice's fretboard-position layer (`positions.ts`): `scalePositions(root, scale, zone, tuning, fretCount)` — every position in the zone belonging to the scale, the whole scale shown at once — and `positionsForPitchClass`, reused by the store for the live "what's currently played" lookup. No dependency on any Svelte store, same reasoning as `src/lib/practice/` — pure functions, directly testable. Deliberately has no evaluation/grading logic at all — Scale Practice doesn't judge correctness or timing (see §26); it only reports which positions match a pitch class.

Must not duplicate scale theory: pitch classes come from `scalePitchClasses` in `$lib/music/scales.ts`, never a re-derivation. Must not know about `AudioContext`/wall-clock scheduling — that lives in the store (`scale-practice.svelte.ts`), the one place `$lib/audio/drum-voices.ts`'s and `$lib/audio/chord-voices.ts`'s voice triggers get called.

### `src/lib/components/`

Rendering and interaction only.

Components consume analyzed music data.

### `src/lib/stores/`

Application state only.

Do not duplicate derived harmonic logic here.

`live-input.svelte.ts` is a deliberately separate store from `fretfield.svelte.ts`: it owns the Web Audio lifecycle (`AudioContext`, `MediaStream`, `AnalyserNode`, device selection). Those must never leak into the main music-theory store — it only ever consumes plain `DetectedNote`/`FretPosition` state from `live-input.svelte.ts`, the same way a component consumes analyzed music data.

`practice.svelte.ts` is a third, separate store sitting above both: it's the only place that reads `fretfield` and `liveInput` together to build a `PracticeContext` and drive `$lib/practice`'s pure engine. It owns no harmonic or audio logic itself. `fretfield.svelte.ts` must never import `practice.svelte.ts` — that would be circular (practice already depends on fretfield); any fretboard visual layer Guided Practice needs is composed at the component level (`FretCell.svelte` reads both `fretfield` and `practice` directly) instead of being threaded through `DisplayFretPosition`. Svelte 5 reactivity note learned the hard way while building this: `$state` reads are tracked by call stack, not lexical scope, so a plain method call from inside `$effect` (e.g. `practice.handleDetectedNote(note)`) can silently capture deeply-nested store reads/writes as dependencies and self-retrigger; wrap such calls in `untrack(...)`, and never rely on `||`/`&&` short-circuiting to make multiple fields "tracked" — read each one into its own `const` first.

`scale-practice.svelte.ts` follows the same independent-store shape as `practice.svelte.ts` (never imported by `fretfield.svelte.ts`, its own layers composed directly in `FretCell.svelte`) but owns none of `practice.svelte.ts`'s state — it's a sibling, not an extension. Unlike `practice.svelte.ts`, it reads `liveInput.detectedNote` directly inside a `$derived` (`playedPositions`) rather than through an onset-gated effect — there's no "one attempt per note" bookkeeping to do here, just "what's sounding right now," so a live, continuously-updating derived is the right shape, not an event. It's also the one store allowed to touch `$lib/audio/drum-voices.ts`/`$lib/audio/chord-voices.ts` and run a Web Audio lookahead scheduler; no other store should grow timer-based logic. That scheduler drives the drum machine and its optional chord-progression backing only — it must never gain a target/evaluation concept again (§26); `playedPositions` is computed independently of `running` on purpose, and touching that decoupling needs a product conversation first, not just a refactor. `activeChordIndex` is always a valid index (default `0`, never `null`) that doubles as both playback position and click-to-preview selection, mirroring `fretfield.svelte.ts`'s own `activeChordIndex` for Explore's Progression lens — `setActiveChordIndex` wraps the same way; picking a progression or clicking a chord row works whether or not the drum machine is running, and stopping playback freezes it rather than clearing it.

The optional chord backing (`progressionTemplateId`/`barsPerChord`, off by default) is this store's one deliberate exception to Scale Practice having no chord concept in its harmonic model: it reuses `resolveProgressionTemplate`/`buildProgression` (`$lib/stores/saved-progressions.svelte.ts`/`$lib/music/progressions.ts`, the same resolver `fretfield.svelte.ts` uses for Explore's Progression lens) built on `scalePractice.root` — never an independent tonic — and voices each chord's `getChordDefinition(chordId).required` intervals via `intervalSemitones` before handing plain frequencies to `triggerChordPad`.

By further explicit product request, this now also drives the fretboard: `progressionChordScaleOverrides` (session-only, same "advanced escape hatch" precedent as `fretfield.svelte.ts`'s `progressionScaleOverrides`) plus `progressionChordScales` (each chord's assigned scale, defaulting to `suggestedScalesFor(chord.chordId)[0]` unless overridden — the exact formula `progressionScaleBlocks` already uses) combine into `activeChordScale`: the root+scale of whichever chord `activeChordIndex` points at. `scalePositions` prefers `activeChordScale` over the manually-picked root/scale whenever one is active, and `displayRoot` (`activeChordScale?.root ?? root`) is what `FretCell.svelte` keys its Scale-Practice root-marker/interval labels against — so both the highlighted notes _and_ their labels re-root to whichever chord is currently active, not the original practice tonic. **This supersedes this file's former "audio only, must never grow into fretboard chord-tone highlighting" line** — a direct, explicit product request, not a silent scope drift. It still stops well short of Chord Field's job: this is a plain scale-note highlight reusing the same `scalePositions()` pure function Scale Practice always used, never Harmonic Field's nine-role analysis, and `playedPositions` (Live Input's live "what's sounding" layer) is untouched.

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
FieldModeSwitcher
HarmonyControls
ChordSelector
AnalysisModeToggle
DisplayModeToggle
Legend
NoteInspector
ProgressionSelector
ProgressionStrip
ProgressionControls
PathSelector
PathsControls
LocalFieldControls
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

Within Live Input specifically, also do not add: polyphonic pitch detection, chord recognition from audio, MIDI input, recording, audio playback, a metronome, ML-based pitch models, or automatic progression advancement — see `BLUEPRINT.md` §18 for the full exclusion list and why. Live Input stays a thin layer over the existing single-chord modes; it is not the place to build a second product. (Scale Practice's own rhythm engine — a synthesized multi-voice drum machine, not a plain click — is a deliberately separate, single-purpose feature living entirely inside Scale Practice's own store; see below. Not an exception to this rule.)

Within Guided Practice specifically, also do not add: a metronome, backing tracks, automatic chord timing, rhythm/duration/tempo scoring, persistent progress, user accounts, achievements, an adaptive AI teacher, spaced repetition, or generated bass lines — see `BLUEPRINT.md` §19. Session stats live only in memory for the current session; do not add a backend to persist them.

Within Scale Blocks specifically, do not add: URL persistence for `chordBlocks` without discussing it first (deliberately session-only for v1, matching Guided Practice's precedent), or a block beyond `MAX_CHORD_BLOCKS`. Don't make `suggestedScalesFor` filter/restrict the scale dropdown — it orders it, it never removes an option. Each new block color (`--scale-block-1` through `--scale-block-8`) must stay defined everywhere a block chip/badge renders (`FretCell.svelte`, `ScaleBlockControls.svelte`, `ScaleBlockLegend.svelte`, `NoteInspector.svelte`) — the digit is the primary signal (§7), but the color still needs to exist.

Scale Practice's rhythm engine is a synthesized multi-voice drum machine (`$lib/audio/drum-voices.ts`/`groove.ts`/`groove-presets.ts`, driven by `scale-practice.svelte.ts`'s lookahead scheduler) — kick/snare/closed-hat/open-hat voices, a 16-step pattern with swing, and curated genre presets, by explicit product direction superseding this doctrine's former "quarter-note clicks only, no subdivisions/swing/accents" line. Within Scale Practice specifically, still do not add: sample-based drum sounds (every voice stays synthesized — no asset-loading pipeline), per-step velocity/accent editing (genre character comes from step placement and swing, not a velocity grid — v1 steps are boolean on/off), automatic tempo ramps (BPM is adjusted by hand), a mute toggle, persistent session stats, per-beat pitch/timing grading (removed by explicit product direction — see `BLUEPRINT.md` §21's revision note — don't reintroduce a target/evaluation concept), or Live Input/Guided Practice driving this mode the way they drive the four single-chord modes. Don't move its scheduler into `live-input.svelte.ts` or `practice.svelte.ts` — it stays in its own store (§4). Don't gate `scalePositions`/`playedPositions` on `running` — the drum machine and the highlighting are deliberately independent.

That same scheduler can optionally layer an audible chord-progression backing underneath the beat (`$lib/audio/chord-voices.ts`'s synthesized pad, off by default, picked via a reused `ProgressionSelector`/`CustomProgressionBuilder` in `DrumMachineControls.svelte` — see §4), by further explicit product direction. Within that addition specifically, still do not add: an independent tonic for the progression (it always derives from `scalePractice.root`), per-chord duration overrides (one `barsPerChord` applies to every chord), independent drum/chord volume mixing, or voice-leading between consecutive chords (every chord is the same simple closed voicing, root position, tones ascending).

By still-further explicit product direction, each chord in the backing can now be assigned its own scale (`DrumMachineControls.svelte`'s per-chord-row `<select>`, reusing `suggestedScalesFor`/`listScales` exactly like `ProgressionScales.svelte` does for Explore), and the fretboard shows whichever chord is active — clicking a chord row previews it even while stopped, and playback advances it automatically (see §4's `scale-practice.svelte.ts` entry for the full mechanics). This is the one place Scale Practice's "audio only, no fretboard chord-tone highlighting" boundary has been deliberately superseded; it must still not grow into: Harmonic Field-style role analysis or coloring (stays a plain scale-note highlight), persistence of chord-scale choices or the active/preview index (session-only, matching `fretfield.svelte.ts`'s own `progressionScaleOverrides`), or a "common notes across chords" callout (Explore's `ProgressionScales.svelte` has one; Scale Practice deliberately doesn't, to keep this reuse lightweight rather than re-implementing that lens wholesale).

Maintain product focus.

---

## 27. Long-term architectural direction

Built so far, in `src/lib/music/`:

```text
pitch.ts intervals.ts tuning.ts fretboard.ts chords.ts harmony.ts
local-fields.ts progressions.ts connection-score.ts voice-leading.ts
voice-leading-paths.ts absolute-pitch.ts live-position.ts scales.ts
```

And in `src/lib/audio/` (Live Input's acoustic-pitch domain, plus Scale Practice's drum machine and chord backing — see §4):

```text
types.ts pitch-detector.ts pitch-tracker.ts note-mapping.ts
audio-input.ts fake-audio-source.ts drum-voices.ts groove.ts groove-presets.ts
chord-voices.ts
```

And in `src/lib/practice/` (Guided Practice's decision layer — see §4):

```text
types.ts evaluation.ts exercise-generators.ts practice-engine.ts presets.ts
```

And in `src/lib/scale-practice/` (Scale Practice's decision layer — see §4):

```text
types.ts positions.ts
```

Future modules may include:

```text
music/approaches.ts
practice/walking-bass.ts
audio/playback.ts
```

(`practice/walking-bass.ts` above would back a future Walking Bass practice mode — target root arrivals with chromatic-approach hints, per ROADMAP.md's Phase 10; Find Interval/Find Chord Tone's original "Interval Trainer"/"Chord-Tone Trainer" framing is already covered by `practice/exercise-generators.ts`.)

(`audio/playback.ts` above is audio _output_ — playing selected notes/chords on demand from Explore, per ROADMAP.md's Phase 11 — a distinct, still-unbuilt feature from both Live Input's audio _input_/detection and Scale Practice's own audio output (`drum-voices.ts`, rhythm-only, and `chord-voices.ts`, a scheduled backing pad rather than an on-demand player).)

These must build on the existing pure music engine rather than replacing it with UI-specific logic. In particular, `progressions.ts` (declarative `ProgressionTemplate`s), `connection-score.ts` (pitch-class-level resolution scoring), and `voice-leading-paths.ts` (the exact-DP path search over `FretPosition`s) are three separate layers — new work should extend the layer that actually owns the concept rather than reaching across them.

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
