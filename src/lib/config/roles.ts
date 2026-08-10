import type { HarmonicRole } from '$lib/music/harmony';

/**
 * Presentation metadata for each semantic role (AGENTS.md §7): every role
 * gets a color-independent shape as well as a CSS class, so meaning never
 * relies on color alone. Only 'root' | 'structural' | 'stable' are reachable
 * in chord-tone visualization; the rest light up in Harmonic Field mode.
 */
export interface RoleStyle {
	role: HarmonicRole;
	label: string;
	shape:
		'star' | 'circle' | 'ring' | 'diamond' | 'square' | 'triangle' | 'cross' | 'dot' | 'outline';
}

export const ROLE_STYLES: Record<HarmonicRole, RoleStyle> = {
	root: { role: 'root', label: 'Root', shape: 'star' },
	structural: { role: 'structural', label: 'Structural', shape: 'circle' },
	stable: { role: 'stable', label: 'Stable', shape: 'ring' },
	extension: { role: 'extension', label: 'Extension', shape: 'diamond' },
	color: { role: 'color', label: 'Color', shape: 'square' },
	tension: { role: 'tension', label: 'Tension', shape: 'triangle' },
	alteration: { role: 'alteration', label: 'Alteration', shape: 'cross' },
	'chromatic-approach': { role: 'chromatic-approach', label: 'Chromatic approach', shape: 'dot' },
	avoid: { role: 'avoid', label: 'Avoid', shape: 'outline' }
};

export function roleStyleFor(role: HarmonicRole | null): RoleStyle | null {
	return role === null ? null : ROLE_STYLES[role];
}
