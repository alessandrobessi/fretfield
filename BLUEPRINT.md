# FretField — Product & Technical Blueprint

> **Tagline:** See the harmonic field. Move through it.

## 0. The two-field model (current product structure)

By explicit, direct product request, FretField was stripped down from an earlier six-`FieldMode` design to just the two features actually in use:

```text
Chord Field       "What can I play now?"           — full 12-role Harmonic Field over one chord
Scale Practice    "Can you play this scale in time?" — every note of the active progression chord's scale is highlighted at once, whatever's played is highlighted live, and a synthesized drum machine (with an optional chord-progression backing) keeps time alongside it
```

The four other lenses this app used to have — Progression Field ("Where can I go next?"), Voice-Leading Paths ("What route should I take?"), Local Fields ("Where on the neck should I play it?", a spatial layer usable under any single-chord mode), and Scale Blocks ("What scales fit across this progression?", up to 8 independently-configured chords overlaid at once) — were deleted entirely, along with Guided Practice (§19, the exercise layer built on top of the single-chord modes), the Presets feature, the Progress tab, and the saved-material features (Favorite Chords, Scale Maps, custom Progressions). Sections 16, 17, 19, and 20 below are kept as a historical record of how those features worked and why, each marked **REMOVED** — do not treat them as live spec, and do not resurrect any of it without an explicit, direct product request.

Chord Field's root selection and display mode persist across Explore/Practice tab switches. `?root=&chord=&display=&analysis=` in the URL reproduces the same Chord Field view — Scale Practice's own session state (root/progression/zone/tempo) is separately persisted to localStorage, not the URL (see §21).

**Live Input** (§18, heavily trimmed from its original six-mode design) is an optional layer over Chord Field, plus Scale Practice's own independent played-note highlighting — not a `FieldMode` itself. Enabled explicitly by the user, it detects the pitch of whatever's actually being played on a real bass and reuses whichever mode's engine is already active to explain it.

Sections 1–15 below describe the original single-mode ("Chord Field only") product concept this grew from; they remain accurate for Chord Field specifically.

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

## 16. Progression mode — **REMOVED**

This was built (as "Progression Field") and later deleted entirely by explicit product request, along with Voice-Leading Paths, Local Fields, Scale Blocks, and Guided Practice — see §0. Kept below as a historical record only; do not treat as live spec or rebuild without a direct request.

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

## 17. Voice-leading mode — **REMOVED**

This was built (as "Voice-Leading Paths") and later deleted entirely by explicit product request — see §0/§16. Kept below as a historical record only.

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
        ├──> Chord Field       "Played E — 3 of C7, structural"
        └──> Scale Practice    "Played E — highlighted live, in or out of the active scale"
