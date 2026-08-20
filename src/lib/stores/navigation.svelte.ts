import { readJSON, writeJSON } from '$lib/utils/local-storage';

/**
 * Top-level destination the user is in — Explore / Practice — kept separate
 * from `fretfield.mode` (fretfield.svelte.ts), which selects which internal
 * layer the fretboard renders (Chord Field vs. Scale Practice). Destination
 * is a navigation/UI concern; `FieldMode` is a rendering concern.
 */
export type Destination = 'explore' | 'practice';

export const STORAGE_KEY = 'fretfield-destination';
const VALID_DESTINATIONS = new Set<Destination>(['explore', 'practice']);

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
