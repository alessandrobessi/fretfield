# FretField — Product & Technical Blueprint

> **Tagline:** See the harmonic field. Move through it.

## 0. The four-field model (current product structure)

FretField answers four increasingly powerful questions, each a peer `FieldMode` selectable from the same fretboard and the same selected root:

```text
Chord Field           "What can I play now?"          — full 12-role Harmonic Field over one chord
Progression Field      "Where can I go next?"           — resolve a progression template, see each note's best resolution into the next chord
Voice-Leading Paths    "What route should I take?"      — ranked, complete fretted paths through the whole progression
Local Fields           "Where on the neck should I play it?" — ranked, overlapping neck regions, usable as a lens under any of the above
```

Root selection, display mode, and progression selection persist across mode switches — switching tabs changes the lens, not the underlying harmonic selection. `?root=&mode=&chord=&display=&analysis=&progression=&chordIndex=&pathPreset=&region=` in the URL reproduces the same view (§7 Phase 7 originally scoped a narrower version of this; the shipped version covers all four modes).

**Live Input** (§18) is a fifth, optional layer over all four — not a fifth `FieldMode`. Enabled explicitly by the user, it detects the pitch of whatever's actually being played on a real bass and reuses whichever mode's engine is already active to explain it, rather than adding a separate harmonic system.

Sections 1–23 below describe the original single-mode ("Chord Field only") product concept this grew from; they remain accurate for Chord Field specifically. Where later sections describe progression/voice-leading/spatial features as future work, treat this section as authoritative — those are built.

---

## 1. Product concept

FretField is an interactive bass-fretboard application that turns harmony into a spatial map.

The user selects a root by clicking any fret, chooses a chord or harmonic context, and FretField highlights the entire neck according to the musical function of each pitch relative to that harmony.

The goal is not merely to answer:

> “Which notes belong to this chord?”

FretField should answer:

> “What can I play here, what does each note do, how stable or tense is it, and where does it want to move?”

The central mental model is:

**The bass fretboard is a field of harmonic functions around a root.**

This makes FretField especially suitable for bassists learning improvisation, walking bass, funk, jazz, fusion, voice leading, chord-tone targeting, and chromatic approaches.

---

## 2. Naming

### Recommended name: FretField

**Why it works**

- `Fret` immediately identifies the instrument/fretboard domain.
- `Field` expresses the core conceptual model: every note around the root has a function and a degree of stability/tension.
- It does not lock the project to one genre.
- It can naturally extend beyond chord tones into scales, voice leading, approaches, and progressions.
- It is short enough for a repository, CLI namespace, logo, and domain/subdomain.

Suggested repository name:

```text
fretfield
```

Suggested product line:

```text
FretField
See the harmonic field. Move through it.
```

Other viable names, if a different tone is desired:

- RootField
- GrooveMap
- BassField
- FretCompass
- Harmonic Neck
- GrooveGrid

FretField is the preferred choice because it names the central idea rather than only the instrument.

---

## 3. Product principles

### 3.1 Function before note names

Intervals are the primary representation.

The application should teach:

```text
1  b2  2  b3  3  4  #4  5  b6  6  b7  7
```

rather than encouraging dependence on memorized note names alone.

Users may toggle among:

- Intervals
- Notes
- Both

Default: **Intervals**.

### 3.2 Geometry before memorization

Bass tuning is regular in fourths. FretField should make interval geometry visually obvious and preserve it when roots move.

The user should discover that a harmonic structure is a movable shape rather than a separate collection of notes for every root.

### 3.3 Harmonic role before binary correctness

Do not divide notes only into:

```text
correct / wrong
```

Instead classify them by function:

- Root
- Structural chord tone
- Stable chord tone
- Extension / color
- Tension
- Alteration
- Chromatic approach
- Contextually avoidable note

The same pitch class may have different roles over different chords.

### 3.4 Progressive disclosure

The default view must remain visually simple.

Advanced information appears on hover, click, or through explicit modes.

### 3.5 No backend unless needed

The initial application should run entirely client-side.

No account, database, authentication, or server API is required for the MVP.

---

## 4. Primary user flow

### Step 1 — Choose a root

The user clicks any fret.

Example:

```text
A string, fret 3 → C
```

That pitch becomes the root.

The root should be visually unmistakable.

### Step 2 — Choose harmony

The user selects a chord quality.

MVP examples:

```text
Major
Minor
Dominant 7
Major 7
Minor 7
Minor 7 b5
Diminished 7
Sus2
Sus4
```

Later:

```text
6
m6
9
m9
maj9
11
m11
13
7b9
7#9
7#11
7b13
maj7#11
alt
```