```

Originally a layer over six modes (see §0's history note); the Progression Field/Voice-Leading Paths/Local Fields branches shown in earlier versions of this diagram were removed along with those modes.

**Pipeline:** Bass → USB audio interface/mic → Web Audio API → YIN pitch detection → temporal stabilization → `DetectedNote` → absolute-pitch-to-fretboard mapping → existing harmonic analysis → visual feedback.

**Architectural boundary** (mirrors §13's engine layering): `src/lib/audio/` only ever produces a neutral `DetectedNote` — frequency, MIDI, pitch class, octave, cents, confidence. It has no concept of a chord, a key, or a role; nothing in that domain imports from `src/lib/music/` beyond the bare `PitchClass` type. Harmonic meaning is layered on afterward, by the dedicated `src/lib/stores/live-input.svelte.ts` store combined with the main store's already-computed analysis — never a second, parallel harmonic engine.

**Detection:** a pure-TypeScript YIN implementation (difference function → cumulative mean normalized difference → absolute-threshold search → parabolic interpolation), tuned to the electric bass's practical range (~35–450 Hz). YIN was chosen because bass tone is harmonically rich enough that a louder overtone can outweigh the fundamental — naive approaches (zero-crossings, highest FFT bin, raw spectral peak) are unreliable for exactly that reason.

**Ambiguity is real, not a bug.** A detected pitch generally maps to more than one physical position (the same E2 is reachable on three different strings). Live Input never hides that: every physically valid position lights up as a candidate, and only when something already on screen narrows it down — continuity from where the player was a moment ago is the one remaining disambiguation tier, now that the Voice-Leading-Path-step and Local-Field-region tiers were removed along with those modes — does one candidate get marked as the likely one. Absent that, the ambiguity stays visible rather than guessing a string.

**Visual layering, not replacement.** The live-played layer is an additional, independent visual state composed on top of whatever a fret already shows (its Harmonic Role pill) — never a substitute for it. A fret can simultaneously be a chord's structural tone and the position that's currently sounding, and both stay visible.

**Product framing:** Live Input is not a tuner. The loop it supports is `SEE → PLAY → DETECT → UNDERSTAND → SEE NEXT POSSIBILITIES → PLAY` — not just "what note did I play?" but "what does it mean here, and where can I go from here?"

**Privacy:** entirely client-side. Audio is analyzed locally in the browser; nothing is recorded, stored, or uploaded, and there is no backend.

**Explicitly out of scope for this feature:** polyphonic pitch detection, chord recognition from audio, automatic backing tracks, MIDI input, recording, audio playback, a metronome, scoring/gamification, account persistence, cloud processing, ML-based pitch models, and automatic progression advancement. Live Input deliberately stays a thin, honest layer — it detects and explains, nothing more.

---

## 19. Guided Practice — **REMOVED**

This was built (all four exercise modes, `src/lib/practice/`, the Presets feature and Progress tab built on top of it) and later deleted entirely by explicit product request — see §0. Kept below as a historical record only.

Guided Practice turns FretField from a visualization tool into an interactive bass-learning environment, built entirely on the five layers above it. It adds no harmonic engine of its own:

```text
FretField proposes a target
        │
        ▼
   player finds and plays it
        │
        ▼
   Live Input detects the note
        │
        ▼
   the existing engine evaluates and explains it
        │
        ▼
        next target
```

**Product principle:** hear/see a harmonic problem, make a physical choice on the bass, and immediately understand the musical consequence — not a Guitar-Hero-style binary note game. Wherever the underlying engine supports it, an answer is one of `exact / strong alternative / valid alternative / incorrect for this exercise`, not a flat right/wrong (§9's "you played D — 9 of Cmaj7, musically valid, but this exercise asked for the 3rd" is the model example).

**The four initial exercise modes**, each mapped directly onto an existing Field mode's question:

```text
Find Interval        "Can you locate this interval relative to the root?"        — Chord Field
Find Chord Tone       "Can you find this structural note of the current chord?"   — Chord Field
Resolve Note           "Given this note, can you find a strong resolution?"        — Progression Field
Follow Path             "Can you follow the selected voice-leading path?"           — Voice-Leading Paths
```

**Architecture** (`src/lib/practice/`): a pure decision layer, parallel to `$lib/music` and `$lib/audio`, that takes a plain `PracticeContext` (root, chord, progression, selected path, active region — all read from the existing stores, never duplicated) and decides what the current exercise is and whether a played note satisfies it. `evaluateAttempt()` is the one place a note is compared against a target; Resolve Note's targets come from calling `analyzeConnection`/`connectionFor` directly — G7→Cmaj7's F→E and B→C are proven, not hardcoded, the same invariant Live Input's Progression Field integration already relies on. Find Chord Tone's "valid alternative" ranking reuses `roleStability`. Follow Path reuses whichever `VoiceLeadingPath` is already selected, unchanged for the whole exercise — the practice engine never recomputes a different path mid-exercise.

**Session state machine:** `idle → prompting → waiting-for-note → evaluating → feedback → next exercise`, with no timers — the player always sees feedback before a next target appears, whether by an automatic short transition or an explicit Next button. A sustained note (many repeated `DetectedNote` frames) registers as exactly one attempt, gated on Live Input's onset signal, not on raw audio frames.

**Position vs. pitch:** most exercises only require the right pitch class, in any octave — audio alone can't prove which string/fret was used. Only when a Local Field is explicitly active and the exercise is trained for it does physical position matter, and even then an ambiguous-but-plausible position is reported as "correct — position ambiguous" rather than rejected, reusing Live Input's own position-inference confidence rather than inventing new certainty math.

**Hint levels** (`hidden / interval / positions`, default `positions` for beginners) control how much of the target is shown before the player plays: nothing, the interval name, or the interval name plus a highlight on every valid fretboard position. The highlight composes with — never replaces — existing role/path/region/Live-Input styling.

**Explicitly out of scope for this feature:** a metronome, backing tracks, automatic chord timing, rhythm/duration/tempo scoring, polyphonic detection, MIDI input, recording, persistent progress, user accounts, achievements, an adaptive AI teacher, spaced repetition, and generated bass lines. Session statistics (attempts, correct, strong alternatives, exercises completed) live only in memory and reset on reload — no backend, no account.

---

## 20. Scale Blocks — **REMOVED**

This was built (including its "My Scale Maps" saved-material feature) and later deleted entirely by explicit product request — see §0. Kept below as a historical record only.

Unlike Live Input and Guided Practice, Scale Blocks is a genuine fifth `FieldMode`, not a layer: it shows several chords' scales at once rather than one chord's role field at a time, so it needed its own state (`chordBlocks`) rather than reusing `root`/`chordId`.

```text
build up to 8 chord blocks
        │
        ▼
