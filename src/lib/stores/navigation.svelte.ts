/**
 * Top-level destination the user is in — Explore / Practice / Progress — kept
 * separate from `fretfield.mode` (fretfield.svelte.ts), which still selects
 * which analysis lens the fretboard renders. Destination is a navigation/UI
 * concern; `FieldMode` is a harmonic-analysis concern. See
 * FRETFIELD_ROADMAP.md's four-dimension model (Harmonic Context / Harmonic
 * Lens / Spatial Lens / Activity) — this store owns Activity's top level.
 */
export type Destination = 'explore' | 'practice' | 'progress';

class NavigationStore {
	destination = $state<Destination>('explore');

	setDestination(destination: Destination): void {
		this.destination = destination;
	}
}

export const navigation = new NavigationStore();
