/**
 * Extracted from `groove/types.ts` into its own leaf module (no dependencies
 * of its own) so `acid-bass/types.ts` can depend on `PatternRole` without
 * creating a cycle back through `groove/types.ts` (which itself needs to
 * import `AcidBassState` from `acid-bass/types.ts` to nest it inside
 * `Groove`). `groove/types.ts` re-exports from here, mirroring the existing
 * `TimeSignature`/`time-signature.ts` precedent -- every current call site
 * keeps importing `PatternRole` from `$lib/groove/types` unchanged.
 */

/** Main groove, variation, fill, turnaround -- see AGENTS.md for why these four cover the practice use cases this app targets. */
export type PatternRole = 'A' | 'B' | 'F' | 'T';

export const PATTERN_ROLES: readonly PatternRole[] = ['A', 'B', 'F', 'T'];