each block: its own root + chord quality + a scale that fits it
        │
        ▼
every fret on the neck shows which block(s)' scale contain its pitch class
```

**Chord blocks** (`ChordBlock { id, root, chordId, scaleId }`, capped at `MAX_CHORD_BLOCKS = 8`): fully independent of each other — no shared key or tonic is enforced, though in practice a bassist usually builds blocks from one progression (e.g. a ii–V–I). Edited via per-block root/chord/scale dropdowns, never by clicking a fret (clicking a fret still sets the _global_ selected root, exactly as it already does in every other mode — see AGENTS.md §9).

**`src/lib/music/scales.ts`:** the first place scale theory enters the engine. A `ScaleDefinition` is just a named `IntervalId[]`, defined the same way chord formulas already are — no new pitch arithmetic. `suggestedScalesFor(chordId)` is family-keyed (mirrors `FAMILY_DEFAULT_ROLES` in `harmony.ts`'s exact pattern) and only orders/groups the scale dropdown; every scale stays pickable for every chord, consistent with §24's "no wrong note" framing.

**Fretboard rendering:** with no single shared chord, the base pill always shows a plain note name (the existing no-root fallback branch, not a new code path). Membership in each configured block's scale is shown as a small row of up to 8 numbered, colored chips per fret (wrapping onto a second row past 4) — the number identifies the block without relying on color alone (§22's non-color-signal rule), and a fret can carry multiple chips at once when its pitch class is in more than one block's scale (a common, musically expected case: e.g. D Dorian and G Mixolydian are different modes of the same seven notes).

**Common tones:** with 2+ configured blocks, `ScaleBlockLegend` also lists the note names present in _every_ block's scale (the full intersection, not any pairwise overlap) and the fretboard fills those frets' background with a distinct accent color instead of just their chips — the "safe over the whole progression" notes should read at a glance, the same instinct behind Live Input's bright fill for the confirmed played position (§18).

**Not built (yet):** URL persistence for `chordBlocks` (session-only, matching Guided Practice's own precedent), Local Field constraining of Scale Blocks, and Live Input/Guided Practice integration with this mode.

---

## 21. Scale Practice — a highlighted scale plus a free-standing Groove Engine

A genuine sixth `FieldMode`, like Scale Blocks: it needs its own root/scale/fret-zone/tempo state, unrelated to any chord or progression, so it can't reuse `root`/`chordId`. Unlike Guided Practice (§19), which is explicitly self-paced and excludes timing by design, this mode's metronome is exactly the timing concept Guided Practice excludes — so it lives in its own store (`scale-practice.svelte.ts`) rather than as a fifth `PracticeMode` inside Guided Practice's engine.

Two independent pieces, not one drill loop:

```text
pick a root + a scale + a fret zone (e.g. frets 0–12)
        │
        ▼
