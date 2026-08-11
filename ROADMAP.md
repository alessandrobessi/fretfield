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

Phases 0–4 below (repository foundation through Harmonic Field mode) are complete, plus Phase 5 (Note inspector) and the progression/voice-leading work originally scheduled as Phases 8–9. The product has since been restructured around four peer modes rather than one linear feature list — see `BLUEPRINT.md` §0 and `AGENTS.md` §1. Mapping onto this roadmap's original phase numbers:

```text
Chord Field           = Phase 3 (chord-tone visualization) + Phase 4 (Harmonic Field) + Phase 5 (Note inspector) — done
Progression Field      = Phase 8 (Progression mode), minus audio/playback           — done
Voice-Leading Paths    = Phase 9 (Voice-leading mode), generalized to full paths     — done
Local Fields            = new: bass-native regions, not originally scoped            — done
```

Phase 6 (Chord builder — composable extensions/alterations beyond the 11 base chord qualities) and Phase 7 (shareable state polish beyond the URL state already shipped) remain open, along with everything from Phase 10 onward (practice modes, audio, alternate tunings, educational integration).

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

# Phase 10 — Practice modes

Add one mode at a time.

## Interval Trainer

- root appears
- target interval is requested
- user clicks fret
- app validates

## Chord-Tone Trainer

- chord shown
- player identifies chord tones

## Ear Training

- app plays interval or note
- user identifies function

## Groove Navigation

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
- [ ] metronome
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
