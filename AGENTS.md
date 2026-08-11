# AGENTS.md — FretField

This file defines the operating rules for coding agents working on FretField.

Read `BLUEPRINT.md` and `ROADMAP.md` before making architectural or product changes.

---

## 1. Mission

FretField is an interactive bass-fretboard application that visualizes harmonic function relative to a selected root and chord.

Its central idea is:

> The fretboard is a harmonic field, not merely a grid of note names.

Every implementation decision should reinforce that idea. Concretely, the product answers four increasingly powerful questions, each a `FieldMode`:

```text
Chord Field           "What can I play now?"
Progression Field      "Where can I go next?"
Voice-Leading Paths    "What route should I take?"
Local Fields           "Where on the neck should I play it?"
```

Local Fields is a spatial lens usable from any of the other three modes (region state lives in the store independent of `mode`), not an isolated feature. Root selection, display mode, and progression selection persist across mode switches — switching tabs changes the lens, not the underlying selection.

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

Must not import:

- Svelte
- browser APIs
- DOM utilities
- CSS
- route modules

### `src/lib/components/`

Rendering and interaction only.

Components consume analyzed music data.

### `src/lib/stores/`

Application state only.

Do not duplicate derived harmonic logic here.

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

Maintain product focus.

---

## 27. Long-term architectural direction

Built so far, in `src/lib/music/`:

```text
pitch.ts intervals.ts tuning.ts fretboard.ts chords.ts harmony.ts
local-fields.ts progressions.ts connection-score.ts voice-leading.ts
voice-leading-paths.ts
```

Future modules may include:

```text
music/scales.ts
music/approaches.ts
practice/interval-trainer.ts
practice/walking-bass.ts
audio/playback.ts
```

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
