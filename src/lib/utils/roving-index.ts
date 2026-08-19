/**
 * Computes the next index for arrow-key navigation within a roving-tabindex
 * option group, wrapping at the ends. Shared by every `role="radio"`/
 * `role="tab"` toggle group in the app (DisplayModeToggle, AnalysisModeToggle,
 * PathSelector's preset picker, FieldModeSwitcher, ProgressionWorkspace's
 * lens-switcher, AppHeader's destination tabs) so the wrapping-index math
 * exists in exactly one place instead of six near-identical copies.
 *
 * Every one of these groups already switches immediately on click (no
 * separate "activate" step) — arrow keys move focus AND select the new
 * option in the same keystroke, matching that same click behavior rather
 * than the WAI-ARIA APG tablist's alternate "manual activation" variant.
 *
 * Returns `null` when `key` isn't a navigation key this group handles, so
 * callers can bail out (and let the browser handle every other key normally)
 * without a separate key-allowlist check of their own.
 */
export function nextRovingIndex(key: string, currentIndex: number, length: number): number | null {
	if (key === 'ArrowRight' || key === 'ArrowDown') {
		return (currentIndex + 1) % length;
	}
	if (key === 'ArrowLeft' || key === 'ArrowUp') {
		return (currentIndex - 1 + length) % length;
	}
	if (key === 'Home') return 0;
	if (key === 'End') return length - 1;
	return null;
}