### Step 3 — Explore the harmonic field

Every pitch-class instance on the neck receives a semantic role.

Example over C7:

```text
C   1    root
E   3    structural
G   5    stable
Bb  b7   structural
D   9    extension
A   13   color
Eb  #9   altered/blues tension
F   11   tension
F#  #11  altered tension
Ab  b13  altered tension
Db  b9   strong altered tension
B   7    chromatic approach to root
```

### Step 4 — Inspect a note

Clicking or hovering a fret reveals a compact explanation:

```text
Eb
#9 over C7

Role: altered tension
Character: blues / dominant tension
Typical motion: E, D, or chord-dependent resolution
```

---

## 5. Semantic model

The internal model must distinguish objective interval identity from contextual musical interpretation.

### 5.1 Interval identity

```ts
type IntervalId = '1' | 'b2' | '2' | 'b3' | '3' | '4' | '#4' | '5' | 'b6' | '6' | 'b7' | '7';
```

Enharmonic labels can later be context-aware:

```text
b3 / #9
#4 / b5
b6 / #5
2 / 9
4 / 11
6 / 13
```

### 5.2 Harmonic role

```ts
export type HarmonicRole =
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

### 5.3 Note analysis

```ts
export interface HarmonicAnalysis {
	note: PitchClass;
	interval: IntervalId;
	degreeLabel: string;
	chordTone: boolean;
	role: HarmonicRole;
	stability: number; // 0..1
	tension: number; // 0..1
	explanation: string;
	typicalResolutions?: IntervalId[];
}
```

The numerical scores are useful internally for opacity, emphasis, ordering, and future pedagogical modes. They should not necessarily be shown as raw numbers in the UI.

---

## 6. Important musical rule

Harmonic classification must be **context dependent**.

Do not create a universal table such as:

```text
b3 = color
4 = tension
6 = extension
```

That would be musically incorrect.

Instead:

```text
(root, chord definition, interval) → harmonic analysis
```

Examples:

- `3` is structural over Cmaj7 and C7.
- `3` is non-diatonic tension over Cm7.
- `4` may be structural over Csus4 but tense over Cmaj7.
- `b3` is structural over Cm7 but may act as #9/blues color over C7.

---

## 7. Chord representation

Avoid hard-coding every chord as a separate UI-specific object.

Use composable chord formulas.

```ts
export interface ChordDefinition {
	id: string;
	label: string;
	symbol: string;
	required: IntervalId[];
	optional?: IntervalId[];
	extensions?: IntervalId[];
	altered?: IntervalId[];
	aliases?: string[];
}
```

Example:

```ts
{
  id: 'dominant-7',
  label: 'Dominant 7',
  symbol: '7',
  required: ['1', '3', '5', 'b7']
}
```

---

## 8. Fretboard model

MVP tuning:

```text
E1 A1 D2 G2
```

Default neck:

```text
0–20 frets
```

Allow 24 frets through settings.

Core structure:

```ts
export interface FretPosition {
	stringIndex: number;
	fret: number;
	pitchClass: PitchClass;
	midi?: number;
}
```

The engine should derive the note from tuning + fret number, never from manually entered lookup tables.

---

## 9. UI architecture

Suggested main layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ FretField                                      Settings      │
├──────────────────────────────────────────────────────────────┤
│ Root: C     Chord: Dominant 7      View: Intervals           │
│                                                              │
│ [ chord / extension / alteration controls ]                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    INTERACTIVE FRETBOARD                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Root  Structural  Stable  Color  Tension  Chromatic          │
├──────────────────────────────────────────────────────────────┤
│ Selected note explanation                                   │
└──────────────────────────────────────────────────────────────┘
```

Desktop is primary for the first release, but the fretboard must remain usable on tablet and mobile through horizontal scrolling or a compact viewport strategy.

---

## 10. Visual language

The visualization must encode musical meaning with a small number of semantic classes.

Suggested hierarchy:

### Root

Highest visual emphasis.

### Structural tones

Thirds and sevenths or other tones that strongly define chord quality/function.

### Stable tones

Chord tones with lower harmonic information density, especially fifths.

### Color / extensions

Available upper structures and characteristic color tones.

### Tension / altered tones

Clearly visible but visually distinct from stable targets.

### Chromatic approach

Lower emphasis; should suggest motion rather than destination.

Do not use twelve unrelated colors for twelve pitch classes.

Color is semantic, not chromatic decoration.

Also use shape, outline, opacity, or border treatment so the app is interpretable by users with color-vision deficiencies.

---

## 11. Interaction states

Each fret can be in one or more states:

