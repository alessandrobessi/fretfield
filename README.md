# FretField

> See the harmonic field. Move through it.

FretField is an interactive bass-fretboard application that teaches the neck as a spatial field of harmonic possibilities, not a grid of shapes to memorize. Click any fret to set a root and it answers four increasingly powerful questions:

- **Chord Field** — _What can I play now?_ The full 12-tone Harmonic Field over the current chord (root/structural/stable/extension/color/tension/alteration/chromatic-approach/avoid), or a simplified Chord Tones view.
- **Progression Field** — _Where can I go next?_ Resolve a progression template (ii–V–I, I–vi–ii–V, 12-bar blues, …) from the selected root and see each note's best resolution into the next chord.
- **Voice-Leading Paths** — _What route should I take?_ A ranked list of complete fretted paths through the whole progression, scored by harmonic quality, physical movement, and position continuity — with Balanced / Minimal Movement / Guide Tones presets.
- **Local Fields** — _Where on the neck should I play it?_ Ranked, overlapping regions of the neck (not fixed CAGED-style boxes) usable as a lens under any of the other three modes.

See [`BLUEPRINT.md`](./BLUEPRINT.md) for the product concept and [`ROADMAP.md`](./ROADMAP.md) for the development plan. [`AGENTS.md`](./AGENTS.md) defines the operating rules for coding agents working on this repo.

Live app: https://alessandrobessi.github.io/fretfield/

## Stack

pnpm, TypeScript, SvelteKit, Svelte 5, Vitest, Playwright.

## Developing

```sh
pnpm install
pnpm dev -- --open
```

## Checks

```sh
pnpm lint       # prettier + eslint
pnpm check      # svelte-check / TypeScript
pnpm test:unit  # vitest
pnpm test:e2e   # playwright
pnpm build      # production build
```

## Deployment

Pushing to `main` builds and deploys the app to GitHub Pages via `.github/workflows/deploy.yml`. The build is a static export (`@sveltejs/adapter-static`) served from the `/fretfield` subpath.
