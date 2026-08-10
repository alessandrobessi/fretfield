# FretField

> See the harmonic field. Move through it.

FretField is an interactive bass-fretboard application that visualizes harmonic function relative to a selected root and chord. Click any fret to set the root, choose a chord, and see the neck light up with root/structural/stable chord tones in interval or note-name notation.

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
