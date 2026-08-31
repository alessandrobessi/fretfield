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

**Acid Bass Intelligence V4 — in progress (started 2026-08).** Following a separately-supplied "Acid Bass Intelligence V4" spec (`~/Downloads/ACID-BASS-INTELLIGENCE-V4.md`, its own 22-milestone build order, M0–M22), Acid Bass is growing from a synth attached to a manual step sequencer into an algorithmic bassline generator: a new pure `$lib/music/bassline/` domain (deterministic rhythm → harmonic candidates → chord/key/voice-leading selection via bounded beam search → controlled chromaticism → fretboard-aware register/playability realization → articulation → explanation), a new `AcidBassMode` (`'manual' | 'generated'`, manual unchanged and still the default), three new modulation sources (ENV/Accent/Random, alongside the existing LFO 1/LFO 2 — still five _single-destination_ sources, never a matrix), three distortion characters (Soft/Diode/Hard), one tempo-synced delay, and two opt-in training additions ("Learn This Line" pitch-only practice, "Shadow Mode" fretboard preview) — see `AGENTS.md` §26's Acid Bass Intelligence V4 authorization note and `BLUEPRINT.md` §21's matching note for the full doctrine and architecture boundaries. Explicitly not a resurrection of the removed Progression Field/Voice-Leading Paths modes (§17) — the new `voice-leading.ts` is internal-only bass-generator scoring logic. The spec mandates a stop-gate after every milestone (implement → verify → commit → report → wait for explicit go-ahead), a deliberate departure from this session's usual continuous-build cadence, given the scope. **Current status: M0–M18 and M22 complete; M19–M21 explicitly skipped by user decision (2026-08) -- the "first differentiating UX checkpoint" (§44), context-sensitive Bass Style recommendations (§23), the Acid Intelligence expression mapping (§22), ENV/Accent/Random auxiliary modulation (§30), Soft/Diode/Hard distortion characters (§31), one tempo-synced delay (§32), the Learn This Line pure training domain (§33, M18), and final polish (M22). M19 (GrooveTransport one-shot playback), M20 (Learn This Line UI/Live Input integration), and M21 (Shadow Mode) were deliberately skipped rather than deferred-by-default -- M18's pure `$lib/bass-training/` domain exists and is fully tested, but nothing wires it into the UI or audio yet, and there is no Shadow Mode at all. If asked to resume V4, confirm with the user whether M19–M21 should now be built before treating "M22 complete" as "V4 complete" -- the spec's own dependency graph (§44) has M22 depending on M21, which was never built.** The fretboard now overlays a fourth layer -- the generated-target path (§29) -- on top of the existing scale/root/played-note layers, computed independently in `scale-practice.svelte.ts` (a new `generatedTargetPath` derived, `GeneratedTargetNote`/`GeneratedTargetPath` types) the same "independent store, no fretfield.svelte.ts fields" way the existing Scale Practice layers already work, and rendered in `FretCell.svelte` via new `generated-current`/`generated-next`/`generated-upcoming`/`generated-alternative` classes -- an ivory outline vocabulary (never the scale's yellow tint or Live Input's red fill), with border style/width (solid-thick / dashed / dotted-thin), not color alone, distinguishing the three tiers. "At playback or preview" (§29) is handled by a new `activeGeneratedBarIndex` field mirroring `activeBarIndex`'s own existing visual-sync pattern: while running, CURRENT tracks the actually-sounding note (wrap-aware, skipping over bass rests to the nearest preceding active note); at rest, it previews the plan's own first note. Alternative positions (from `findFretPositionsForMidi`, never every same-named pitch class) are shown only for the CURRENT target, to stay compact. Absent entirely outside Generated mode, composes correctly with Live Input's own played-note layer.

**Post-M12 UX fix (user-reported, 2026-08).** M11's LINE section (Manual/Generated mode + Style/Harmony/Register/Density/Chromatic/Movement/Playability/Intelligence/New Variation + the generated bar/step inspector) had landed in `AcidBassControls.svelte` (the Band panel's own "Bass" tab, alongside the synth patch controls) -- disconnected from Groove Editor's pre-existing "Bass Steps" tab, which kept showing the stale manual step editor regardless of which mode was actually selected elsewhere. Moved the whole LINE section into `GrooveEditor.svelte`'s "Bass Steps" tab instead, directly below its own new Mode picker: Manual mode shows the original transform-row/step-grid/step-editor exactly as before; Generated mode shows the generation controls and the read-only bar/step inspector in that same place. `AcidBassControls.svelte` reverts to pure SOUND controls (Patch + VCO/SUB/OSC2/VCF/ENV/LFO1/LFO2/OUTPUT), which apply to both modes' audio regardless. One place for "the bass pattern" now, whichever mode is active, matching §27's own "Generated mode presents generated steps as read-only musical output" framing literally in the pattern-editing location rather than a separate panel. All three M10-M12 e2e files' navigation updated to match (Edit Groove → Bass Steps, not the Band panel's Bass tab); playback-specific tests also still visit the Bass tab separately, since that's what makes the "Acid Bass" panel's own "Playing" indicator visible. 51/51 relevant e2e and 486/486 unit tests still pass; verified live in-browser.

**M13 + two user-reported bug fixes (2026-08).** `$lib/music/bassline/recommendations.ts`'s `recommendBasslineStyles` (§23) ranks styles purely from the current progression's own chord-family sequence (via the existing `getChordDefinition()`, never progression template IDs) using three additive, declared-order-tie-broken heuristics (dominant-heavy -> Funk/Walking/Chromatic/Acid; minor->dominant->major subsequence -> Walking/Melodic/Chromatic; static/single-family -> Rooted/Funk/Acid) -- pure data in, ranked data out, never silently changing the user's own style selection. Surfaced in `GrooveEditor.svelte`'s Generated-mode branch as a "Recommended: X · Y · Z" line above the Style picker, each name itself a button that applies that style on click. While finishing M13 the user reported two real regressions from the Post-M12 UX-fix refactor, both fixed before M13's own report-out: (1) Generated mode's step grid had no "currently sounding" playhead highlight (unlike Manual mode) -- fixed by adding `displayedGeneratedBarIndex`/`isViewingPlayingGeneratedBar` derived values replicating the existing "follow while playing, remember the manual pick once stopped" convention (`BandPanel.svelte`'s own `activePatternRole`), plus a `.generated-step.current` CSS rule reusing the manual grid's existing red-glow `step-pulse` animation. (2) The Chromatic/Movement/Playability/Intelligence knobs appeared inert. An empirical diagnostic (`generateBassline()` run across 30 seeds at each knob's min/max) confirmed Playability genuinely worked, Intelligence is unwired by design (explicitly deferred to M14, not a bug), but Movement was completely unwired end-to-end (contradicting the spec's own line 1107: "user-level density, chromaticism, and movement settings scale/modify the style profile") and Chromaticism, though correctly threaded into `applyChromaticism`, was practically inert because `voice-leading.ts`'s beam search almost never selected the non-root/structural/stable candidates that stage's approach-slot eligibility requires. Root/structural/stable's raw dominance in `candidates.ts`'s weight table is a literal, intentional transcription of §15's own numbers and was left untouched; instead `voice-leading.ts` (a non-spec-numbered scoring layer) gained a `movement` option (interpolating repetition-vs-movement contribution by the user's own 0-100 setting, replacing a flat style-only formula) and a `chromaticism` option (a weak-subdivision-only, chromaticism-scaled boost for exactly the non-target-role candidates `chromaticism.ts` needs, never applied on strong/chord-boundary slots so it can't compete with §15's own explicit strong-slot suppression). Confirmed empirically afterward: Movement now changes output on 30/30 tested seeds; Chromaticism now changes output on a real fraction of seeds at default settings and on all tested seeds once Movement is also raised (the two knobs interact, matching the spec's own framing that they jointly "scale/modify" the style profile rather than acting in isolation). 3 new unit tests in `voice-leading.spec.ts` cover both new options directly (including the chord-boundary exclusion). All 496 unit tests, `svelte-check`, `eslint`, and the 24 relevant Acid Bass e2e tests pass; verified live in-browser (recommendation buttons apply their style, playhead highlight tracks the actually-sounding step during real playback).

**M14 (2026-08).** `$lib/acid-bass/intelligence.ts`'s `resolveAcidIntelligence` (§22) grew from M10's minimal neutral passthrough into the real bridge: `intelligence <= 0` still returns the generated articulation completely unmodified (no locks, no random-modulation), but above that it maps musical function to modest synth expression -- a chromatic-approach note gets a slightly shorter, snappier gate (scaled by intelligence, floored at the existing 10-100 gate range); an unaccented root/structural/stable ("strong destination," §18's own target-role set) note gains a chance of extra accent, scaled by both intelligence and the active style's own `accentDensity` (a busier style leans into intelligence-driven accents more readily) via a deterministic bit-mixing hash seeded off the step's own stable identity (`stepIndex`/`midi`, mirroring `sequencer.ts`'s existing `seededRoll` technique) -- never `Math.random()`, and never removing an accent the generator already decided; a tension/alteration ("high-tension") note gets a modest `envAmount` lift over the patch's own current value, clamped to the legal -100..100 range; and a deterministic -1..1 random-modulation value is now genuinely computed (still inert until Random modulation, M15, exists to consume it) rather than hardcoded to 0. Root/structural/stable dominance, gate/envAmount ranges, and every other spec-literal number stayed untouched -- this milestone only adds the mapping layer on top, per §22's own "do not change note generation here." `generatedStepToPlaybackStep` (`generated-playback.ts`) now takes the current `AcidBassPatch`/intelligence amount/style as real parameters instead of calling the bridge with no context; `scale-practice.svelte.ts`'s `scheduleGeneratedBassStep` (and its two slide-lookahead calls) thread `groove.acidBass.patch`/`generation.intelligence`/`generation.style` through at each call site. 14 new/rewritten unit tests in `intelligence.spec.ts` (zero-intelligence neutrality including a "would otherwise trigger every mapping" fixture, chromatic-approach gate shortening with a floor guard, the accent rule's positive/negative/never-removes cases -- the positive case sweeps 50 step identities rather than asserting a specific hash output, since the rule is intentionally probabilistic -- the tension/alteration envAmount lift with an explicit ceiling-clamp fixture, and full-expression determinism) plus `generated-playback.spec.ts` updated for the new call signature. 508/508 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean; 27/27 relevant Acid Bass e2e tests pass; verified live in-browser with Intelligence at 100 during real playback -- no console errors, chord/bar tracking unaffected.