```text
normal
hovered
selected-root
highlighted
focused
currently-playing
next-target
```

The root selection must never be confused with a merely highlighted occurrence of the same note elsewhere on the neck.

---

## 12. Core application state

Prefer simple Svelte state rather than introducing a state-management library prematurely.

```ts
interface FretFieldState {
	tuning: PitchClass[];
	fretCount: number;
	root: PitchClass | null;
	selectedRootPosition?: FretPosition;
	chordId: string;
	displayMode: 'intervals' | 'notes' | 'both';
	analysisMode: 'chord-tones' | 'field';
	selectedPosition?: FretPosition;
}
```

URL-query serialization is desirable:

```text
/?root=C&chord=7&view=intervals&mode=field
```

This makes harmonic views shareable without a backend.

---

## 13. Suggested source structure

```text
src/
├── lib/
│   ├── music/
│   │   ├── pitch.ts
│   │   ├── intervals.ts
│   │   ├── tuning.ts
│   │   ├── fretboard.ts
│   │   ├── chords.ts
│   │   ├── harmony.ts
│   │   ├── resolutions.ts
│   │   └── __tests__/
│   ├── components/
│   │   ├── Fretboard.svelte
│   │   ├── BassString.svelte
│   │   ├── FretCell.svelte
│   │   ├── RootIndicator.svelte
│   │   ├── HarmonyControls.svelte
│   │   ├── ChordSelector.svelte
│   │   ├── DisplayModeToggle.svelte
│   │   ├── Legend.svelte
│   │   └── NoteInspector.svelte
│   ├── stores/
│   │   └── fretfield.svelte.ts
│   ├── config/
│   │   └── chords.ts
│   └── utils/
│       └── url-state.ts
├── routes/
│   ├── +layout.svelte
│   └── +page.svelte
└── app.css
```

---

## 14. Music engine API

The UI should never perform pitch arithmetic directly.

Recommended public API:

```ts
createFretboard(tuning, fretCount);
getPitchAtPosition(tuning, stringIndex, fret);
intervalFromRoot(root, note);
getChordDefinition(chordId);
analyzeInterval(root, chord, interval);
analyzeFretboard({ tuning, fretCount, root, chord });
```

Example:

```ts
const field = analyzeFretboard({
	tuning: ['E', 'A', 'D', 'G'],
	fretCount: 20,
	root: 'C',
	chord: getChordDefinition('dominant-7')
});
```

---

## 15. MVP modes

### Chord Tones

Highlight only notes contained directly in the chord.

Purpose: beginners and fast reference.

### Harmonic Field

Show all twelve pitch classes with semantic weighting.

Purpose: improvisation and deeper harmonic understanding.

The distinction should be explicit in the UI.

---

## 16. Progression mode — post-MVP priority

Progression mode turns FretField from a static reference into a real practice tool.

Example:

```text
| Dm7 | G7 | Cmaj7 |
```

Features:

- previous chord
- next chord
- keyboard shortcuts
- adjustable tempo
- automatic chord advancement
- pause
- loop

The fretboard should update its harmonic field as the harmony changes.

---

## 17. Voice-leading mode — strategic feature

Given current chord A and next chord B, calculate transitions for every currently useful pitch.

Highlight:

- common tones
- half-step destinations
- whole-step destinations
- strong guide-tone resolutions
- root motion

Example:

```text
G7 → Cmaj7

F  → E
B  → C
D  → C / E
G  → G / C
```

This can become one of FretField's most differentiated features.

---

## 18. Live Input — real-time bass pitch detection

Live Input is an optional real-time layer over the four Field modes above, not a fifth mode. It answers a fifth, complementary question — _what did I just play, and what does it mean?_ — using whichever mode's engine is already on screen, rather than a separate feature with its own harmonic logic.

```text
LIVE INPUT (optional layer)
        │
        ▼
 detected pitch → physical position(s) → existing harmonic context
        │
        ├──> Chord Field         "Played E — 3 of C7, structural"
        ├──> Progression Field   "Played F — b7 of G7, resolves to E (Cmaj7's 3)"
        ├──> Voice-Leading Paths "Played E — matches the current path step"
        └──> Local Fields        "3 candidates, only 1 inside the active region — likely position"
```

**Pipeline:** Bass → USB audio interface/mic → Web Audio API → YIN pitch detection → temporal stabilization → `DetectedNote` → absolute-pitch-to-fretboard mapping → existing harmonic analysis → visual feedback.

