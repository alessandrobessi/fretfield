# FretField — Development Roadmap

> **Mission:** Build an interactive bass fretboard that teaches harmonic navigation through interval geometry, stability, tension, color, and resolution.

## Guiding rule

Ship the smallest version that already demonstrates the central idea:

```text
click root → choose harmony → see harmonic function across the neck
```

Avoid adding infrastructure before the music model and interaction feel excellent.

---

## Current status

**The app was stripped down to two features by explicit, direct product request — Chord Field and Scale Practice only. This supersedes everything else described below.** Phases 0–5 (repository foundation through the Note inspector) are Chord Field's own history and remain fully accurate. Phases 8, 9, 9.5–9.8 describe Progression Field, Voice-Leading Paths, Live Input (originally scoped over six modes), Guided Practice, Scale Blocks, and Scale Practice all being built — all still historically accurate as a build log — but Progression Field, Voice-Leading Paths, Local Fields, Scale Blocks, Scale Explorer, Guided Practice (all four exercise modes), the Presets feature, the Progress tab, and the Saved Material Library (Favorite Chords, Scale Maps, custom Progressions — "My Presets" included) were subsequently **deleted from the codebase entirely**, not hidden. "My Grooves" (saved custom drum grooves, `saved-grooves.svelte.ts`) is a distinct, unrelated feature living inside Scale Practice's own Groove Engine (see below) — it was never part of the Saved Material Library and was not deleted; a prior revision of this doc conflated the two. See `AGENTS.md` §1/§27 and `BLUEPRINT.md` §0 for the current two-feature architecture; see `BLUEPRINT.md` §16/§17/§19/§20 for what those removed features were and why they're marked **REMOVED** rather than deleted from the doc.

Live Input (Phase 9.5) survives, trimmed to a layer over just Chord Field and Scale Practice's own played-note highlighting — its Voice-Leading-Path-step and Local-Field-region disambiguation tiers were removed along with those modes. Scale Practice (Phase 9.8) survives and kept evolving after this removal: its drum machine, chord-progression backing, and per-chord scale highlighting (see below) are all still live, current functionality.