every note of that scale within the zone is highlighted at once — no
target stepping, no per-beat grading
        │
        ▼
play anything: whatever Live Input hears is highlighted live, in real
time, whether or not it's in the scale
        │
        ▼
Start/Stop only starts/stops the Groove Engine (a synthesized multi-voice
groove, playing a multi-bar arrangement at the chosen BPM/Feel/Intensity)
— it has no effect on what's highlighted either way
```

**Session state** (`ScalePracticeStore`): `root`, `zone: { minFret, maxFret }`, `bpm` (30–240, default 80), `groove: Groove` (see below), `intensity` (0–100, default 100), `countIn` (`'off' | '1-bar' | '2-bars'`, default `'1-bar'`), `running` (the Groove Engine only). Configured independently of every other mode — switching to another tab stops the Groove Engine (component-unmount cleanup), but root/zone/tempo/groove/intensity/count-in choices persist for next time (unlike Scale Blocks' `chordBlocks`, this state is explicitly persisted to localStorage — see the Local Practice Persistence plan). There is no standalone scale field anymore: the scale shown always comes from the picked progression's active chord (`activeChordScale`, `progressionChordScales`/`progressionChordScaleOverrides`) — see AGENTS.md §4 for the full mechanics.

**`scalePositions`** (derived): every fret position in the zone whose pitch class is in the configured scale — the whole scale, shown at once, computed fresh whenever root/scale/zone change. **`playedPositions`** (derived): reads `liveInput.detectedNote` directly and returns every zone position matching its pitch class — no onset gating, no store-to-store event wiring, it just tracks whatever's currently sounding and clears the instant Live Input stops detecting a note. Neither derived depends on `running` at all — this is the core of the mode's design: configuring root/scale/zone and playing along works identically whether or not the Groove Engine is going.

**The Groove Engine** (`$lib/groove/` — see AGENTS.md §4 for the full module breakdown) replaced the original single quarter-note click (`$lib/audio/metronome.ts`, deleted) by explicit product direction, then grew from a single 16-step pattern into a small multi-bar sequencer, and later gained selectable time signatures beyond the original fixed 4/4:

- **Data model** (`groove/types.ts`): a `Groove` holds four named `GroovePattern`s (roles `A`/`B`/`F`/`T` — main/variation/fill/turnaround), an `arrangement: PatternRole[]` mapping each bar of a loop to one of those roles — a 12-bar form plays back without needing twelve hand-authored patterns — and one `timeSignature` for the whole groove. Each `GrooveStep` carries a `StepVelocity` (`0`/`0.35`/`0.7`/`1` — off/ghost/normal/accent) and an optional `minIntensity`.
- **Time signature** (`groove/time-signature.ts`): one meter per groove (not per-bar/mixed-meter) — `3/4`, `4/4` (default), `5/4`, `6/8`, `9/8`, or `12/8`. A pattern's step count follows its meter (16 in the default 4/4, 12/20/12/18/24 for the others); `setTimeSignature` resizes every pattern's every voice (truncate-or-pad, same shape `setArrangementLength` uses for bars). BPM always means the quarter-note pulse regardless of meter, so a "step" stays a 16th note at that tempo and `stepDurationSeconds = 60/bpm/4` never changes — only bar length and beat-grouping (4 steps/beat for simple meters, 6 for compound) do. Feel/Amount are inert for compound meters, since their own 3-against-2 subdivision already carries a shuffle-like feel.
- **Transport** (`groove/transport.ts`'s `GrooveTransport`): the standard Web Audio "lookahead scheduler" pattern — a coarse ~25ms `setInterval` checker that schedules whatever falls within a 100ms lookahead window at precise `AudioContext.currentTime` values, so timing stays sample-accurate regardless of JS timer jitter. One instance is the sole authoritative clock for drum steps, the chord-pad backing, and the arrangement/chord-highlight bookkeeping, plus an optional count-in (a simple click cue, one count-in bar the same length as a real one in whatever meter is playing) before real playback begins.
- **Voices** (`$lib/audio/drum-voices.ts`): six synthesized voices — kick, snare, closed hat, open hat, ride, rim (oscillators + a shared noise buffer, no sample files) — each taking a `gain` parameter that step velocity maps directly onto.
- **Feel + Intensity** (`groove/feel.ts`/`intensity.ts`): Feel (Straight/Shuffle/Swing) + Amount replace a bare swing percentage — Straight is always 0 regardless of a leftover Amount value, and Amount disables entirely for a compound time signature. Intensity is a single global 0–100 control; any step's `minIntensity` gates whether it sounds at the current Intensity, so one authored groove can get progressively denser without needing a preset per density level.
- **Presets** (`groove/presets.ts`): curated genre grooves (Click, Straight/Rock, Blues Shuffle, Jazz Swing, Funk) plus a flagship 12-bar blues groove ("Chicago Shuffle") demonstrating the full model — a real `AAAB AABF ABTF` arrangement, all four pattern roles, and a few Intensity-gated decorative hits.
- **Migration** (`groove/migrate.ts`): reads any prior persisted shape (the original single boolean pattern, the pre-Feel-engine `Groove` with a bare `swing` number, the pre-time-signature `Groove` missing `timeSignature`, or the pre-Acid-Bass `Groove` missing `acidBass`) and coerces it into the current model, so existing saved grooves keep working across the data model's evolution. A migrated old groove always gets `acidBass.enabled: false`, regardless of what its default pattern contains — an old groove must not suddenly gain audible bass on load.

It carries no target, no evaluation, no per-beat grading state — same as before. Starting it happens inside the Play button's click handler, the same user-gesture requirement Live Input's `getUserMedia` call already lives under.

**The Acid Bass Engine** (`$lib/acid-bass/` — see AGENTS.md §4 for the full module breakdown, driving `$lib/audio/acid-bass-voice.ts`/`acid-bass-lfo.ts`/`acid-worklet-node.ts`) is a third accompaniment layer built entirely inside the Groove Engine above: a monophonic, 303-inspired synth bass voice, off by default, sharing the drum engine's persistence, migration, and `A`/`B`/`F`/`T` arrangement roles rather than an independent bass arrangement. Rebuilt into its current (V2) shape following a separately-supplied spec (`~/Downloads/ACID-BASS-ENGINE-V2.md`), superseding the original flat-six-macro V1 design described in earlier revisions of this document.

- **Data model** (`acid-bass/types.ts`): `AcidBassStep` (`active`, `interval: IntervalId`, `octave`, `accent`, `slide`, plus V2's software-only sequencer powers — `probability`, `ratchet` 1–4, `gate`, an optional `locks: AcidStepLocks` overriding up to five patch targets for that one step) reuses the app's existing `IntervalId` (`$lib/music/intervals.ts`) rather than a bespoke numeric interval type. `AcidBassPatch` is nested by signal-path responsibility — `oscillator` (main wave Saw/Square/Triangle/Pulse, tune/fine, an optional sub oscillator, and a second full oscillator — Osc 2, any wave including Pulse, its own independent tune/fine/level for detune/unison stacking), `filter` (model Legacy/SVF-12/Acid 24, cutoff, resonance, bipolar env amount, key tracking, saturation), `envelope` (attack/decay/release/accent), `glide` (time/curve), `lfo1`/`lfo2` (two independent LFOs, each still single-destination — shape/destination/rate-or-division/depth — not a many-to-many modulation matrix), `output` (drive/volume) — rather than six flat macros. `AcidBassState` adds `version: 3` (the migration discriminant — 1 for the original flat V1 shape, 2 for the nested-but-singular-LFO shape, 3 for the current Osc 2/dual-LFO shape) and `crossBarSlide` (default `true` for new state, `false` for anything migrated from V1) alongside `enabled`/`patch`/`patterns: Record<PatternRole, AcidBassPattern>`, still nested inside `Groove.acidBass` and resized in lockstep with the drum patterns whenever the meter changes.
- **Voice** (`$lib/audio/acid-bass-voice.ts`'s `createAcidBassVoice`): unlike the drum kit's and chord pad's fire-and-forget per-hit trigger functions, this builds one persistent node graph at creation that lives across the whole playback session, because slide/legato behavior needs to glide one running oscillator's frequency rather than crossfade between discrete note events. That graph now runs four always-running main-wave oscillators plus an optional sub and a second full oscillator (Osc 2 — a single type-switched node, the same simplification Sub uses, not a 4-way crossfaded bank like Main), a pre-filter saturation stage, a filter section, and two independent free-running LFOs (`acid-bass-lfo.ts`, one instance each) each routed to whichever single destination its own patch slot names. The filter's `acid24` model and the Pulse wave's live width modulation both run on dedicated `AudioWorkletNode`s (`acid-worklet-node.ts` loads `static/acid-filter-processor.js`/`static/acid-pulse-oscillator-processor.js`) that stay permanently connected in parallel with their non-worklet counterpart (the Biquad filter; a static `PeriodicWave` pulse) and simply crossfade in once loaded — silently falling back forever if a worklet never loads, logged to the console only, never a user-facing error. A step's `slide` glides toward the immediately following step's own pitch, or — when `crossBarSlide` is on — the next bar's first active step; the "no re-trigger at the slide destination" requirement is handled by a `legato` trigger flag on `schedule()` exactly as in V1. `ratchet > 1` fans one step out into several ordinary `schedule()` calls (resolved entirely in `scale-practice.svelte.ts`, via `sequencer.ts` — the voice itself never learns ratchets exist) and silently drops that step's own outgoing slide.
- **Transport integration**: schedules off the exact same `GrooveTransport`/swung `stepOffsetMs` timing the drums already use — never a second scheduler or a second `AudioContext`. `scale-practice.svelte.ts` resolves the harmonic root per bar (the active progression chord's root, or the practice `root` with no progression) and each step's interval → MIDI via `acid-bass/resolve.ts`'s `resolveAcidStepMidi`, reusing `$lib/music/intervals`'s `intervalSemitones` and `$lib/audio/note-mapping.ts`'s existing `midiToFrequency` — never a second harmony or pitch-mapping engine. `setBpm()` also calls the voice's `setTempo()`, since Sync-mode LFOs need live BPM.
- **UI**: Bass on/off in `PracticeSessionBar.svelte` (PLAY tier); eight nested VCO/SUB/OSC 2/VCF/ENV/LFO 1/LFO 2/OUTPUT panels, laid out as a compact responsive grid rather than stacked full-width, plus an 8-preset factory-patch picker on `BandPanel.svelte`'s Bass tab (ADJUST tier) — every control always visible (no disclosure), applied live to the running voice via `setPatch()` without restarting playback; step grid + selected-step editor (now with Probability/Ratchet/Gate and a parameter-lock disclosure) plus pattern-wide transform buttons (Rotate/Simplify/Densify/Octave shift/Clear All Locks) inside `GrooveEditor.svelte`'s "Bass Steps" sub-tab (EDIT tier), toggled against "Drum Steps" — both read the same `selectedPatternRole`, since there's no independent bass pattern-role picker.
- **Not built (and deliberately out of scope):** DAW features (piano-roll, automation lanes, MIDI export), a hardware-clone 303 faceplate UI, AI-generated bass lines, an independent bass tempo/swing/meter, polyphony, a many-to-many modulation matrix (still just two LFOs, each single-destination), an effects rack, chord/scale-aware pattern transforms (the transforms above are deliberately basic), an Intensity/velocity-gating concept of its own (every active step always sounds, modulo its own `probability` roll — no `minIntensity` equivalent), and sample-based tone generation (stays synthesized oscillators + filters).

**Fretboard rendering:** frets outside the chosen zone are dimmed (same treatment as Local Fields' `region-dimmed`, but independent state — not `fretfield.activeRegion`). Every in-scale, in-zone fret gets a soft, permanent background tint. Whatever's currently played gets its own ring on top — the two compose (tint + ring for an in-scale note actually played; ring alone for a note played outside the scale, deliberately not treated as "wrong" per AGENTS.md §22's no-wrong-note framing).

**Every fret's label** shows its interval relative to `scalePractice.displayRoot` stacked above the note name (e.g. "R / A", "b3 / C") — computed locally in `FretCell.svelte` via `intervalFromRoot`/`noteNameForPosition` against `displayRoot`, not `fretfield.root` (Scale Practice has exactly one displayed root at a time, unlike Scale Blocks' several, so this is well-defined here in a way it isn't there). `displayRoot` is the active progression chord's own root when one is showing, falling back to the practice `root` otherwise — so labels re-root to whichever chord is currently active, not a fixed tonic. The root is labeled **"R"**, the mode's one deliberate deviation from the numeric "1" every other mode uses for root — everywhere else in the app "1" is the convention (§3.1); here it isn't, by explicit request. Shown for _every_ fret, not just ones in the configured scale — a chromatic passing tone still reads its own honest interval; scale membership itself is signaled twice, not once: the background tint described above _and_ the label rendering bold, so the distinction survives even if color is hard to perceive (AGENTS.md §7's non-color-signal rule). Always both interval and note name together, deliberately not gated behind the shared Intervals/Notes/Both toggle other modes expose.

**The UI** (`src/lib/components/practice/`) is fretboard-first rather than controls-first, per the 2026 UI redesign: `ScalePracticeSession.svelte` renders `PracticeSessionBar → LiveMusicalContext → Fretboard → FretboardStatus → BandPanel → NoteInspector` — the fretboard sits immediately below the session controls, not beneath the whole drum machine. Three progressive-disclosure tiers: **PLAY** (`PracticeSessionBar.svelte`, always visible) — Root, Progression, Groove preset, Tempo, Play/Stop, Bass On/Off; **ADJUST** (`BandPanel.svelte`'s Drums/Harmony/Bass tabs, Drums the default tab always visible) — Feel/Amount, Intensity, Count-in, the "Pattern X · Bar Y/N" readout, and "Edit Groove" on the Drums side, the chord-progression strip with only the active chord's scale picker expanded on the Harmony side, Acid Bass's own VCO/SUB/OSC 2/VCF/ENV/LFO 1/LFO 2/OUTPUT panels plus its factory-patch picker (all applied live to the running voice) on the Bass side; **EDIT** (`GrooveEditor.svelte`, collapsed by default behind "Edit Groove") — Time Signature, Bars per chord, the editable `GrooveArrangementStrip` (with a chord label per bar once a progression is active), a pattern-role picker, a "Drum Steps | Bass Steps" toggle switching which pattern the step grid below it edits (both against the same pattern-role picker — Acid Bass has no independent bass arrangement), the 6-voice drum step grid or the Acid Bass step grid + selected-step editor (step count following the chosen meter either way) with expressive velocity, and a "My Grooves" save/rename/delete list via the shared Saved Material Library factory — Acid Bass's own state travels with a saved groove, the same as every other `Groove` field. `LiveMusicalContext.svelte` also holds an always-visible _read-only_ arrangement strip (same `GrooveArrangementStrip` component, a `readOnly` prop) and the Zone/position fields. `FretboardStatus.svelte` is a live-input-driven single-line readout (connection, played note, interval, fret) shown only while Live Input is enabled — additive to `NoteInspector.svelte`'s existing hover/focus-driven card, not a replacement for it. Nothing about Start/Stop should read as gating the highlight, and the PLAY tier keeps the default Practice screen simpler than the ADJUST/EDIT tiers underneath it.

**Not built (yet):** sample-based drum sounds (every voice stays synthesized, no asset-loading pipeline), arbitrary/custom pattern roles beyond the fixed four, a Pause control distinct from Stop, tempo ramps (BPM is adjusted by hand), deterministic timing/velocity humanization, a mute toggle, persistent session stats, a curated library beyond the current five presets + flagship groove, mixed/per-bar time signatures (one meter governs the whole groove), and any notion of "correct"/"on time" grading (deliberately removed — see below).

**Revision note:** an earlier version of this mode stepped through the scale one target note at a time, synced to the metronome, and graded each beat's pitch and timing. It was replaced with the always-on/real-time model above per explicit product direction — the metronome and the highlighting are more useful decoupled than combined into a graded drill.

---

## 22. Future modes

Potential extensions:

### Blues Mode

Distinguish chord tones, blue notes, chromatic approaches, and target notes.

### Walking Bass Mode

Visualize chord tones and approach paths to the next root.

### Groove Mode

Show useful target regions rather than scales. (Unrelated name collision with §21's "Groove Engine" — that's Scale Practice's rhythm/drum-machine feature, already built; this is a distinct, unbuilt fretboard-visualization idea.)

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

## 23. Accessibility

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

## 24. Testing strategy

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

## 25. Non-goals for v1

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

## 26. Success criteria

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

---

## 27. Visual Identity (2026 Rebrand)

FretField shipped a full visual rebrand in 2026-08, replacing the original soft violet/lavender look with an industrial "musical machine" identity, following a separately-supplied visual-brand spec (`FRETFIELD-REBRAND.md`). §10's own semantic hierarchy (root gets highest emphasis, structural/stable/color/tension/chromatic-approach form a descending scale, non-color signals matter) is unchanged and still the governing rule — this section records the concrete palette/component system that now implements it. See `AGENTS.md` §4/§7 for the full architecture and doctrine.

**Palette** (`src/app.css` tokens): industrial yellow (`--ff-yellow`/`--ff-yellow-dark`) for selected/structural/intentional state, near-black (`--ff-black`/`--ff-carbon`) for the app shell and machine structure, signal red (`--ff-red`) reserved exclusively for live/current/sounding state (the playhead, a connected live input, a currently-playing transport), and ivory (`--ff-ivory`) for neutral information. This mapping is stable across the product (spec §21) — red must never become a generic highlight, and yellow must never expand to cover the whole app (spec §6/§25).

**The 9-role harmonic color system is preserved, not replaced.** Root and structural move into the brand's two yellow shades (they _are_ "selected/structural" in the rebrand's own semantic model); the other seven roles (stable/extension/color/tension/alteration/chromatic-approach/avoid) keep seven distinguishable hues carrying information the brand system has no opinion on — deliberately steered away from yellow (reserved) and pure red (reserved for live signal specifically; `role-alteration` used to be visually near-identical to signal red and was moved off it for exactly this reason).

**Hardware component primitives** (`src/lib/components/hardware/`): `Led` (off/active/current, with a static glow plus an optional reduced-motion-safe pulse — every animated state has a non-motion equivalent, per spec §19), `HardwarePanel` (the yellow-chassis/black-carbon branded faceplate wrapper, used for the Groove Engine and Acid Bass specifically — not general app chrome), `HardwareButton` (primary yellow/black and secondary black/yellow variants), and `Knob` (a real rotary control — vertical-drag plus full keyboard support, `role="slider"`, `aria-valuenow` exposed but no visible numeric readout by explicit user preference), landing specifically on Acid Bass's patch macros — now three dozen-plus across its VCO/SUB/OSC 2/VCF/ENV/LFO 1/LFO 2/OUTPUT panels — per the spec's own instruction that it should be "the most explicitly instrument-like module."

**Logo**: the Field Matrix mark (a minimal bordered grid with one red signal node at a deliberate, non-center/non-corner intersection) replaced the original literal fretboard-with-strings drawing across the favicon, header mark, and README banner — chosen over the spec's other two logo directions (Fret Signal, Signal Neck) as the one that doesn't lock the identity to a literal instrument icon.
