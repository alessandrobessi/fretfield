/**
 * Eight curated patch-only presets (~/Downloads/ACID-BASS-ENGINE-V2.md M9),
 * each demonstrating one capability of the V2 signal path -- never a pattern
 * change (spec: a factory patch is sound design, not composition) and never
 * a preset-name reference stored on the groove that could drift if this file
 * changes later. `getAcidBassFactoryPatch` always rebuilds a fresh
 * `AcidBassPatch` from each preset's own overrides rather than handing back
 * a shared object, so applying one and then tweaking a knob can never
 * accidentally mutate the preset definition itself.
 */

import { createDefaultAcidPatch } from './pattern';
import type {
	AcidBassPatch,
	AcidEnvelopePatch,
	AcidFilterPatch,
	AcidGlidePatch,
	AcidLfoPatch,
	AcidOscillatorPatch,
	AcidOutputPatch
} from './types';

interface PatchOverrides {
	oscillator?: Partial<AcidOscillatorPatch>;
	filter?: Partial<AcidFilterPatch>;
	envelope?: Partial<AcidEnvelopePatch>;
	glide?: Partial<AcidGlidePatch>;
	lfo?: Partial<AcidLfoPatch>;
	output?: Partial<AcidOutputPatch>;
}

function buildPatch(overrides: PatchOverrides): AcidBassPatch {
	const base = createDefaultAcidPatch();
	return {
		oscillator: { ...base.oscillator, ...overrides.oscillator },
		filter: { ...base.filter, ...overrides.filter },
		envelope: { ...base.envelope, ...overrides.envelope },
		glide: { ...base.glide, ...overrides.glide },
		lfo: { ...base.lfo, ...overrides.lfo },
		output: { ...base.output, ...overrides.output }
	};
}

interface AcidBassFactoryPatchDefinition {
	id: string;
	label: string;
	/** What this preset demonstrates -- shown as a hint in the patch picker. */
	description: string;
	overrides: PatchOverrides;
}

const FACTORY_PATCH_DEFINITIONS: AcidBassFactoryPatchDefinition[] = [
	{
		id: 'round',
		label: 'Round',
		description: 'A mellow, rounded baseline tone -- Triangle through the clean SVF-12 filter.',
		overrides: {
			oscillator: { mainWave: 'triangle' },
			filter: { model: 'svf12', cutoff: 40, resonance: 20, envAmount: 15, keyTracking: 20 },
			envelope: { attack: 8, decay: 35, release: 25, accentAmount: 35 },
			glide: { time: 20, curve: 'linear' }
		}
	},
	{
		id: 'classic-acid',
		label: 'Classic Acid',
		description: 'The squelchy 303-style lead -- Saw through Acid 24 with the envelope wide open.',
		overrides: {
			oscillator: { mainWave: 'saw' },
			filter: { model: 'acid24', cutoff: 28, resonance: 70, envAmount: 65, saturation: 15 },
			envelope: { attack: 3, decay: 45, release: 15, accentAmount: 70 },
			glide: { time: 40, curve: 'exponential' },
			output: { drive: 25, volume: 72 }
		}
	},
	{
		id: 'deep-sub',
		label: 'Deep Sub',
		description: 'The sub oscillator carrying most of the low end, two octaves down.',
		overrides: {
			oscillator: {
				mainWave: 'square',
				mainLevel: 60,
				subEnabled: true,
				subOctave: -2,
				subWave: 'square',
				subLevel: 80
			},
			filter: { cutoff: 25, resonance: 15, envAmount: 10 },
			envelope: { decay: 40 },
			output: { drive: 10, volume: 75 }
		}
	},
	{
		id: 'rubber',
		label: 'Rubber',
		description: 'A slow, elastic glide between notes -- long exponential portamento.',
		overrides: {
			oscillator: { mainWave: 'saw' },
			filter: { cutoff: 45, resonance: 35, envAmount: 30 },
			envelope: { attack: 15, decay: 50, release: 40, accentAmount: 40 },
			glide: { time: 75, curve: 'exponential' }
		}
	},
	{
		id: 'funk-pulse',
		label: 'Funk Pulse',
		description: 'A narrow, nasal Pulse wave -- static Pulse Width, no live PWM yet.',
		overrides: {
			oscillator: { mainWave: 'pulse', pulseWidth: 25 },
			filter: { cutoff: 50, resonance: 40, envAmount: 35 },
			envelope: { decay: 30 },
			output: { drive: 8 }
		}
	},
	{
		id: 'dirty',
		label: 'Dirty',
		description: 'Heavy pre-filter saturation stacked with post-filter Drive.',
		overrides: {
			oscillator: { mainWave: 'saw' },
			filter: { cutoff: 35, resonance: 55, envAmount: 45, saturation: 60 },
			envelope: { decay: 35 },
			output: { drive: 65 }
		}
	},
	{
		id: 'clean-track',
		label: 'Clean Track',
		description: 'Cutoff follows the note almost 1:1 -- strong key tracking, clean filter.',
		overrides: {
			oscillator: { mainWave: 'triangle' },
			filter: { model: 'svf12', cutoff: 50, resonance: 20, envAmount: 20, keyTracking: 80 },
			envelope: { decay: 30 }
		}
	},
	{
		id: 'slow-motion',
		label: 'Slow Motion',
		description: 'A slow free-running LFO breathing the cutoff open and closed.',
		overrides: {
			filter: { cutoff: 35, resonance: 40, envAmount: 20 },
			envelope: { decay: 40 },
			lfo: {
				enabled: true,
				shape: 'sine',
				destination: 'cutoff',
				rateMode: 'free',
				rateHz: 0.3,
				depth: 70
			}
		}
	}
];

export function listAcidBassFactoryPatches(): { id: string; label: string; description: string }[] {
	return FACTORY_PATCH_DEFINITIONS.map(({ id, label, description }) => ({
		id,
		label,
		description
	}));
}

/** Rebuilds a fresh `AcidBassPatch` from the named preset every call -- `undefined` for an unrecognized id rather than throwing (a stale/garbage id should never crash the app). */
export function getAcidBassFactoryPatch(id: string): AcidBassPatch | undefined {
	const definition = FACTORY_PATCH_DEFINITIONS.find((d) => d.id === id);
	return definition === undefined ? undefined : buildPatch(definition.overrides);
}