Phase 6 (Chord builder) and Phase 7 (shareable-state polish) remain open for Chord Field specifically. Phase 10 onward (Ear Training/Groove Navigation/Walking Bass practice modes, audio playback beyond Scale Practice's drum machine, alternate tunings, educational integration) assumed a much larger surviving product and should be re-evaluated against the current two-feature scope before resuming any of it, not resumed by default.

**Drum Machine for Scale Practice — done, and still current.** Scale Practice's single quarter-note click was replaced with a synthesized multi-voice drum machine, scheduled by a sample-accurate Web Audio lookahead scheduler, with an optional chord-progression backing (curated templates only — the custom-progression builder was part of the Saved Material Library that was later removed) and per-chord scale highlighting on the fretboard. See `AGENTS.md` §26/§27 for the full current mechanics and doctrine.

**Groove Engine — done, and still current (2026-08).** Following a separately-supplied "Groove Engine Roadmap" (Phases 1–11 of its own MVP scope; preset-library expansion, humanization, and a sample-based renderer were explicitly deferred), the single-pattern drum machine above grew into a small multi-bar sequencer living in `$lib/groove/`: a `Groove` now holds four named pattern roles (`A`/`B`/`F`/`T` — main/variation/fill/turnaround) mapped bar-by-bar via an arrangement, driven by one authoritative `GrooveTransport` clock shared with the chord-pad backing (and, since, the Acid Bass Engine below). The kit grew from four voices to six (added ride/rim); steps carry four-state expressive velocity (off/ghost/normal/accent) instead of a plain boolean; a Feel (Straight/Shuffle/Swing) + Amount control replaced the old bare swing percentage; a global Intensity control gates any step's optional minimum-intensity threshold; a count-in (Off/1 bar/2 bars) precedes playback; and a flagship 12-bar blues preset ("Chicago Shuffle") demonstrates the full model against the pre-existing 12-Bar Dominant Blues progression template. `DrumMachineControls.svelte` now splits into an always-visible compact row and an "Edit Groove" disclosure for the heavier authoring surface, per the roadmap's own compact-UI guardrail (later superseded by name, not by shape, in the 2026 Practice UI redesign below — the same compact-row/disclosure split lives on as `PracticeSessionBar.svelte`/`GrooveEditor.svelte`). See `AGENTS.md` §4/§26/§27 and `BLUEPRINT.md` §21 for the full current mechanics and doctrine.

**Acid Bass Engine — done, and current (2026-08).** Following a separately-supplied "Acid Bass Engine" implementation spec (its own 7-phase build order: pure model, migration, audio voice, transport integration, UI, persistence, polish), the Groove Engine above gained a third accompaniment layer living in `$lib/acid-bass/`: a monophonic, 303-inspired synth bass voice nested inside `Groove.acidBass`, off by default, sharing the drum engine's persistence, migration, and `A`/`B`/`F`/`T` arrangement roles rather than an independent bass arrangement. Its own patch (Wave — Saw/Square, Tone, Resonance, Motion, Decay, Drive, all `0`–`100` macros) drives a persistent monophonic node graph (`$lib/audio/acid-bass-voice.ts`) — unlike the drum kit's/chord pad's fire-and-forget per-hit voices, this one has to stay alive across notes for slide/legato to glide a running oscillator's pitch rather than crossfade between discrete events. Interval storage reuses the app's existing `IntervalId` rather than a bespoke numeric type. UI lands across all three of Scale Practice's existing progressive-disclosure tiers: Bass on/off in `PracticeSessionBar.svelte` (PLAY), patch macros on `BandPanel.svelte`'s new Bass tab (ADJUST), and a step grid + selected-step editor behind `GrooveEditor.svelte`'s new "Bass Steps" sub-tab (EDIT). Resolving the `PatternRole`/`Groove`↔`AcidBassState` dependency cycle needed extracting `PatternRole` into its own leaf module, `$lib/groove/pattern-role.ts` — the same precedent `TimeSignature`/`time-signature.ts` already set. Building and verifying this surfaced one genuine, unrelated pre-existing bug in the Groove Engine itself (not part of the Acid Bass spec's scope): changing Time Signature mid-playback could throw and silently stall the transport, because a store-level per-bar cache (`currentBarPattern`/`currentBarAcidPattern`) wasn't kept in sync with a mid-bar meter resize on top of the transport's own step-counter fix — both `GrooveTransport.setStepsPerBar()` and `ScalePracticeStore.setTimeSignature()`'s immediate cache-refresh were needed together; see `AGENTS.md` §4's `scale-practice.svelte.ts`/`transport.ts` entries for the mechanics. See `AGENTS.md` §4/§26/§27 and `BLUEPRINT.md` §21 for the full current mechanics and doctrine.

**Acid Bass Engine V2 — done, and current (2026-08).** Following a separately-supplied "Acid Bass Engine V2" spec (its own 12-milestone build order: data model, migration, VCO, VCF/VCA, sequencer powers, cross-bar slide, modulation, UI, factory patches, the acid24 AudioWorklet, Pulse/PWM refinement, polish), the V1 engine above was rebuilt in place rather than superseded by a parallel implementation — no type ever grew a "V2" suffix, the same way V1 never had a "V1" one; `version: 2` on `AcidBassState` is the runtime migration discriminant, not a naming convention. The flat six-macro patch became a nested `oscillator`/`filter`/`envelope`/`glide`/`lfo`/`output` shape matching the actual signal path: a sub oscillator and Triangle/Pulse waves joined Saw/Square; the filter gained key tracking, pre-filter saturation, and a third model (`acid24`, a genuine 4-stage tanh-saturated ladder filter, alongside the original Biquad-based `legacy`/`svf12`); attack/release/accent/glide-curve/volume all became patch-driven instead of hardcoded; steps gained software-only sequencer powers (`probability`, `ratchet` 1–4, per-step `gate`, up to five parameter `locks`); a slide on a pattern's last step can now glide across the bar boundary (`crossBarSlide`, off for anything migrated from V1 so a migrated groove never gains new articulation); one free-running, tempo-syncable LFO was added; eight factory patches and basic pattern-wide transforms (Rotate/Simplify/Densify/Octave shift/Clear Locks) were added; and the `acid24` filter plus the Pulse wave's width both ultimately run on dedicated `AudioWorkletNode`s (hand-authored, dependency-free plain JS under `static/`, loaded via a base-aware URL for `adapter-static`'s configurable `BASE_PATH`) that silently fall back to their pre-worklet approximation if a worklet never loads. Migration from a V1-shaped `acidBass` (no `version` field at all) uses named `v1*ToV2Value` inverse-mapping helpers, never inline magic numbers, so an existing groove's Acid Bass line sounds identical after upgrading rather than snapping to new defaults; a previously-latent bug in `groove/migrate.ts`'s `coerceGroove` fallthrough (a groove with _any_ `acidBass` field was trusted as already-current-shape, even a V1-shaped one) was fixed as part of this work. Two `AudioWorkletProcessor`s' DSP math (the ladder filter, the PolyBLEP-band-limited pulse oscillator) each has a pure, independently unit-tested TypeScript twin (`acid24-ladder.ts`/`pulse-oscillator.ts`) hand-kept in sync with the actual plain-JS processor files, since `AudioWorkletProcessor` can't run inside Vitest's jsdom environment. See `AGENTS.md` §4/§26/§27 and `BLUEPRINT.md` §21 for the full current mechanics and doctrine.

**Acid Bass: Osc 2 + a second LFO — done, and current (2026-08).** A direct follow-up request (no separate spec doc, unlike the two builds above): a second full oscillator (Osc 2, alongside Main and Sub — its own wave including Pulse, its own independent tune/fine/level, for detune/unison stacking) and a genuine second LFO (`lfo1`/`lfo2` replacing the singular `lfo` field, each still single-destination — a many-to-many modulation matrix was explicitly considered and declined as bigger than what was asked for). `AcidBassState.version` bumped `2` → `3` with a real migration step (`migrateV2Patch`/`State` in `migrate.ts`): an old V2 groove's singular `lfo` settings land on `lfo1` unchanged, `lfo2` and Osc 2 both default off/neutral so a migrated groove sounds identical. `mixCompensation` now budgets three oscillators' energy instead of two. The UI's single "MOD" panel split into "LFO 1"/"LFO 2" (`HardwarePanel` gained an `aria-label` so tests/AT can scope into a specific panel's same-named controls, e.g. two "Cutoff" destination buttons); the VCO panel gained an Osc 2 row-group. Along the way, fixed a latent bug where the LFO→Pulse-Width depth-scaling gain was never actually updated inside `setPatch()`'s reset loop, so that destination never worked even in the original V2 build. See `AGENTS.md` §4's `types.ts`/`acid-bass-voice.ts` entries for the full current mechanics.

**Visual Rebrand — done, and current (2026-08).** Following a separately-supplied visual-brand spec (`FRETFIELD-REBRAND.md`), the app moved from its original soft violet/lavender look to an industrial yellow/near-black/signal-red "musical machine" identity: a full `src/app.css` design-token rewrite, a near-black app shell (replacing the old glow-gradient light background), a new reusable hardware component set (`Led`/`HardwarePanel`/`HardwareButton`/`Knob`, in `$lib/components/hardware/`), and a new Field Matrix logo (an abstract grid with one red signal node) replacing the original literal fretboard-with-strings mark across the favicon, header, and README banner. The 9-role harmonic color system (§7 above) was deliberately preserved rather than collapsed into the two brand colors — root/structural moved into the brand's own yellow shades since they already meant "selected/structural," while the other seven roles kept distinct hues steered away from both yellow and signal red. The Groove Engine (above) is the rebrand's flagship surface — a yellow chassis with black step keys and a red pulsing playhead — with Acid Bass reusing the exact same component system rather than a separate visual vocabulary, per the spec's own instruction. See `AGENTS.md` §4/§7 and `BLUEPRINT.md` §27 for the full current token/component system and the design calls behind it (why the 9-role palette survived, why the idle Play button doesn't recolor when running, why `--role-alteration` moved off red).

Everything from the six-mode/Guided-Practice/Saved-Material-Library era's own "beyond 1.0 boundary" list is moot now that most of that era's product surface is gone; any future scope decision should start from the current two-feature app, not from this history.

---

# Phase 0 — Repository foundation

## Goal

Create a clean, minimal SvelteKit application ready for rapid iteration.

## Tasks

- [x] Create repository `fretfield`
- [x] Initialize SvelteKit with TypeScript
- [x] Use pnpm
- [x] Enable strict TypeScript
- [x] Configure ESLint
- [x] Configure Prettier
- [x] Add Vitest
- [x] Add Playwright
- [x] Add GitHub Actions for lint, typecheck, test, and build
- [x] Add a minimal README
- [x] Add `BLUEPRINT.md`
- [x] Add `ROADMAP.md`
- [x] Add `AGENTS.md`

Suggested commands:

```bash
pnpm create svelte@latest fretfield
cd fretfield
pnpm install
pnpm check
pnpm test
```

Use the current official SvelteKit scaffolding options when initializing rather than relying blindly on this command if the CLI has changed.

## Exit criteria

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
```

all succeed in CI.

---

# Phase 1 — Music-theory core

## Goal

Implement a framework-independent TypeScript engine for pitch, intervals, chords, and fretboard geometry.

This is the most important technical foundation of the project.

## 1.1 Pitch classes

Implement normalized pitch classes.

Initial internal representation may use integers:

```text
C  = 0
C# = 1
D  = 2
...
B  = 11
```

Expose musical labels only at display boundaries.

Tasks:

- [x] `PitchClass` representation
- [x] semitone normalization
- [x] pitch transposition
- [x] sharp/flat display policy
- [x] note-name parser

## 1.2 Intervals

Implement the chromatic interval system:

```text
1 b2 2 b3 3 4 #4 5 b6 6 b7 7
```

Tasks:

- [x] root-to-note interval calculation
- [x] interval-to-semitones mapping
- [x] interval labels
- [x] compound display aliases: 2/9, 4/11, 6/13

## 1.3 Fretboard

Default configuration:

```text
4 strings
E A D G
20 frets
```

Tasks:

- [x] note at string/fret
- [x] full fretboard generation
- [x] configurable fret count
- [x] tuning abstraction
- [x] open-string support

## 1.4 Chords

Initial definitions:

- [x] major triad
- [x] minor triad
- [x] diminished triad
- [x] augmented triad
- [x] sus2
- [x] sus4
- [x] dominant 7
- [x] major 7
- [x] minor 7
- [x] minor 7 b5
- [x] diminished 7

## Tests

- [x] C + major → C E G
- [x] C + minor → C Eb G
- [x] C + dominant 7 → C E G Bb
- [x] F# + minor 7 → correct transposition
- [x] E-string fret 8 → C
- [x] A-string fret 3 → C
- [x] same interval geometry is preserved after root transposition

## Exit criteria

The engine can answer reliably:

```ts
analyzeFretboard({ root: 'C', chord: 'dominant-7' });
```

without depending on Svelte components.

---

# Phase 2 — Interactive fretboard MVP

## Goal

Make root selection spatial and immediate.

## Tasks

- [x] Build `Fretboard.svelte`
- [x] Build one reusable fret-cell component
- [x] Render four strings
- [x] Render frets 0–20
- [x] Add fret markers
- [x] Add string labels
- [x] Make each fret interactive
- [x] Clicking a fret sets the root
- [x] Highlight every occurrence of the root
- [x] Distinguish the specifically selected root position
- [x] Add keyboard focus states

## UX requirements

- Root selection must feel instantaneous.
- No submit/apply button.
- Hover must not change harmonic state.
- The selected root must remain obvious when other tones are highlighted.

## Exit criteria

The user can click C anywhere on the fretboard and every C becomes recognizable as the harmonic root.

---

# Phase 3 — Chord-tone visualization

## Goal

Deliver the first genuinely useful version of FretField.

## Tasks

- [x] Add chord selector
- [x] Add chord-tone analysis
- [x] Highlight root
- [x] Highlight structural chord tones
- [x] Highlight stable chord tones
- [x] Show interval labels
- [x] Add Notes / Intervals / Both toggle
- [x] Add legend

Initial semantic distinction:

```text
Root
Structural
Stable
```

Example:

```text
C7
1  = root
3  = structural
5  = stable
b7 = structural
```

## Exit criteria

A bassist can select C7 and immediately locate every `1`, `3`, `5`, and `b7` across the neck.

This is the first deployable alpha.

---

# Phase 4 — Harmonic Field mode

## Goal

Implement the defining feature of the product.

Instead of hiding non-chord tones, classify all twelve intervals according to their musical function over the current chord.

## Tasks

- [x] Define `HarmonicRole`
- [x] Create role tables/rules per chord family
- [x] Add stability score
- [x] Add tension score
- [x] Add semantic visualization
- [x] Add Chord Tones / Harmonic Field toggle
- [x] Keep all twelve pitch classes inspectable
- [ ] Add context-sensitive enharmonic labels (compound labels like `b3/#9` ship; dynamic single-spelling re-notation based on alteration context does not)

Recommended initial roles:

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

## Musical review

Before treating this phase as complete, manually review every interval over:

- [x] major
- [x] major 7
- [x] minor
- [x] minor 7
- [x] dominant 7
- [x] diminished
- [x] half-diminished
- [x] sus

Avoid pretending that harmonic-role classification is purely mathematical. Some categories are stylistic and context-dependent. Encode assumptions explicitly.

## Exit criteria

The app can answer:

> “What does this fret mean over the selected chord?”

not merely:

> “Is this fret part of the chord?”

---

# Phase 5 — Note inspector

## Goal

Make every highlighted fret teach something useful.

## Interaction

Click or focus a fret to open an inspector.

Example:

```text
Eb
#9 over C7

Altered tension
Blues/dominant color
Possible resolution: E or D
```

## Tasks

- [x] selected-note state
- [x] interval
- [x] enharmonic function
- [x] harmonic role
- [x] short explanation
- [x] stability/tension wording
- [x] suggested resolutions where meaningful

## Exit criteria

A user unfamiliar with an interval can understand why it is highlighted and how it might behave musically.

---

# Phase 6 — Chord builder

## Goal

Move beyond a flat dropdown without overwhelming beginners.

## UI

Start with chord family:

```text
Major
Minor
Dominant
Diminished
Suspended
```

Then allow extensions/alterations:

```text
6
7
maj7
9
11
13
b5
#5
b9
#9
#11
b13
```

## Tasks

- [ ] composable chord-definition model
- [ ] chord-symbol renderer
- [ ] validation of contradictory combinations
- [ ] common-chord presets
- [ ] advanced controls hidden by default

## Exit criteria

Users can construct common jazz/funk harmony such as:

```text
Cmaj9
Cm11
C13
C7b9
C7#9
C7#11
C7b13
Cmaj7#11
```

---

# Phase 7 — Shareable state and polish

## Goal

Make individual harmonic maps linkable and publication-ready.

## Tasks

- [x] serialize root/chord/view into URL
- [x] restore state from URL
- [x] responsive behavior
- [x] horizontal-scroll strategy for small screens
- [x] tooltip / inspector polish
- [x] empty-state guidance
- [ ] keyboard shortcuts (beyond standard tab/Enter/Space fret navigation)
- [x] accessible labels
- [x] reduced motion
- [ ] visual QA (ongoing, not a one-time task)

Actual URL shape (superset of the example below — covers all four `FieldMode`s):

```text
/?root=C&chord=7&view=intervals&mode=field
```

## Exit criteria

A teacher or author can send a URL that opens directly on a specific harmonic map.

---

# Milestone A — FretField 0.1

Target feature set:

- 4-string EADG bass
- root selection from fretboard
- common chord types
- chord-tone highlighting
- intervals / notes / both
- semantic root/structural/stable classes
- static deployment

This version should already be genuinely useful.

---

# Milestone B — FretField 0.5

Target feature set:

- full Harmonic Field mode
- color/tension/chromatic roles
- note inspector
- more chord types
- URL-shareable state
- polished responsive interface

At this point the project's distinctive thesis should be obvious.

---

# Phase 8 — Progression mode

## Goal

Teach harmony as movement through time.

## Example

```text
| Dm7 | G7 | Cmaj7 |
```

## Tasks

- [x] progression data model (declarative `ProgressionTemplate`s, not yet a free-form chord editor)
- [ ] chord editor (template-based only — arbitrary user-built progressions are Phase 6's chord builder + a future custom-progression editor)
- [x] previous / next controls
- [ ] loop
- [ ] tempo
- [ ] automatic progression playback
- [x] keyboard navigation
- [x] active chord indicator

The first version does not require audio.

## Exit criteria

The user can practice following a chord sequence while the harmonic field updates automatically.

---

# Phase 9 — Voice-leading mode

## Goal

Teach how to connect harmonies instead of treating every chord independently.

## Analyze transitions

For each useful note in current harmony, calculate proximity and function in the next harmony.

Highlight:

- [x] common tones
- [x] semitone resolutions
- [x] whole-tone resolutions
- [x] guide-tone motion
- [x] root-target paths (generalized beyond single-transition highlighting into full multi-chord Voice-Leading Paths search)

Example:

```text
G7 → Cmaj7

B → C
F → E
G → G or C
D → E or C
```

## UX idea

When a current fret is selected, lightly mark high-value destinations for the next chord.

This creates a spatial graph of melodic possibilities.

## Exit criteria

FretField begins answering:

> “Where should I move next?”

---

# Phase 9.5 — Live Input

## Goal

Let the player plug in a real bass and have FretField react to what's actually being played, as an optional layer over Chord Field, Progression Field, Voice-Leading Paths, and Local Fields — not a new mode with its own harmonic logic. See `BLUEPRINT.md` §18 for the full architecture and product framing.

## Tasks

- [x] `src/lib/audio/` domain: `DetectedNote`/`PitchEstimate`/`LiveNoteState` types, kept ignorant of chords/keys/roles
- [x] pure-TypeScript YIN pitch detector, tuned to the bass range (~35–450 Hz), robust to a louder harmonic than the fundamental
- [x] temporal stabilization (`PitchTracker`): onset requires consecutive-frame agreement, brief dropouts don't drop a held note, sustained silence releases it
- [x] `src/lib/music/absolute-pitch.ts`: MIDI-based open-string tuning and exact fret-position mapping, separate from the existing pitch-class-only `Tuning`
- [x] `src/lib/music/live-position.ts`: deterministic ambiguous-position ranking (unique → selected path step → active Local Field → movement continuity → stays ambiguous)
- [x] real browser capture (`getUserMedia` + `AnalyserNode`, explicit Enable/Disable, no permission requested on load) and a deterministic `FakeAudioSource` test double behind a shared `LiveAudioSource` interface
- [x] `src/lib/stores/live-input.svelte.ts`: owns the Web Audio lifecycle, kept separate from the music-theory store
- [x] wired into the main store so Chord Field/Progression Field/Voice-Leading Paths interpret the live-played note via the _existing_ engine (`analyzeInterval`, `connectionFor`, `matchesTarget`) — no parallel harmonic logic
- [x] fretboard `live-played` / `live-likely` / `live-next-target` layers, composed on top of existing role/path/region styling rather than replacing it
- [x] `LiveInputControls.svelte`: Enable/Disable, device picker, status, detected note, diagnostic input-level meter
- [x] unit tests for the DSP layer (synthetic buffers only, including harmonic-rich/adversarial cases) and the position-inference logic
- [x] Playwright e2e coverage via the injected `FakeAudioSource` — no real microphone required in CI

## Exit criteria

FretField begins answering, live:

> “What did I just play, and what does it mean here?”

---

# Phase 9.6 — Guided Practice

## Goal

Turn the four Field modes plus Live Input into an interactive practice loop — propose a target, the player finds and plays it, the existing engine evaluates and explains it — without a second harmonic engine. See `BLUEPRINT.md` §19 for the full architecture and product framing.

## Tasks

- [x] `src/lib/practice/types.ts`: `PracticeSession`/`PracticeExercise`/`PracticeTarget`/`PracticeEvaluation`, structured (never pre-rendered UI strings)
- [x] `src/lib/practice/evaluation.ts`: centralized `evaluateAttempt`, exact/strong-alternative/valid-alternative/incorrect via configurable thresholds, position-ambiguity handling that never rejects a correct pitch solely for an unprovable exact string/fret
- [x] `src/lib/practice/exercise-generators.ts`: `createIntervalExercise`, `createChordToneExercise`, `createResolutionExercise` (reuses `analyzeConnection`/`connectionFor` — G7→Cmaj7's F→E/B→C proven, not hardcoded), `createPathExercise` (reuses the already-selected `VoiceLeadingPath`, stable for the whole exercise); deterministic with an injectable random source, simple recent-target exclusion
- [x] `src/lib/practice/practice-engine.ts`: the pure `idle → active (waiting-for-note → feedback) → completed` session state machine, no timers
- [x] `noteOnsetId` added to `live-input.svelte.ts` — the smallest clean signal needed so a sustained note registers as exactly one attempt, not one per audio frame
- [x] `src/lib/stores/practice.svelte.ts`: orchestration store combining `fretfield` + `liveInput` state into a `PracticeContext`, drives `fretfield.mode`/`activeChordIndex` so existing Field-mode visuals track the exercise for free
- [x] fretboard `practice-target` (hint-gated) / `practice-result` layers, composed independently of every existing role/path/region/Live-Input layer
- [x] `GuidedPracticeControls.svelte`: mode picker, hint level, Local-Field-only toggle, prompt, feedback, Next, session stats
- [x] unit tests per mode (including transposition invariance across C/Eb/A and Local Field position-ambiguity handling) and Playwright e2e coverage via the same injected `FakeAudioSource` — no real microphone required in CI

## Exit criteria

FretField closes the loop:

> “See a target, play it, hear/see the result, understand what it means, see where to go next.”

---

# Phase 9.7 — Scale Blocks

## Goal

Let the player build up to `MAX_CHORD_BLOCKS` independent chord blocks (originally 4, raised to 8) — each its own root, chord quality, and scale — and see all of their scales overlaid on the fretboard at once, one numbered/colored chip per matching block. See `BLUEPRINT.md` §20. Unlike Live Input/Guided Practice, this ships as a genuine fifth `FieldMode`, not a layer over the other four — confirmed with the user before implementation.

## Tasks

- [x] `src/lib/music/scales.ts`: `ScaleDefinition` (a named `IntervalId[]`, same pattern as chord formulas), an 11-scale v1 set (pentatonics, church modes, blues, harmonic minor), `suggestedScalesFor(chordId)` family-keyed like `FAMILY_DEFAULT_ROLES` — a starting recommendation only, never a restriction
- [x] `fretfield.svelte.ts`: `FieldMode` gains `'scale-blocks'`; `ChordBlock`/`MAX_CHORD_BLOCKS` (8); `chordBlocks` state + add/remove/set-root/set-chord/set-scale methods; `DisplayFretPosition` gains `scaleBlockMembership: number[]` computed in the existing `positions` derived; `analyzed` forced to `null` in this mode so the base pill falls back to plain note names (no new code path)
- [x] `FretCell.svelte`: a row of up to 8 numbered, colored chips per fret (wrapping onto a second row past 4) — composes independently of every existing role/path/region/Live-Input/Guided-Practice layer
- [x] `ScaleBlockControls.svelte` (per-block root/chord/scale dropdowns, add/remove, suggested-scales-first grouping) and `ScaleBlockLegend.svelte` (a compact key under the fretboard)
- [x] wired into `FieldModeSwitcher.svelte`/`+page.svelte`; `NoteInspector.svelte` shows which block(s) a note belongs to and each one's chord+scale
- [x] unit tests for `scales.ts` (concrete pitch-class examples, transposition invariance, family-aware suggestions for all 11 chord qualities) and Playwright e2e coverage (single block, overlapping blocks, remove, cross-mode persistence)
- [x] manually verified with a real ii–V–I (Dm7/Dorian, G7/Mixolydian) — confirmed the shared-tone overlap renders correctly and matches the theory

## Exit criteria

FretField answers, across several chords at once:

> “What scales fit across this progression, and where do they overlap?”

---

# Phase 9.8 — Scale Practice

## Goal

Let the player pick a root, a scale, and a fret zone: every note of that scale is highlighted at once, whatever they actually play is highlighted live, and an independent, adjustable-BPM metronome keeps time alongside it, decoupled from the highlighting entirely. See `BLUEPRINT.md` §21. Pulls the `metronome` item forward from Phase 11's backlog, but ships as its own `FieldMode` rather than bolted onto Live Input or Guided Practice — both of those explicitly exclude timing by design (§18/§19), confirmed with the user before implementation.

## Tasks

- [x] `src/lib/scale-practice/`: `types.ts` (`PracticeZone`), `positions.ts` (`scalePositions` — every position a root/scale/zone covers; `positionsForPitchClass` — reused for the live played-note lookup)
- [x] `src/lib/audio/metronome.ts`: a short synthesized click via a dedicated `AudioContext`, separate from Live Input's capture context — the app's first audio output
- [x] `src/lib/stores/scale-practice.svelte.ts`: root/scale/zone/BPM state; `scalePositions`/`playedPositions` derived independently of `running`; a self-correcting `Date.now()`-based `setTimeout` scheduler that only plays the click
- [x] `fretfield.svelte.ts`: `FieldMode` gains `'scale-practice'`; `analyzed` forced to `null` in this mode, same fallback path Scale Blocks already established
- [x] `FretCell.svelte`: a permanent scale-tint layer and a live played-note ring, both gated only on the mode being active (not on the metronome running), plus zone dimming
- [x] `ScalePracticeControls.svelte` (root/scale dropdowns, zone fret-range inputs) wired into `FieldModeSwitcher.svelte`/`+page.svelte`, visually separated from a distinct "Metronome" sub-panel (BPM + Start/Stop) so the button reads unambiguously as click-only; `NoteInspector.svelte` shows a hovered note's scale degree
- [x] unit tests for `positions.ts` and Playwright e2e coverage (scale highlighted on configure, played note highlighted live regardless of metronome state, Start/Stop toggling doesn't touch the highlight, zone-exclusion hint, tab-switch stops the metronome)
- [x] manually verified in the browser: the audible click firing without console errors, the live played-note ring composing on top of the scale tint, and Live Input's own generic highlighting still working independently alongside it outside the zone

**Revision:** the first version of this mode stepped through the scale one target note at a time in sync with the metronome and graded each beat's pitch/timing. Replaced with the always-on/real-time model above per explicit product direction — decoupling the metronome from the highlighting turned out to be more useful than a graded drill.

## Exit criteria

FretField answers:

> “What does this scale look like on the neck, and what am I actually playing?” — with a metronome available alongside it, not gating it.

---

# Phase 10 — Practice modes

Add one mode at a time.

## Interval Trainer / Chord-Tone Trainer

Superseded by Guided Practice's Find Interval and Find Chord Tone modes (Phase 9.6) — same core mechanic (root/chord appears, a target is requested, the app validates), but played on a real bass through Live Input rather than validated by clicking a fret.

## Ear Training

- app plays interval or note
- user identifies function

## Groove Navigation

(Unrelated name collision with the built "Groove Engine" — Scale Practice's rhythm/drum-machine feature, see "Current status" above. This is a distinct, unbuilt fretboard-navigation practice mode idea.)

- short harmonic loop
- target constraints such as `1`, `3`, `b7`

## Walking Bass

- chord progression
- target root arrivals
- optional chromatic approach hints

---

# Phase 11 — Audio

Do not add audio until the visual interaction is excellent.

Potential scope:

- [ ] play fret on click
- [ ] play selected chord
- [x] metronome (shipped as Phase 9.8 — Scale Practice — its own mode, not folded into Live Input/Guided Practice)
- [ ] progression playback
- [ ] looped harmonic backing

Audio architecture must remain replaceable.

Do not tie music-theory logic to a particular synthesis library.

---

# Phase 12 — Alternate bass configurations

Add configurable instruments:

```text
4-string EADG
5-string BEADG
5-string EADGC
6-string BEADGC
custom tuning
```

Tasks:

- [ ] tuning presets
- [ ] variable string count
- [ ] variable fret count
- [ ] left-handed orientation

The engine should already support this structurally; only UI work should remain.

---

# Phase 13 — Educational integration

Potential integration with educational material:

- embeddable fretboard state
- deep links from articles/chapters
- preset harmonic examples
- progression examples
- teaching callouts

FretField should work well as the interactive companion to a text-based method about groove and bass harmony.

---

# Phase 14 — Optional experimental features

Only evaluate after the core product proves useful.

Possible experiments:

- phrase/path visualization
- generated practice prompts
- MIDI input from bass
- pitch detection from microphone/interface
- user-defined progressions
- saved presets
- exportable SVG/PNG diagrams
- embeddable iframe/widget

Avoid turning FretField into a general DAW, notation package, or tab editor.

---

# Engineering priorities

When priorities conflict, use this order:

1. musical correctness
2. clarity of harmonic visualization
3. interaction latency
4. accessibility
5. maintainability
6. responsive polish
7. feature breadth

---

# Recommended release sequence

```text
0.1  fretboard + root + chord tones
0.2  interval/note display polish
0.3  more chord families
0.4  note inspector
0.5  harmonic field
0.6  shareable URL state
0.7  chord builder
0.8  progression mode
0.9  voice leading
1.0  stable educational release
```

Do not use version numbers as promises; release according to product quality.

---

# Definition of v1.0

FretField 1.0 should let a bassist:

- choose any root spatially;
- construct common jazz/funk chords;
- understand all relevant notes around the chord;
- distinguish targets, color, tension, and chromatic movement;
- inspect why a note works;
- follow a chord progression;
- see useful voice-leading paths;
- share a harmonic state via URL;
- use the application entirely without an account.

At v1.0, the application should feel less like a fretboard reference and more like an interactive mental model for bass harmony.