**M15 (2026-08).** Three more single-destination modulation sources -- Envelope, Accent, Random -- joined `lfo1`/`lfo2` (§30), still five total, still never a many-to-many matrix (the milestone's own explicit acceptance criterion). Unlike the LFOs (continuous, free-running oscillators), all three are inherently per-trigger phenomena: `acid-bass-voice.ts` builds each as one silent `ConstantSourceNode` feeding its own 7-destination gain bank (the wider `AcidModulationDestination` set, adding Resonance/Drive -- new destinations LFO doesn't reach yet), and schedules the actual per-trigger contour (rise/hold/decay) directly inside `schedule()` rather than leaving it continuously running: Envelope reuses the filter envelope's own attack/decay timing; Accent only ever schedules a nonzero contour on an accented trigger; Random schedules one deterministic held value (`AcidBassTrigger.randomModulationValue`, -1..1) for the trigger's gate duration -- the same field M14's Acid Intelligence bridge already computes for generated-mode notes (0 for manual-mode triggers, which have no random source). All three are skipped on a legato/slide-destination trigger, matching the filter envelope's own "no fresh attack on legato" rule. The pure destination/depth math (`auxModulationDepthRatio`, `auxModulationSwing`, `resolveAuxModulationAmount`/`resolveAccentModulationAmount`/`resolveRandomModulationAmount`) lives in `resolve.ts`, unit-tested (unlike the LFO destination math, which predates this session's stricter test expectations) -- 27 new tests covering all six of the milestone's own required categories (destination mapping, bipolar depth, source enable/disable, Accent-only-on-accented-triggers, Random bounded/deterministic, and an explicit "safe parameter clamps" regression guard pinning each destination's swing constant against its own known-safe ceiling). Three new "ENV MOD"/"ACCENT MOD"/"RANDOM MOD" panels in `AcidBassControls.svelte` (On/Off, 7-option Destination picker, bipolar Depth knob) reuse the exact same snippet-based pattern LFO 1/LFO 2 already established. 522/522 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean; 15 new/updated e2e tests (panel visibility, independent per-source toggling, the widened destination set, reload persistence) plus the full pre-existing Acid Bass e2e suite (41 tests) pass; verified live in-browser with all three sources enabled at full depth during real playback -- no console errors.

**M16 (2026-08).** `$lib/acid-bass/distortion.ts`'s `getDistortionCurve` (§31) is the shared transfer-curve character both `WaveShaperNode`s (pre-filter Saturation, post-VCA Drive) now select from, replacing the single fixed curve `acid-bass-voice.ts` used unconditionally before this milestone. `'soft'` is a verbatim extraction of that pre-M16 curve (`tanh(x * 1.5)`, sample-for-sample identical -- a dedicated regression test pins this), so every existing/migrated patch (which all default to `'soft'`, per `pattern.ts`) sounds unchanged. `'diode'` models a diode clipper's asymmetric conduction (brighter/harder positive half, softer/quieter negative half); `'hard'` is a genuinely harder-edged, more squared-off knee than either. All three are pure functions of `character` alone -- `getDistortionCurve` caches one `Float32Array` per character in a module-level `Map`, so a patch edit (`setPatch()` now assigns `saturationShaper.curve`/`shaper.curve` from this cache every call) only ever reassigns which already-built curve each shaper points at, never rebuilds one, per the milestone's own "avoid rebuilding curves every note" instruction. A single shared "Character" picker lives in `AcidBassControls.svelte`'s OUTPUT panel (one control, not two independent Saturation/Drive pickers, matching `AcidDistortionPatch`'s own "shared... both controls still determine amount/pregain independently" framing). 10 new pure curve tests (bounded -1..1, monotonic, cached-instance identity, character distinctness, Diode's asymmetry vs. Soft/Hard's symmetry, Hard clipping harder than Soft at the same input, and the exact-match regression guard for Soft). 532/532 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean; 16/16 relevant e2e tests pass (including a new picker/reload-persistence test); verified live in-browser with Diode selected and Drive maxed during real playback -- no console errors.

**M17 (2026-08).** `$lib/acid-bass/delay.ts` (§32) adds one dedicated tempo-synced delay -- not a general effects rack, per `AcidDelayPatch`'s own doc comment. `delayDivisionToSeconds` derives delay time from the Groove transport's current BPM and a musical division (straight/dotted/triplet, in a beats-per-division table parallel to the LFOs' own `DIVISION_BEATS`) -- re-synced via the _existing_ `setTempo()` hook (a new `applyDelayTime` helper, called from both `setTempo()` and `setPatch()`), never a second clock. `delayFeedbackToGain` caps feedback well below unity (max 0.85) so the loop can never sustain or grow indefinitely; `delayMixToSendGain` is a genuine send amount, not a dry/wet crossfade -- the dry `outputTrim -> master` path is completely untouched, so `enabled: false` or `mix: 0` reproduces dry output exactly (the migration-default acceptance criterion, matching M16's identical guarantee for distortion). `acid-bass-voice.ts` wires one `DelayNode` with its own feedback loop as a parallel send off `outputTrim`, inserted after Drive and before master Output (the milestone's own explicit placement). A new "DELAY" panel in `AcidBassControls.svelte` (On/Off with an LED, Division picker, Feedback/Mix knobs) follows the same layout convention SUB/OSC 2 already established. 14 new pure tests covering all four of the milestone's own required categories (division math including dotted/triplet ratios and BPM scaling, feedback safety's sub-unity ceiling, disabled/dry's exact-zero send gain, and a tempo-update regression check) plus a corrected stale doc-comment pointer in `types.ts` (the `feedback` field previously pointed at "`resolve.ts`, a later milestone" from when this was only anticipated; now points at the actual `delay.ts` implementation). 546/546 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean; 18/18 relevant e2e tests pass (including new toggle/division/feedback/mix and reload-persistence tests); verified live in-browser with delay enabled, feedback and mix both maxed, during real playback -- no console errors.

**Knob glossary (user-requested, 2026-08, not part of the V4 spec).** A "Show Glossary" toggle button next to the Patch picker in `AcidBassControls.svelte` reveals a "GLOSSARY" reference panel with a one-line, plain-language explanation for every control across every synth-engine section (VCO/SUB/OSC 2/VCF/ENV/LFO 1&2/ENV MOD/ACCENT MOD/RANDOM MOD/DELAY/OUTPUT) -- one findable place for "what does this knob do," rather than scattered tooltips. Content lives in `$lib/acid-bass/glossary.ts` as pure, independently-reviewable data (a `GlossarySection[]`, one entry per control), rendered as a `dt`/`dd` definition list per section, matching the existing dt/dd convention `GrooveEditor.svelte`'s own step inspector already established. LFO 1/LFO 2 share one glossary section (their controls are identical); so do ENV MOD/ACCENT MOD/RANDOM MOD, with each source's own distinct behavior (Env follows the filter envelope's timing, Accent only fires on accented steps, Random holds a new deterministic value per trigger) called out as its own entry. Transient UI state only (`showGlossary`, not persisted). 4 new data-integrity tests (every section non-empty, unique section titles, non-empty term/description pairs, unique terms within a section) plus a new e2e test (toggle shows/hides the panel, every section heading present, closes cleanly). 550/550 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean; 19/19 relevant e2e tests pass; verified live in-browser.

**M18 (2026-08).** A new pure `$lib/bass-training/` domain (§33) -- "Learn This Line," a dedicated Acid Bass training session evaluating pitch only, not ordinary Scale Practice grading. No Svelte, DOM, audio, or Live Input coupling yet (that's M19/M20); every function takes a `BassTrainingSession` and returns a new one, the same immutable-update idiom `acid-bass/pattern.ts`/`acid-bass/sequencer.ts` already use. `createBassTrainingSession(bar)` builds a fresh `'idle'`-phase session from one generated bar's own _active_ steps only (§33: "trains one generated bar at a time" -- a rest has no pitch to evaluate). The six-phase state machine (`idle -> listen -> ready -> waiting -> feedback -> waiting|complete`) lives in `session.ts`: `startListening`/`finishListening`/`beginWaitingForNote` walk the setup phases; `recordAttempt` evaluates a played MIDI against the current target via `evaluate.ts`'s `evaluateBassAttempt` (exact-MIDI match -> `'correct'`, same pitch class in a different octave -> `'right-class-wrong-octave'` with its own distinct feedback per §33.1, otherwise `'incorrect'`) and appends the attempt without touching `targetIndex`; `advanceAfterFeedback` is the only function that ever moves `targetIndex` forward or reaches `'complete'` -- only a `'correct'` attempt advances, matching §33.5's own "remain on current target, let the player try again" default for both other outcomes. Every transition function guards its own required starting phase and is a silent no-op otherwise (never throws), the same defensive style `resolveStepLocks`/`stepShouldTrigger` already use. `summarizeBassTrainingSession` gives the "correct/total attempts" completion summary §33.5 asks for, deliberately not persisted or accumulated ("do not build long-term statistics"). 21 new tests give complete state-machine coverage per the milestone's own requirement: every transition's happy path, every phase guard's no-op behavior (including the edge case of a bar with zero active steps), both wrong-octave and plain-incorrect non-advancing outcomes, and one full end-to-end run through a failed retry, a target advance, and completion with a correct final summary. 571/571 unit tests, `svelte-check`, `eslint`, and `pnpm build` all clean -- no e2e coverage yet, since nothing here is wired into the UI or audio.

**Post-M18 UX fix (user-reported, 2026-08).** The user reported ENV MOD/ACCENT MOD/RANDOM MOD appearing "stuck on" after toggling off. Investigated thoroughly -- the enabled flag, store setter, and DSP gain scheduling in `acid-bass-voice.ts` all flip correctly (confirmed via direct state inspection and repeated toggling during live playback, no console errors); no defect found. The real problem was that these three panels had no LED and no way to see what they actually do, so an inert destination (e.g. Sub Level while Sub is off, same rule the LFOs already follow) or a subtle effect was easy to mistake for "stuck." Added an LED to each panel (matching the SUB/OSC 2/DELAY convention) and a new `AcidBassAuxModScope` component -- deliberately _not_ a continuous oscillating trace like `AcidBassLfoScope`, since these three sources are not LFOs: each only produces one shaped contribution per note trigger, never a free-running wave. The scope instead shows each source's actual per-trigger contour (rise-then-decay for Env, occasional pulses for Accent, held random values for Random), directly answering the user's own follow-up question ("do they work like the LFOs?"). New e2e regression test exercises on -> off -> LED/pressed-state clearing directly.

**M22 (2026-08, final polish for M0–M18).** Reviewed V4 as one product, per the milestone's own "review V4 as one product" instruction, scoped to what was actually built (M19–M21 explicitly skipped, see the status note above). Verified rather than re-built: keyboard accessibility (the glossary toggle and every new M15–M18 control activate correctly via keyboard, confirmed live), reduced-motion behavior (already correctly guarded on every new canvas component, including `AcidBassAuxModScope`), responsive layout (the panel grid and glossary both reflow cleanly at an 800px viewport with zero horizontal overflow, confirmed live at 12+ panels), and existing empty/error states (Generated mode's "Choose a root and progression..." message, already in place since M11). Added six genre-flavored Acid Bass factory patches (`factory-patches.ts`, spec §38's own "optional V4-specific sound presets only if clearly useful," explicitly deferred to this milestone) -- House Deep, RnB Velvet, DnB Reese, Techno Drive, and Trance Pluck each pair a recognizable genre bass character with the one V4 feature that genuinely belongs to it (Env Mod breathing the filter, a long Glide, a detuned Osc 2 through Hard distortion, Accent Mod driving Drive, and a tempo-synced LFO paired with the tempo-synced delay, respectively); Bossa Nova is a sixth, built entirely from V2-era controls for genre range. The original eight V2 presets are unchanged and still verified to override none of `modulation`/`distortion`/`delay` (spec §38's "existing patches should sound like their V3 versions"). Also added six genre-matched Groove drum presets (`groove/presets.ts`) -- House, Techno, Drum & Bass, Trance, RnB, and Bossa Nova -- so a genre choice can span both the drum groove and the bass patch. Renamed the three filter Model picker labels for clarity ("Legacy"/"SVF-12"/"Acid 24" -> "Classic"/"Smooth"/"Squelch") -- display labels only; the underlying `AcidFilterModel` ids stay `'legacy'`/`'svf12'`/`'acid24'` and remain unchanged in persisted grooves, migration, and every internal reference. Added one M22-required critical-path e2e test (`acid-bass-v4-critical-path.e2e.ts`) walking root -> progression -> enable Bass -> Generated -> choose style -> New Variation -> play -> inspect a generated note end to end; the spec's own critical-path list also names "enter Shadow or Learn This Line," omitted here since neither has a UI entry point (M19–M21 skipped). 574/574 unit tests, `svelte-check`, `pnpm lint` (prettier + eslint), and `pnpm build` all clean; 111/111 e2e tests pass (full suite, not just Acid Bass files).

**ADSR Sustain + envelope scope (user-requested, 2026-08, not part of the V4 spec).** `AcidEnvelopePatch` gained a genuine `sustain` field (0-100, percent of peak) so the amplitude envelope is a real ADSR rather than the prior AD-then-hold-at-peak shape -- `sustainToRatio` (`resolve.ts`, deliberately linear like `volumeToGain`) maps it to a gain ratio. Deliberately reuses the _existing_ Decay knob/field for both the filter envelope's own decay and the new peak -> Sustain amplitude decay, rather than adding a second "Amp Decay" control, keeping the control surface unchanged in count. `100` reproduces the pre-Sustain behavior exactly (a mathematical no-op ramp to full peak) and is the default for every new patch and every migrated one (`coercePatch`'s `coerceNumber` clamp, and an explicit `sustain: 100` in both `createDefaultAcidPatch()` and `migrateV1Patch`), so no existing/migrated groove's sound changes. `acid-bass-voice.ts`'s `schedule()` now ramps attack -> peak -> (Decay) -> sustain level, and release uses `cancelAndHoldAtTime` (new to this codebase) rather than assuming the held value is still `peakGain` -- correctly handles both a fresh note releasing mid-decay and a legato-continued note. A new `AcidBassEnvelopeScope` canvas component (ENV panel, same convention as `AcidBassLfoScope`/`AcidBassAuxModScope`) renders the actual ADSR shape from the same `attackToSeconds`/`decayToSeconds`/`releaseToSeconds`/`sustainToRatio` functions the DSP itself uses (not a stylized approximation), with a looping animated playhead and a fixed illustrative hold duration between Decay and Release (a real step's gate length isn't known at the patch-panel level) -- reduced-motion draws one static frame with no playhead. 2 new `resolve.ts` tests (linear mapping, clamping), migration tests for pre-Sustain grooves coercing to 100 and out-of-range clamping, and new e2e coverage (default/keyboard-update/reload-persistence for Sustain, plus the new scope canvas's visibility). 578/578 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 113/113 e2e tests pass (full suite); verified live in-browser -- the scope visibly reshapes as Decay/Sustain/Attack/Release are adjusted, with no console errors.

**Bass-target fretboard layer in Manual mode (user-reported, 2026-08, not part of the V4 spec).** The fretboard's own CURRENT/NEXT/UPCOMING marker (§29) was wired to `generatedTargetPath` alone, so it silently vanished the instant Acid Bass switched to Manual mode even with active, manually-programmed steps -- a real gap, not a false alarm. `scale-practice.svelte.ts` gained `manualTargetPath`, the same CURRENT/NEXT/UPCOMING shape built by walking the whole arrangement's own `AcidBassStep`s (via `resolveAcidStepMidi` + `findFretPositionsForMidi`, `preferPositionInZone` choosing a sensible physical position since manual steps have no register/zone generation setting to weigh) instead of a generated plan, and a unified `bassTargetPath` that `FretCell.svelte` now reads instead of picking `generatedTargetPath` directly -- the two source paths are mutually exclusive by construction (each `EMPTY` outside its own mode), so `bassTargetPath` is just "pick the active one." Renamed the shared `generated-*` CSS classes/aria wording to `bass-target-*` since the layer is no longer generated-only; `GeneratedTargetNote`/`GeneratedTargetPath` renamed to `BassTargetNote`/`BassTargetPath` to match. 8 new unit tests (`scale-practice-manual-target.spec.ts`, mirroring `scale-practice-generated-target.spec.ts`'s own structure) plus updated e2e coverage confirming Manual mode now shows its own marker instead of nothing. 586/586 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 113/113 e2e tests pass; verified live in-browser -- current/next/upcoming/alternative markers all render on the default manual pattern's own steps.

**Groove Editor as its own Band-panel tab (user-requested, 2026-08, not part of the V4 spec).** The 16-step grid/arrangement editor/time signature/saved grooves used to live behind an "Edit Groove" disclosure button duplicated inside both the Drums and Bass tab views, independent of which of Drums/Harmony/Bass was selected -- a workable but inconsistent two-axis toggle. `BandPanel.svelte`'s `activeTab` gained a fourth value, `'editor'`, alongside a new "Editor" tab button; `GrooveEditor` now renders as that tab's own exclusive content (mutually exclusive with Drums/Harmony/Bass, like any real tab) rather than an independently-toggled overlay appended below whichever tab happened to be active. Since Svelte destroys/recreates a component when its `{#if}` branch becomes inactive and active again, `GrooveEditor`'s own Drum Steps/Bass Steps sub-tab selection moved from local component state to a new `scalePractice.selectedStepGridTab` store field (mirroring the existing `selectedPatternRole` precedent) so it survives a round trip through another Band tab instead of silently resetting to Drum Steps. All ~20 e2e call sites that used to click "Edit Groove"/"Hide Groove Editor" (across 9 files) were updated to click the "Editor" tab, and several tests that relied on the old design's simultaneous visibility of a Drums/Bass-tab-only field (Count-in, Feel, the Acid Bass "Playing" indicator) alongside the step grid were restructured to switch tabs explicitly instead. 586/586 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 113/113 e2e tests pass; verified live in-browser.

**Generated-bassline glossary (user-requested, 2026-08, not part of the V4 spec).** `GrooveEditor.svelte`'s Generated mode (Style/Harmony/Register/Density/Chromatic/Movement/Playability/Intelligence/New Variation, plus the generated step inspector's Note/Interval/Function/Position fields) had no plain-language reference the way the Acid Bass synth's own knobs already did (`ACID_BASS_GLOSSARY`). Added `GENERATED_BASSLINE_GLOSSARY` alongside it in `$lib/acid-bass/glossary.ts` (MODE/GENERATION/STEP INSPECTOR sections), and extracted the glossary panel's shared markup/CSS -- previously only inline in `AcidBassControls.svelte` -- into a new `GlossaryPanel.svelte` component so both glossaries render identically without duplicating a CSS block. A "Show Glossary" toggle now sits at the top of Generated mode specifically (absent in Manual mode, since this vocabulary is Generated-only). 4 new data-integrity tests (`glossary.spec.ts`'s existing four checks generalized via a shared `describeGlossaryIntegrity` helper and run against both glossaries) plus a new e2e test covering hidden-by-default, toggle-shows-every-section, and absent-in-Manual-mode. 590/590 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 114/114 e2e tests pass; verified live in-browser.

**Fixed: LFO/Mod Cutoff and Resonance were silent on the default filter (user-reported, 2026-08).** The user reported "LFO 1 on Cutoff -- no audible effect." Root cause: both LFOs' and all three aux-mod sources' (Envelope/Accent/Random) Cutoff-destination gain nodes, and the aux-mod sources' Resonance-destination gain nodes, were only ever connected to the legacy `BiquadFilterNode`'s `.frequency`/`.Q` AudioParams in `acid-bass-voice.ts` -- never to the `acid24` AudioWorkletNode's own `cutoff`/`resonance` params, unlike the otherwise-parallel Pulse Width worklet wiring which does this correctly once its own worklet resolves. Since `acid24` is the _default_ filter model (`createDefaultAcidPatch()`) and crossfades in automatically within a fraction of a second of voice creation, this made Cutoff-targeted LFO/mod modulation inaudible for effectively every user who hadn't manually switched to Classic/Smooth -- including the `slow-motion` factory patch, whose entire premise ("a slow free-running LFO breathing the cutoff") was silently broken. Fixed by connecting the same gain nodes into `acid24Node.parameters.get('cutoff'/'resonance')` once that worklet loads, mirroring the Pulse Width pattern exactly for Cutoff (both params already share the same Hz scale, confirmed against the identical `peakCutoff` value both paths already receive from `retriggerFilterEnvelope`/`setPatch`). Resonance needed real unit conversion, not a direct connection: the aux-mod Resonance swing (`MAX_MOD_RESONANCE_SWING`) was tuned against the Biquad `Q` range (0.5-16), applying that raw swing to acid24's own much narrower ladder-feedback range (0-4) would have been wildly disproportionate -- routed through a new `ACID24_RESONANCE_SWING_RATIO` (`resolve.ts`) fixed-ratio scaling gain instead, so the swing lands proportionally equivalent in both filter worlds. 2 new `resolve.spec.ts` tests for the new ratio constant. This file has no unit-test coverage for its own DSP graph (an established boundary -- audio wiring is verified live, not asserted against); verified by running real playback with LFO1→Cutoff enabled at max depth against the default (acid24/Squelch) patch and confirming no console errors during the worklet's load and several bars of playback. 591/591 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 114/114 e2e tests pass.

**Real graph-connectivity tests for the Acid Bass voice (user-requested, 2026-08).** `acid-bass-voice.ts`/`acid-bass-lfo.ts` had no unit tests at all before this -- exactly how the LFO/Mod Cutoff-and-Resonance bug above shipped silently: nothing ever asserted the actual signal-graph topology, only that functions ran without throwing. Added `fake-web-audio.ts`, a minimal connection-tracking fake of the Web Audio API (vitest's `node` environment has no real one) with `isConnectedTo`/`reaches` introspection, plus a small `AudioWorkletNode` fake matching the real `acid-filter-processor`/`acid-pulse-oscillator-processor`'s own `parameterDescriptors`. Both DSP files gained a narrow, clearly-documented `__test` hook exposing otherwise-unreachable closure-local nodes (the filter, vca, LFO/aux-mod gain banks, the acid24/Pulse worklet references, the LFO's own shape gains and rate oscillators) -- zero behavior change, just read-only references already created for production reasons. `acid-bass-voice.spec.ts` (41 tests) asserts the full LFO1/LFO2 × 5-destination and Envelope/Accent/Random × 7-destination modulation routing matrix actually reaches its real targets -- critically, that Cutoff and Resonance reach _both_ the Biquad filter's AudioParams _and_ the acid24 worklet's, the exact invariant the recent bug violated -- plus filter-model/worklet-availability routing, `setPatch` enable/disable gain-zeroing, and `dispose` safety. `acid-bass-lfo.spec.ts` (11 tests) covers its shape-crossfade and rate-clamp wiring. Verified these tests actually catch the bug class, not just pass trivially: temporarily reverted the acid24 cutoff/resonance connections and confirmed exactly the 5 expected tests fail, restored, confirmed green again. 640/640 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 114/114 e2e tests pass.

**Fixed: generated bass steps' accent marker was effectively invisible (user-reported, 2026-08).** The user reported "when the Intelligence knob is set to max, I can't see slides or accents on the bass steps." Investigated the Intelligence knob's actual reach first: confirmed in code (`generation-context.ts` never reads `generation.intelligence`, `resolveAcidIntelligence` only ever adds audio-layer accent emphasis at schedule time, never touches `slide`) and live in-browser (DOM state identical before/after moving Intelligence to max, same seed) that Intelligence cannot affect the generated plan's own accent/slide flags at all -- ruled out as the actual cause. The real bug: `GrooveEditor.svelte`'s generated step grid marked accent with only a 1px→2px border-width change and slide with a border-style change (solid→dashed) -- at the grid's ~1.8rem step size, the accent border-width difference is essentially imperceptible (confirmed via a tight zoomed screenshot: an accented step and a plain one were visually indistinguishable), while the Manual step grid (`AcidBassStepGrid.svelte`) had already established a much clearer convention: explicit small "A"/"→" glyph markers, not just a border change. Brought the generated grid in line with that existing convention -- restructured `.generated-step` into a flex column with an interval line plus a small marker row (`.generated-step-markers`, same font-size/color/min-height as the manual grid's own `.markers`), keeping the border-width/dashed-style changes as secondary reinforcing cues rather than the only signal. New e2e test scans the generated arrangement for both an accented and a sliding step and asserts the marker text is actually present. 640/640 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 115/115 e2e tests pass; verified live in-browser -- "A"/"→" now read clearly at the grid's actual on-screen size.

**Generated-mode bass-steps UI compaction (user-requested, 2026-08).** `GrooveEditor.svelte`'s Generated mode stacked eight-plus full-width rows (Show Glossary, Recommended styles, Style, Harmony, Register, the five generation knobs, New Variation) each as its own flex-column child, each carrying `HardwarePanel`'s own 12px row gap -- unnecessarily tall for how few controls actually need their own line. Regrouped into three rows: the glossary toggle and style recommendation now share one line (`.generation-header-row`, space-between); Style/Harmony/Register share one wrapping flex row (previously three full-width `pickerField` rows); the five knobs and New Variation share the existing knobs row instead of New Variation getting its own line. No functional change -- purely a layout regrouping of controls that already existed, verified live in-browser.

**Live audio-tap scopes: OUTPUT and DELAY (user-requested, 2026-08, not part of the V4 spec).** The user asked whether the combined result of every bass-engine element could be shown on a graph, distinct from `AcidBassLfoScope`/`AcidBassEnvelopeScope`/`AcidBassAuxModScope`, which are all client-rendered re-creations from patch values rather than a literal tap on the real signal (each says so in its own doc comment). Added a genuine `AnalyserNode` tap: `AcidBassVoice.outputAnalyser`, connected to `master` (post-oscillators/filter/envelope/modulation/distortion/delay -- everything that reaches `destination`), read every frame by a new `AcidBassAudioScope.svelte` (spectrum on top, waveform below, idle state clearly labeled rather than a blank canvas) mounted in the OUTPUT panel. A follow-up request asked for the same treatment under the DELAY panel specifically; added a second tap, `delayAnalyser`, connected directly to `delayNode`'s own output -- the wet/echo signal alone, before it's summed with the always-present dry path into `master` -- so the DELAY panel's scope reads as "off/silent" exactly when `delaySend.gain` resolves to 0 (delay disabled or its mix at 0), not a copy of the OUTPUT panel's fuller signal. `AcidBassAudioScope.svelte` (originally `AcidBassOutputScope.svelte`, renamed once it gained a second call site) takes a plain `analyser: AnalyserNode | null` plus an optional `idleLabel`, so both panels share one implementation. `fake-web-audio.ts` gained `FakeAnalyserNode`/`createAnalyser()` for `acid-bass-voice.ts`'s own graph-construction tests; two new connectivity tests assert `outputAnalyser` is reachable from the same chain that reaches `destination`, and that `delayAnalyser` is directly (one-hop) connected to `delayNode` but not to `outputAnalyser`, i.e. genuinely a separate tap. Verified live in-browser with real playback: the OUTPUT scope shows a full decaying spectrum plus an active waveform during a note; the DELAY scope, with delay on, shows a smaller decaying spectrum from the echo alone and stays flat when delay is off -- both confirmed via zoomed screenshots, with no console errors during playback. 642/642 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 116/116 e2e tests pass.

**Chord Pad FX rack: Reverb, Delay, Chorus -- stage 1 of 2 (user-requested, 2026-08).** The user asked for a set of FX (reverb/chorus/phaser/flanger/delay/tremolo) "for the pads" -- the chord-backing pad (`$lib/audio/chord-voices.ts`'s `triggerChordPad`), which until now had no persisted state or controls of its own at all: every hit's final `envelope` node connected straight to `ctx.destination`. Given six effect types was roughly Acid-Bass-V2-sized scope, staged it: this pass covers Reverb + Delay + Chorus; Phaser/Flanger/Tremolo are an explicit, deliberate follow-up, not built here. New self-contained domain `$lib/chord-pad-fx/` (types/resolve/pattern/migrate) mirrors `$lib/acid-bass/`'s own split rather than reusing `acid-bass/delay.ts`, which documents itself as scoped to Acid Bass only -- `Groove` gains `chordPadFx: ChordPadFxState` (`version: 1`), sibling to `acidBass`, with its own `groove/migrate.ts` branch (`PreChordPadFxGroove`) and unconditional fallthrough coercion, same doctrine as `acidBass` gets. `$lib/audio/chord-pad-fx.ts`'s `createChordPadFxBus(ctx)` builds one persistent Chorus -> Delay -> Reverb node graph per playback session (created/torn down in `start()`/`stop()` alongside `audioContext`, same lifecycle as `acidBassVoice`); `triggerChordPad` gained a required `destinationNode` parameter so every hit routes through the bus's `input` instead of `ctx.destination` directly. Each stage is a genuine dry-signal-preserving insert (its own always-on dry path plus one mix-scaled send into that stage's own wet processing) -- disabled or `mix: 0` reproduces exactly dry output, the same invariant Acid Bass's own delay established. Reverb is a small algorithmic (Freeverb/Schroeder-style) comb+allpass network -- 3 parallel comb filters (`DelayNode` + feedback `GainNode` + a damping lowpass `BiquadFilterNode`, fixed/spread-apart delay times) summed through one native `type: 'allpass'` `BiquadFilterNode` -- not a convolution reverb, since this app has no external impulse-response asset anywhere and a `ConvolverNode` would need a generated noise buffer rebuilt on every patch edit plus new `fake-web-audio.ts` primitives; "Size" controls each comb's own feedback gain (the real Freeverb mapping for room size/tail length), "Damping" controls the feedback-loop lowpass cutoff. Delay reuses Acid Bass's exact division-set shape as its own duplicated type (`ChordPadDelayDivision`). Chorus is one modulated short delay (LFO into `delayTime` via a scaling gain, the same idiom `acid-bass-voice.ts` uses everywhere) with no feedback -- feedback plus a short base delay would make it a flanger instead, deliberately deferred. New `ChordPadFxControls.svelte` gives each effect its own `HardwarePanel` (On/Off button + LED, knob macros, Delay's own division picker), mounted under the Harmony tab -- matching `AcidBassControls.svelte`'s exact visual/interaction language, per the user's explicit request. `chord-pad-fx.ts` gained a narrow `__test` seam (same rationale as `acid-bass-voice.ts`'s own) enabling real connectivity/behavior tests via `fake-web-audio.ts` -- no harness extension needed, since every node type used (`DelayNode`/`GainNode`/`BiquadFilterNode`/`OscillatorNode`) was already faked. Verified live in-browser: panels render correctly, knobs/toggles update state and survive a reload, and playback with Reverb+Delay+Chorus all enabled across several bars of a 12-bar blues progression produces no console errors, with the Reverb/Delay stages confirmed to still sound like dry passthrough when off (matching pre-change behavior exactly). 671/671 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 122/122 e2e tests pass (6 new).

**Chord Pad FX rack: Phaser, Flanger, Tremolo -- stage 2 of 2, completing the six-effect set (user-requested, 2026-08).** The user said "continue" after stage 1 (Reverb/Delay/Chorus) shipped, picking up the explicitly-deferred Phaser/Flanger/Tremolo. `ChordPadFxState.version` bumped `1 -> 2`: `chord-pad-fx/migrate.ts` gained a real version-branch migration (an old `version: 1` groove's `reverb`/`delay`/`chorus` values survive completely unchanged, `phaser`/`flanger`/`tremolo` default off/neutral) -- `groove/migrate.ts` itself needed no changes at all, since it already runs `chordPadFx` through `coerceChordPadFxState` unconditionally regardless of that state's own internal version. Signal order extended to Chorus -> Phaser -> Flanger -> Tremolo -> Delay -> Reverb -> destination, grouping all four modulation effects ahead of the two time-based ones (the standard pedalboard convention). Phaser is an LFO-swept series of 4 native `type: 'allpass'` `BiquadFilterNode`s, one shared LFO driving every stage's own frequency together via a scaling gain -- the classic phaser topology, free given the allpass filter type Web Audio already provides natively (the same reasoning Reverb's own allpass diffusion stage from stage 1 already established). Flanger reuses Chorus's exact "one modulated `DelayNode`" primitive plus a feedback loop -- literally what stage 1's own Chorus doc comment already said would turn it into a flanger, now built: a shorter base delay (~3ms vs Chorus's 18ms) plus that feedback give it its own resonant "jet" character. Tremolo is the one genuine exception to every other stage's dry/wet-insert shape -- it doesn't add a wet signal on top of dry, it directly modulates the amplitude of the one signal passing through: a single `GainNode` in series, its own `.gain` driven by an LFO between `1` and `1 - swing`; no separate `mix` field exists for it at all (`ChordPadTremoloPatch` has just `enabled`/`rate`/`depth`) -- `enabled: false` or `depth: 0` both hold that gain at a constant `1`, the same "reproduces dry exactly" invariant every other stage keeps, just reached a different way. `ChordPadFxBus`'s `__test` hook extended with representative nodes for all three (one allpass stage, matching the existing "one representative, not all N" pattern the 3 comb filters already used). `ChordPadFxControls.svelte` gained three more panels -- Tremolo's deliberately has no Mix knob, just Rate/Depth. Verified live in-browser: all six panels lay out correctly, each new effect's toggle/knobs update state, playback with all six effects enabled at audible settings across several bars produces no console errors, and every setting (old and new) survives a reload. 688/688 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 125/125 e2e tests pass (9 in this file, 3 new).

**Fixed: the Chorus/Phaser/Flanger (and Tremolo) Rate knobs felt broken (user-reported, 2026-08).** The user reported "something off with the rate knobs of chorus, phaser, and flanger." Root cause: `ChordPadFxControls.svelte`'s `knobField` snippet never threaded a `step` parameter through to `Knob.svelte`, so every Rate knob -- these four are real Hz values, not the usual 0-100 macro every other knob in this panel uses -- silently fell back to `Knob`'s own default step of `1`. For Phaser's 0.05-2 Hz range that meant only three reachable values (`0.05`, `1`, `2`): confirmed live via `aria-valuenow` that a single arrow-key press jumped the knob from `0.3` straight to `1`, a third of its entire range in one step. Fixed by adding a `step` parameter to `knobField` and passing an appropriate fine step at each Rate call site (Chorus `0.05`, Phaser/Flanger `0.01`, Tremolo `0.1` -- fixed for the same reason even though the user didn't report it, same file/same root cause). New e2e regression coverage on all four locks in the fix: `Home` then a single `ArrowUp` must land within the knob's own fine step of `min`, not jump toward `min + 1`. 688/688 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 125/125 e2e tests pass.

**Chord Pad FX rack: Fuzz -- an unplanned third addition, beyond the originally-requested six-effect set (user-requested, 2026-08).** The user asked "can you add a fuzz to the harmony panels?" -- not part of the original six-effect ask (reverb/chorus/phaser/flanger/delay/tremolo), so this genuinely grows the rack to seven. `ChordPadFxState.version` bumped `2 -> 3`: `chord-pad-fx/migrate.ts` gained a second version branch (a `version: 2` groove's six existing effects survive completely unchanged, `fuzz` defaults off/neutral; a `version: 1` groove now also defaults `fuzz` off/neutral alongside its existing phaser/flanger/tremolo defaulting) -- `groove/migrate.ts` again needed no changes, unconditional coercion already covers it. Fuzz is first in the signal chain (`Fuzz -> Chorus -> Phaser -> Flanger -> Tremolo -> Delay -> Reverb -> destination`), the standard pedalboard convention -- distortion ahead of modulation and time-based effects, so everything downstream processes the already-fuzzed signal. Implementation mirrors Acid Bass's own `driveToPregain`/`saturationToPregain` idiom exactly: one fixed hard-clip `WaveShaperNode` curve (a steep `tanh`, generated once, never regenerated per patch edit) with `Drive` acting only as the pre-gain feeding into it -- not a per-character curve set like Acid Bass's Soft/Diode/Hard distortion, since this rack has no character picker and one fuzz character is proportionate to what was asked. Same dry-path-plus-mix-scaled-wet-send insert shape every other stage but Tremolo already uses. New `FUZZ` panel (Drive/Mix knobs only) placed first in the grid, matching its signal-chain position. Verified live in-browser: panel renders, Drive/Mix update state and survive a reload, playback with Fuzz enabled at a boosted Drive alongside the other six effects produces no console errors. 696/696 unit tests, `svelte-check`, `pnpm lint`, and `pnpm build` all clean; 126/126 e2e tests pass (10 in this file, 1 new).

Live browser verification caught and fixed a real CSS cascade bug: when current/next/upcoming happened to land on the same physical fret (a repeated root two or three notes in a row -- allowed by M9's own repetition-tolerance fix), the _weakest_ tier's style was winning the cascade instead of the strongest, because all three ::before rules shared equal specificity and the weakest was declared last; fixed by reordering the rules weakest-to-strongest and adding an explicit `opacity: 1` to the strongest rule (a separate CSS property the border-only override didn't reset).

Also discovered scale-practice.svelte.ts (and Svelte 5 rune-based stores generally) CAN be unit-tested directly via `new ScalePracticeStore()` in plain Node/vitest -- runes evaluate synchronously outside a component context too. This had been assumed impossible in M10/M11 (no prior test file existed to prove otherwise); M12's own store-level test file (`scale-practice-generated-target.spec.ts`) is the first to use this, and directly covers all four of M12's own required test assertions (exact-MIDI mapping, current/next ordering, generated-layer-absent-in-Manual, played-note-remains-visible) at the correct layer, with 3 e2e tests as DOM-level backup. 9 new tests (6 store unit + 3 e2e) for this milestone; 486/486 unit and 51/51 relevant e2e all pass. `pnpm check`/`pnpm test:unit`/`pnpm build` all clean. `AcidBassControls.svelte` gained a new **LINE** section above the existing SOUND controls (§27's own conceptual layout, adapted to the existing component rather than a new file, reusing its already-established `pickerField`/`knobField` snippets): the Mode picker (relocated here from its M10 spot), then -- only in Generated mode -- Style/Harmony/Register pickers, five Density/Chromatic/Movement/Playability/Intelligence knobs, a New Variation button (reseeds only, per §26: "assign a new seed; do not mutate the current plan in place" -- `generatedBasslinePlan` is derived, so reassigning the seed is the entire implementation), and a compact generated bar strip + step grid + inspector (§28: note/interval/function/harmonic explanation/preferred fret-string per selected step, accent/slide shown via border weight/style rather than color alone). "Choose a root and progression above to generate a bassline" replaces the bar selector/inspector when `generatedBasslinePlan` is null, per §27's own "clearly explain why it is unavailable" instruction. New store setters (`setAcidBassGeneration*`, `newAcidBassVariation`) follow the existing `updateAcidBassPatch`-style immutable-update pattern. No internal numeric scores (localScore, DP cost, etc.) are ever surfaced -- only musical language. Verified live in-browser before writing tests (a real contrast bug was found and fixed this way: the step inspector's labels were rendering in a yellow too close to the panel's own gold background to read -- fixed by switching to opacity-based de-emphasis, matching the rest of the app's existing label convention). 8 new e2e tests (pickers, knobs, reload persistence, unavailable-messaging, New Variation, bar switching, step inspection) pass alongside all 30 pre-existing Acid Bass e2e tests. `pnpm check`/`pnpm test:unit`/`pnpm build` all clean, per M11's own acceptance criterion. `$lib/acid-bass/intelligence.ts`'s `resolveAcidIntelligence` is the minimal neutral Acid Intelligence adapter (§22) -- passes a generated step's own accent/gate straight through with no extra locks and no random-modulation contribution; its full musical mapping table (chromatic approach -> shorter gate, strong destination -> more accent, etc.) is deferred until modulation (M15)/distortion (M16) exist to receive those offsets. `$lib/acid-bass/generated-playback.ts`'s `AcidPlaybackStep` is the common audio-ready scheduling shape both playback paths resolve to (§25.3) -- `manualStepToPlaybackStep`/`generatedStepToPlaybackStep` convert `AcidBassStep`/`GeneratedBassStep` into it without forcing either into the other's data shape. `scale-practice.svelte.ts` now owns the full integration (§25): a `generatedBasslinePlan` derived (null in manual mode, or with no root/progression), a `currentBarGeneratedBassBar` per-bar cache resolved in `handleBarStart` exactly like the existing manual cache (and refreshed the same way on a mid-bar meter change), and a new `scheduleGeneratedBassStep` sharing the exact same swung step time / `AcidBassVoice` / cross-bar-slide concept as the manual path, branched on the new `groove.acidBass.mode` at `handleStep`. Generated steps are always `probability: 100, ratchet: 1` (§25.4, already guaranteed by the type). A minimal Manual/Generated `Mode` picker was added to `AcidBassControls.svelte` (§27's own allowance: "no new UI beyond minimal mode control if necessary") -- the full generator UI (style/harmony/density/etc. knobs, generated-line visualization) is M11. Verified live in-browser (generated playback audible across chord/bar changes, mode-switch mid-playback, no console errors) and via 5 new e2e tests plus 10 new unit tests; the sound-patch-only-change-never-regenerates requirement (§26) holds by construction -- the derived never reads `groove.acidBass.patch`. `$lib/music/bassline/explanations.ts`'s `buildNoteExplanation` produces every `BassNoteExplanation` from data the generator already computed (interval/role/function/target) -- never reverse-engineered later in Svelte -- reusing `roleCharacter()` for the generic chord/scale-tone case and `resolvedChordSymbol()` for chord labels rather than duplicating either. `generate.ts` now exports `generateBassline(context)`, the complete pure feature (§43 M9's own acceptance criterion): pipeline stage 6 (accent/slide/gate articulation, inline in `generate.ts` since §20 names no dedicated file) rewards accent on strong chord targets/root-on-strong-beat/important syncopation in Funk-Acid/the destination after a chromatic approach/turnaround arrival (never unconditionally -- "do not accent every root"), rewards slide only toward a genuinely adjacent semitone/whole-step active event (cross-bar `crossBarSlide` gating is a patch-level concern deferred to M10's store integration, since this pure module has no access to `AcidBassPatch`), and derives gate from style `preferredGate` with modest contextual adjustments, clamped 10-100. `generateBasslineSkeleton()` (M6-M8) and `generateBassline()` now share one internal `runPipeline()` helper rather than duplicating stages 1-5. Fixing M9's own tests surfaced a real scoring gap in `voice-leading.ts` (M6): root's flat harmonic dominance let a beam lock onto repeating the same pitch class indefinitely, starving `chromaticism.ts` of any eligible non-target material to transform -- fixed by adding an escalating repetition penalty (`BasslineBeamState.consecutiveRepeats`, tolerance scaled by each style's own `repetitionPreference`) so no style's raw harmonic dominance can lock a line onto one pitch forever; confirmed empirically to restore real chromatic-approach/diatonic-approach/scale-tone variety in generated output. `$lib/music/bassline/playability.ts`'s `realizeSequence` is pipeline stage 5: converts a pitch-class sequence into actual MIDI + fretboard positions via `findFretPositionsForMidi()` (never a new fretboard mapping), with low/mid/high register modes scored by MIDI-center distance and zone mode preferring in-zone positions whenever at least one exists there (falling back to the nearest legal realization, marked `fallback`, otherwise -- the pitch class itself is never silently altered to stay in-zone). Physical/register cost (fret distance, string distance, large-shift penalty, register distance) is resolved via dynamic programming across the whole sequence, globally coherent rather than greedy, and every penalty term is scaled by `playability / 100` -- at `playability = 0` the DP has no physical preference left at all and just returns the first legal realization per note, independent of its neighbors. `generate.ts` now wires pipeline stages 1-5 together end to end: rhythm -> candidates -> voice-leading -> `chromaticism.ts`'s transforms (finally applied here, replacing a transformed slot's pitch class/interval/role and recomputing them against its bar's chord) -> `playability.ts`'s realization. `BasslineSkeletonNote` now carries a real `midi`/`preferredPosition`/`alternativePositions`/`registerFallback` per note; only accent/slide/gate/explanation and the final `GeneratedBasslinePlan` assembly remain, for M9. `$lib/music/bassline/chromaticism.ts`'s `applyChromaticism` transforms an already-selected line (§18 pipeline stage 4) rather than widening the candidate pool: it proposes lower/upper chromatic-approach, diatonic-approach, and two-note enclosure replacements for weak-subdivision, non-target-role notes immediately preceding a root/structural/stable target, with every proposed transform resolving to a real (possibly wrap-around) target by construction -- there is no such thing as a dangling chromatic note. Strong-beat/beat-group-start notes and existing root/structural/stable selections are never touched (the "prefer weak subdivisions" rule and the "never overwrite a stronger target" rule collapse into one hard eligibility check), enclosure only ever fires with two genuinely eligible adjacent slots, and `chromaticism <= 0` is a guaranteed no-op. Deliberately its own pure module independent of `generate.ts`'s shape (its own minimal `ChromaticismNoteInput` contract) -- wiring it (and the new `playability.ts`) into the actual pipeline is M8's job. `$lib/music/bassline/voice-leading.ts`'s `selectVoiceLeadingSequence` picks one candidate per active slot via a bounded beam search (width 8), implementing all three `BassHarmonyMode`s: Chord mode keeps today's root/chord-tone-forward Acid Bass semantics; Key mode rewards repeating the previous slot's `intervalFromKey` (a key-relative motif surviving a chord change underneath it); Voice Leading mode weights §17's circular-pitch-class-distance transition reward (common tone strongest, down through the largest possible circular distance) far more heavily than the other two, verified to favor smoother resolutions (e.g. a G7 b7 resolving a half-step to Cmaj7's 3rd) over a higher raw harmonic candidate that would otherwise win under Chord mode. `$lib/music/bassline/generate.ts`'s `generateBasslineSkeleton` is the first cut of the pipeline's stage-1-through-3 wiring (rhythm -> candidates -> voice-leading), producing a multi-bar pitch-class-level `BasslineSkeleton` -- intermediate notes stay at `BassPitchCandidate` granularity per §17's own allowance, no chromatic transform or register/MIDI realization yet (M7-M9). A statistical test (60 seeds) confirms Voice Leading mode's average G7->Cmaj7 bar-boundary pitch-class distance is smaller than Chord mode's under the same context, without any progression-specific hardcoded rule -- the behavior emerges from the general transition-reward table. `$lib/music/bassline/styles.ts` now defines the six spec-mandated `BasslineStyleProfile`s (Rooted/Funk/Acid/Chromatic/Melodic/Walking) as pure weighted data -- one generation engine driven by style weights, not six separate implementations -- covering rhythmic character, per-source candidate-scoring weights (root/chord/scale/chromatic-approach/enclosure/passing-tone, read by later milestones), movement/repetition/register tendencies, and articulation defaults (accent/slide/gate). `$lib/music/bassline/rhythm.ts`'s `generateBarRhythm` produces a per-bar active/rest mask ahead of pitch generation, driven by an explicit (spec-unspecified, self-documented) activation-probability formula weighted by `strongBeatTargeting`/`syncopation`/`rhythmicDensity` and phrase-role transforms (`variation` a flat lift, `fill` concentrated in the bar's second half, `turnaround` concentrated in the final beat group) -- meter-agnostic throughout (`meter.stepsPerBar`/`stepsPerBeatGroup` read directly, verified across simple and compound meters, never a hardcoded 16), the bar's own downbeat always active regardless of density so a line never loses its anchor. Both new files take an already-created `BasslineRandom` instance rather than a raw seed, establishing the pattern a later `generate.ts` will use to thread one PRNG across an entire multi-bar plan. `$lib/music/bassline/candidates.ts`'s `generateHarmonicCandidates` now produces root/chord/scale `BassPitchCandidate`s for one active rhythmic slot, reusing the existing harmonic engine (`analyzeInterval()`/`isChordTone()`/`roleStability()`/`roleTension()`) rather than a new chord-role table -- `avoid`-role tones are excluded from the candidate pool entirely, and each candidate's `localScore` reflects only §15's `harmonicScore` component (a centralized, independently-tested weight table with a strong-slot boost/suppression derived from `roleStability()`/`roleTension()`, not a second hand-picked table); the remaining score components (`styleScore`/`beatPlacementScore`/`harmonyModeScore`/`repetitionScore`/`movementScore`) are explicitly deferred to `generate.ts` (M6); chromatic candidates remain explicitly out of scope until `chromaticism.ts` (M7). `AcidBassState.version` is now `4` (mode/generation settings, plus patch-level modulation/distortion/delay sub-objects, all neutral/off by default); every V1/V2/V3 groove migrates through unchanged and lands in `mode: 'manual'`. A pure `$lib/music/bassline/` domain now exists (`types.ts`'s full context/result type skeleton, `random.ts`'s deterministic Mulberry32 PRNG, `context.ts`'s wrap-aware `buildBarContexts`/`validateBasslineGenerationContext`/`lcm`), with zero Svelte/DOM/audio/Groove imports -- verified both by grep and by its own layering (`$lib/acid-bass/types.ts` re-exports `BasslineStyleId`/`BassHarmonyMode`/`BassRegisterMode` from here rather than duplicating them). `$lib/acid-bass/generation-context.ts`'s `buildAcidBassGenerationContext` now bridges current Scale Practice/Groove state (root, resolved progression, per-chord scales, `barsPerChord`, arrangement, meter, zone, tuning) into a `BasslineGenerationContext`, expanding the progression/arrangement composite cycle via `lcm` and mapping `A/B/F/T` to `main/variation/fill/turnaround` -- the one file allowed to depend on both Groove types and the pure bassline domain. Still no actual note generation, DSP, or UI -- this adapter isn't wired into the store yet either (that starts at M10). Update this line as subsequent milestones land — do not let it silently go stale the way past specs' completion notes have not needed to.

**Visual Rebrand — done, and current (2026-08).** Following a separately-supplied visual-brand spec (`FRETFIELD-REBRAND.md`), the app moved from its original soft violet/lavender look to an industrial yellow/near-black/signal-red "musical machine" identity: a full `src/app.css` design-token rewrite, a near-black app shell (replacing the old glow-gradient light background), a new reusable hardware component set (`Led`/`HardwarePanel`/`HardwareButton`/`Knob`, in `$lib/components/hardware/`), and a new Field Matrix logo (an abstract grid with one red signal node) replacing the original literal fretboard-with-strings mark across the favicon, header, and README banner. The 9-role harmonic color system (§7 above) was deliberately preserved rather than collapsed into the two brand colors — root/structural moved into the brand's own yellow shades since they already meant "selected/structural," while the other seven roles kept distinct hues steered away from both yellow and signal red. The Groove Engine (above) is the rebrand's flagship surface — a yellow chassis with black step keys and a red pulsing playhead — with Acid Bass reusing the exact same component system rather than a separate visual vocabulary, per the spec's own instruction. See `AGENTS.md` §4/§7 and `BLUEPRINT.md` §27 for the full current token/component system and the design calls behind it (why the 9-role palette survived, why the idle Play button doesn't recolor when running, why `--role-alteration` moved off red).

Everything from the six-mode/Guided-Practice/Saved-Material-Library era's own "beyond 1.0 boundary" list is moot now that most of that era's product surface is gone; any future scope decision should start from the current two-feature app, not from this history.

**Mixer: independent Drums/Chords/Bass channel volume (user-requested, 2026-08).** The user said "I think we need a mixer to handle the volume of drums, pads, and bass" -- until now the three Groove Engine voices had inconsistent gain staging: Acid Bass already had a persistent `master` GainNode driven by `patch.output.volume` (an existing OUTPUT > Volume knob), the chord pad's FX bus (`chord-pad-fx.ts`) summed to an implicit, never-adjustable gain of 1, and drums had no shared bus at all -- each of the six trigger functions in `drum-voices.ts` connected straight to `ctx.destination`. Extracted the existing `volumeToGain` headroom curve (0-100 -> 0-0.9 gain) into a shared `$lib/audio/gain.ts`, threaded a `destinationNode` through every drum trigger function (mirroring `chord-voices.ts`'s own `triggerChordPad`) behind a new `createDrumsBus`, and added a `channelGain`/`setVolume` stage to the chord pad's FX bus. `drumsVolume`/`chordsVolume` (0-100, default 100) persist as new top-level session state alongside `intensity` -- not nested in `Groove`, since a mix balance is a listening preference, not authored musical content; the Bass fader has no sibling field of its own, reusing `patch.output.volume`/`setAcidBassVolume` directly. `BandPanel.svelte` gained a fifth "Mixer" tab (between Bass and Editor) holding the 3-fader strip -- first shipped as an always-visible strip above every tab, then moved into its own tab per direct user correction ("mixer should have its own tab, it should not be in the harmony section"), then restyled from plain `<input type="range">` sliders to the same rotary `Knob` component every other volume/level control in the app already uses ("can the sliders be more aligned to the style of the app?") -- the browser-default sliders were the one control in the whole app not using the hardware-synth visual language.

**Fixed: the Bass tab's Patch picker forgot the applied patch after switching to another Band tab (user-reported, 2026-08).** The `<select>` had no `value` binding at all, so it always displayed the browser's own default ("Choose a patch…") on mount rather than the actually-applied patch -- invisible while staying on the Bass tab, but `BandPanel.svelte` unmounts `AcidBassControls` whenever another tab is selected, so returning to Bass always showed the picker reset even though the patch's actual values were untouched. Fixed by tracking the last-applied factory patch id on the store (`selectedAcidBassFactoryPatchId`, session-only, same "survives remount" shape `selectedStepGridTab` already established) and binding the `<select>`'s `value` to it.

**The Groove Engine's Amount/Intensity sliders restyled to match the Mixer (user-requested, 2026-08 -- "do the same also for the sliders in the drums panel").** Following straight from the Mixer's own slider-to-knob restyle, the Drums tab's Amount and Intensity controls were the last plain `<input type="range">`s left anywhere in Scale Practice's UI. `Knob.svelte` gained two new optional props to make this possible -- `disabled` (dims the knob, sets `tabindex="-1"`/`aria-disabled`, blocks pointer/keyboard input) and `title` (an explanatory tooltip on the same element `aria-label` lives on) -- since Amount already had both (disabled when Feel is Straight or the meter is compound, with a tooltip explaining the compound-meter case) and no existing `Knob` usage anywhere in the app had needed either before. Now every volume/level control in Scale Practice is the same rotary `Knob`, with no plain range input left.

**Radio Mode — built, then removed by direct follow-up request (user-requested, 2026-08).** Briefly existed as a standalone, unlisted `/radio` page: an autonomous 24/7 stream (reusing the `scalePractice` singleton + a `RadioDirector` timer rolling fresh root/progression/groove/bass-style/tempo combos, plus a full-bleed audio-reactive visualizer) meant to promote FretField on YouTube. Shipped across several commits, including a real bug fix (the bass wasn't audible -- a `GroovePreset`'s own baked-in `Groove` was silently disabling Acid Bass on every rotation) and a scope narrowing (genre pinned to Trance only). The user then asked to remove it entirely and build a Tuner instead -- every Radio-specific file, and the additive-only store/bus changes that existed solely to support it (`persistEnabled`, `masterAnalyser`/`getMasterAnalyser()`, `ChordPadFxBus.output`), were deleted rather than left dormant. Do not resurrect any of it without an explicit, direct product request.

**Tuner — a string-aware tuner tab in Practice's Band panel (user-requested, 2026-08, direct follow-up to the Radio removal above -- "remove the radio feature and include instead a tuner feature").** Two placement/scope questions were settled up front via AskUserQuestion: it lives as a new "Tuner" tab in `BandPanel.svelte` (a mode within Practice, not a third destination -- keeps AGENTS.md's "deliberately two destinations" rule intact), and it's string-aware rather than a generic chromatic tuner -- it identifies which of the bass's 4 open strings (E/A/D/G) a detected pitch is closest to, shows cents off, and explicitly flags a note far from any open string as a likely fretted note rather than mistuning. Turned out to be a cheap feature: Live Input's existing YIN pitch detection already computes everything needed (`DetectedNote.midi`/`.cents`), so the only new code is a small pure module, `src/lib/music/tuner.ts` (`findClosestOpenString`, `centsFromOpenString`, `classifyTunerStatus`), plus `TunerControls.svelte` reading the `liveInput` singleton directly -- no new DSP, no new persisted state, no second Live-Input-enable flow. Reused the brand palette's existing yellow="in tune"/red="off" semantics rather than adding a green token (the palette is deliberately monochrome-plus-signal-red). Shipped across 3 milestones (pure math + unit tests; component + BandPanel wiring, including a live-verified yellow-on-yellow contrast bug fixed by giving the tab's `HardwarePanel` `tone="carbon"`; e2e tests + docs), each with a full gate and green CI.

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
