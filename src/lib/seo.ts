/**
 * The deployed site's own absolute origin+base path — no trailing slash.
 * SvelteKit's own `base` (from `$app/paths`) is the right way to build
 * internal links/asset paths (it tracks whatever `BASE_PATH` the current
 * build was configured with, see `vite.config.ts`), but canonical/Open
 * Graph/Twitter-card/sitemap URLs must be fully absolute regardless of
 * build config — crawlers and social-preview scrapers resolve them
 * independently of whatever page they were found on, so a relative URL
 * there is silently wrong. Hardcoded to the one real deployment rather than
 * derived, since this app has exactly one (GitHub Pages, `deploy.yml`).
 */
export const SITE_URL = 'https://alessandrobessi.github.io/fretfield';

export const SITE_NAME = 'FretField';

export const OG_IMAGE_URL = `${SITE_URL}/brand/og-image.png`;
