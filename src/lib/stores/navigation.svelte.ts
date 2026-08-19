import { readJSON, writeJSON } from '$lib/utils/local-storage';

/**
 * Top-level destination the user is in — Explore / Practice / Progress — kept
 * separate from `fretfield.mode` (fretfield.svelte.ts), which still selects
 * which analysis lens the fretboard renders. Destination is a navigation/UI
 * concern; `FieldMode` is a harmonic-analysis concern. See
 * FRETFIELD_ROADMAP.md's four-dimension model (Harmonic Context / Harmonic
 * Lens / Spatial Lens / Activity) — this store owns Activity's top level.
 */
export type Destination = 'explore' | 'practice' | 'progress';

export const STORAGE_KEY = 'fretfield-destination';
const VALID_DESTINATIONS = new Set<Destination>(['explore', 'practice', 'progress']);

function loadDestination(): Destination {
	const stored = readJSON<Destination>(STORAGE_KEY, 'explore');
	return VALID_DESTINATIONS.has(stored) ? stored : 'explore';
}

class NavigationStore {
	destination = $state<Destination>(loadDestination());

	setDestination(destination: Destination): void {
		this.destination = destination;
		writeJSON(STORAGE_KEY, destination);
	}
}

export const navigation = new NavigationStore();
