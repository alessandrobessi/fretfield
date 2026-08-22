/**
 * Curated patch-only presets -- never a pattern change (spec: a factory
 * patch is sound design, not composition) and never a preset-name reference
 * stored on the groove that could drift if this file changes later.
 * `getAcidBassFactoryPatch` always rebuilds a fresh `AcidBassPatch` from
 * each preset's own overrides rather than handing back a shared object, so
 * applying one and then tweaking a knob can never accidentally mutate the
 * preset definition itself.
 *
 * The original eight (~/Downloads/ACID-BASS-ENGINE-V2.md M9) each
 * demonstrate one V2 signal-path capability. Six more (Acid Bass
 * Intelligence V4 M22, "optional V4-specific sound presets only if clearly
 * useful" -- spec §38 explicitly deferred these to the final-polish
 * milestone rather than requiring them earlier) are genre-flavored. Five of
 * those six each pair a recognizable bass character with the one V4 feature
 * that genuinely belongs to that genre's sound, rather than bolting V4
 * features on arbitrarily: House's filter breathes via ENV MOD, R&B leans
 * on Glide, DnB's reese growl comes from a detuned Osc 2 through Hard
 * distortion, Techno's punch comes from ACCENT MOD driving Drive, and
 * Trance's classic gated-filter pluck comes from a tempo-synced LFO paired
 * with the tempo-synced delay. Bossa Nova is the sixth -- a warm, gentle
 * upright-style walking bass built entirely from V2-era controls (soft
 * attack, long release, a light glide), included for genre range rather
 * than to demonstrate any one V4 feature.
 */

import { createDefaultAcidPatch } from './pattern';
import type {
	AcidAuxModulationSection,
	AcidBassPatch,
	AcidDelayPatch,
	AcidDistortionPatch,
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
	lfo1?: Partial<AcidLfoPatch>;
	lfo2?: Partial<AcidLfoPatch>;
	modulation?: Partial<AcidAuxModulationSection>;
	distortion?: Partial<AcidDistortionPatch>;
	delay?: Partial<AcidDelayPatch>;
	output?: Partial<AcidOutputPatch>;
}

/** Every preset inherits `createDefaultAcidPatch()`'s own neutral V3-equivalent defaults (Soft, no aux modulation, dry) for whichever fields it doesn't explicitly override -- the original eight still override none of `modulation`/`distortion`/`delay` at all, so they keep sounding exactly like their V3 versions (spec §38). */
function buildPatch(overrides: PatchOverrides): AcidBassPatch {
	const base = createDefaultAcidPatch();
	return {
		oscillator: { ...base.oscillator, ...overrides.oscillator },
		filter: { ...base.filter, ...overrides.filter },
		envelope: { ...base.envelope, ...overrides.envelope },
		glide: { ...base.glide, ...overrides.glide },
		lfo1: { ...base.lfo1, ...overrides.lfo1 },
		lfo2: { ...base.lfo2, ...overrides.lfo2 },
		modulation: { ...base.modulation, ...overrides.modulation },
		distortion: { ...base.distortion, ...overrides.distortion },
		delay: { ...base.delay, ...overrides.delay },
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
		description: 'A mellow, rounded baseline tone -- Triangle through the Smooth filter.',
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
		description:
			'The squelchy 303-style lead -- Saw through the Squelch filter with the envelope wide open.',
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
			lfo1: {
				enabled: true,
				shape: 'sine',
				destination: 'cutoff',
				rateMode: 'free',
				rateHz: 0.3,
				depth: 70
			}
		}
	},
	{
		id: 'house-deep',
		label: 'House Deep',
		description: 'Warm sub-driven house bass with a gently breathing filter (Env Mod -> Cutoff).',
		overrides: {
			oscillator: {
				mainWave: 'triangle',
				mainLevel: 75,
				subEnabled: true,
				subOctave: -1,
				subWave: 'square',
				subLevel: 65
			},
			filter: { model: 'svf12', cutoff: 38, resonance: 25, envAmount: 20, keyTracking: 15 },
			envelope: { attack: 5, decay: 32, release: 30, accentAmount: 30 },
			glide: { time: 15, curve: 'linear' },
			modulation: {
				envelope: { enabled: true, destination: 'cutoff', depth: 25 }
			},
			output: { drive: 6 }
		}
	},
	{
		id: 'rnb-velvet',
		label: 'RnB Velvet',
		description: 'Smooth, rounded neo-soul bass with a warm glide between notes.',
		overrides: {
			oscillator: { mainWave: 'triangle', mainLevel: 85 },
			filter: { model: 'svf12', cutoff: 45, resonance: 12, envAmount: 12, keyTracking: 25 },
			envelope: { attack: 12, decay: 30, release: 45, accentAmount: 25 },
			glide: { time: 55, curve: 'exponential' }
		}
	},
	{
		id: 'dnb-reese',
		label: 'DnB Reese',
		description: 'Aggressive detuned reese growl for drum & bass, through Hard distortion.',
		overrides: {
			oscillator: {
				mainWave: 'saw',
				mainLevel: 80,
				osc2Enabled: true,
				osc2Wave: 'saw',
				osc2Tune: 0,
				osc2Fine: 30,
				osc2Level: 80
			},
			filter: { model: 'acid24', cutoff: 32, resonance: 65, envAmount: 55, saturation: 30 },
			envelope: { attack: 0, decay: 25, release: 12, accentAmount: 65 },
			distortion: { character: 'hard' },
			output: { drive: 55, volume: 68 }
		}
	},
	{
		id: 'techno-drive',
		label: 'Techno Drive',
		description:
			'Relentless acid squelch with extra Drive kicking in on every accent (Accent Mod -> Drive).',
		overrides: {
			oscillator: { mainWave: 'saw' },
			filter: { model: 'acid24', cutoff: 26, resonance: 75, envAmount: 70, saturation: 10 },
			envelope: { attack: 0, decay: 20, release: 10, accentAmount: 55 },
			modulation: {
				accent: { enabled: true, destination: 'drive', depth: 60 }
			},
			distortion: { character: 'diode' },
			output: { drive: 30 }
		}
	},
	{
		id: 'trance-pluck',
		label: 'Trance Pluck',
		description:
			'Bright plucky trance bass with a tempo-synced gated filter and a dotted-eighth delay throw.',
		overrides: {
			oscillator: { mainWave: 'saw' },
			filter: { model: 'svf12', cutoff: 55, resonance: 45, envAmount: 35 },
			envelope: { attack: 0, decay: 22, release: 15, accentAmount: 40 },
			lfo1: {
				enabled: true,
				shape: 'square',
				destination: 'cutoff',
				rateMode: 'sync',
				division: '1/16',
				depth: 55
			},
			delay: { enabled: true, division: '1/8D', feedback: 40, mix: 30 },
			output: { drive: 12 }
		}
	},
	{
		id: 'bossa-nova',
		label: 'Bossa Nova',
		description: 'A warm, gentle upright-style walking bass for bossa nova and soft jazz.',
		overrides: {
			oscillator: {
				mainWave: 'triangle',
				mainLevel: 80,
				subEnabled: true,
				subOctave: -1,
				subWave: 'triangle',
				subLevel: 40
			},
			filter: { model: 'svf12', cutoff: 32, resonance: 12, envAmount: 10, keyTracking: 30 },
			envelope: { attack: 14, decay: 38, release: 48, accentAmount: 20 },
			glide: { time: 25, curve: 'linear' },
			output: { drive: 4, volume: 68 }
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