**Architectural boundary** (mirrors §13's engine layering): `src/lib/audio/` only ever produces a neutral `DetectedNote` — frequency, MIDI, pitch class, octave, cents, confidence. It has no concept of a chord, a key, a role, a progression, or a Voice-Leading Path; nothing in that domain imports from `src/lib/music/` beyond the bare `PitchClass` type. Harmonic meaning is layered on afterward, by the dedicated `src/lib/stores/live-input.svelte.ts` store combined with the main store's already-computed analysis — never a second, parallel harmonic engine.

**Detection:** a pure-TypeScript YIN implementation (difference function → cumulative mean normalized difference → absolute-threshold search → parabolic interpolation), tuned to the electric bass's practical range (~35–450 Hz). YIN was chosen because bass tone is harmonically rich enough that a louder overtone can outweigh the fundamental — naive approaches (zero-crossings, highest FFT bin, raw spectral peak) are unreliable for exactly that reason.

**Ambiguity is real, not a bug.** A detected pitch generally maps to more than one physical position (the same E2 is reachable on three different strings). Live Input never hides that: every physically valid position lights up as a candidate, and only when something already on screen narrows it down — a selected Voice-Leading Path step, an active Local Field containing exactly one candidate, or continuity from where the player was a moment ago — does one candidate get marked as the likely one. Absent all of that, the ambiguity stays visible rather than guessing a string.

**Visual layering, not replacement.** The live-played layer is an additional, independent visual state composed on top of whatever a fret already shows (its Harmonic Role pill, its Voice-Leading Path step, its Local Field dimming) — never a substitute for it. A fret can simultaneously be a chord's structural tone, the current step of a selected path, and the position that's currently sounding, and all three stay visible.

**Product framing:** Live Input is not a tuner. The loop it supports is `SEE → PLAY → DETECT → UNDERSTAND → SEE NEXT POSSIBILITIES → PLAY` — not just "what note did I play?" but "what does it mean here, and where can I go from here?"

**Privacy:** entirely client-side. Audio is analyzed locally in the browser; nothing is recorded, stored, or uploaded, and there is no backend.

**Explicitly out of scope for this feature:** polyphonic pitch detection, chord recognition from audio, automatic backing tracks, MIDI input, recording, audio playback, a metronome, scoring/gamification, account persistence, cloud processing, ML-based pitch models, automatic progression advancement, a full Guided Practice mode, and transcription. Some of these may become their own future modes (see §19); Live Input deliberately stays a thin, honest layer rather than growing into all of them at once.

---

## 19. Future modes

Potential extensions:

### Scale Overlay

Show compatible scales while keeping chord roles visible.

### Blues Mode

Distinguish chord tones, blue notes, chromatic approaches, and target notes.

### Walking Bass Mode

Visualize chord tones and approach paths to the next root.

### Groove Mode

Show useful target regions rather than scales.

### Ear Training

Play a note and ask the user to identify its function.

### Interval Trainer

Select a root and ask the player to find an interval on the neck.

### MIDI / Audio

Play selected notes and chords.

### Five- and Six-String Bass

Support configurable tunings.

### Left-handed View

Mirror fretboard orientation.

---

## 20. Accessibility

Requirements:

- keyboard-accessible fret navigation
- visible focus states
- semantic labels for fret buttons
- no meaning encoded solely by color
- sufficient contrast
- reduced-motion support
- screen-reader description of selected harmonic context

Example accessible label:

```text
A string, fret 3, C, root, interval 1
```

---

## 21. Testing strategy

### Unit tests

Highest priority: music theory engine.

Test:

- pitch-class arithmetic
- tuning calculations
- interval derivation
- chord formulas
- enharmonic display
- role classification
- root movement invariance

### Component tests

Test:

- root selection
- chord selection
- display mode toggles
- fret labels
- legend synchronization
- inspector contents

### End-to-end tests

Core scenario:

```text
click C → choose Dominant 7 → verify C/E/G/Bb roles → switch root to F → verify geometry and labels update
```

---

## 22. Non-goals for v1

Do not add:

- authentication
- social features
- cloud storage
- complex audio workstation features
- notation editor
- tabs editor
- AI-generated bass lines
- community content
- guitar support

FretField should first become exceptionally good at one thing:

**making harmonic function visible on a bass fretboard.**

---

## 23. Success criteria

The MVP succeeds when a bassist can:

1. open the app with no setup;
2. click any root on the neck;
3. select a chord;
4. immediately see all chord tones across the fretboard;
5. switch to Harmonic Field mode;
6. understand which notes are stable, structural, colorful, tense, or chromatic;
7. click any note and understand its harmonic role;
8. move the root and see the same interval geometry reappear elsewhere.

The strongest test is pedagogical:

> After using FretField, the player should increasingly think in intervals and harmonic function instead of isolated fret numbers and note names.
