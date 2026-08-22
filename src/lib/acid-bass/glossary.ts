/**
 * Plain-language, one-line explanations for every Acid Bass synth engine
 * control -- surfaced as a toggleable reference panel in
 * `AcidBassControls.svelte` ("a place in the UI where each knob is briefly
 * explained," per the user's own request). Pure data, no UI logic, so the
 * wording stays reviewable independent of the component that renders it.
 *
 * Grouped by panel section, matching `AcidBassControls.svelte`'s own
 * layout. LFO 1/LFO 2 share one entry (their controls are identical) and so
 * do the three auxiliary modulation sources (ENV MOD/ACCENT MOD/RANDOM
 * MOD) -- their shared controls are listed once, with each source's own
 * distinct *behavior* called out separately.
 */

export interface GlossaryEntry {
	term: string;
	description: string;
}

export interface GlossarySection {
	title: string;
	entries: GlossaryEntry[];
}

export const ACID_BASS_GLOSSARY: GlossarySection[] = [
	{
		title: 'VCO',
		entries: [
			{
				term: 'Wave',
				description:
					'The main oscillator’s waveform -- Saw is bright and buzzy, Square is hollow, Triangle is soft and rounded, Pulse is thin and nasal.'
			},
			{ term: 'Tune', description: 'Coarse pitch offset for the main oscillator, in semitones.' },
			{
				term: 'Fine',
				description: 'Fine pitch offset for the main oscillator, in cents -- for subtle detuning.'
			},
			{ term: 'Main Level', description: 'How loud the main oscillator is in the mix.' },
			{
				term: 'Pulse Width',
				description: 'The duty cycle of the Pulse wave -- narrower is thinner and more nasal.'
			}
		]
	},
	{
		title: 'SUB',
		entries: [
			{ term: 'Sub On/Off', description: 'Turns the sub oscillator on or off.' },
			{
				term: 'Octave',
				description: 'How many octaves below the main oscillator the sub oscillator sits.'
			},
			{ term: 'Wave', description: 'The sub oscillator’s waveform -- Square or Triangle.' },
			{ term: 'Level', description: 'How loud the sub oscillator is in the mix.' }
		]
	},
	{
		title: 'OSC 2',
		entries: [
			{ term: 'Osc 2 On/Off', description: 'Turns the second oscillator on or off.' },
			{ term: 'Wave', description: 'Osc 2’s own waveform, independent of the main oscillator.' },
			{
				term: 'Tune',
				description:
					'Osc 2’s own coarse pitch offset, independent of the main oscillator -- useful for detuned unison stacking.'
			},
			{ term: 'Fine', description: 'Osc 2’s own fine pitch offset, in cents.' },
			{ term: 'Level', description: 'How loud Osc 2 is in the mix.' },
			{
				term: 'Pulse Width',
				description: 'Osc 2’s own Pulse duty cycle -- only audible when its wave is Pulse.'
			}
		]
	},
	{
		title: 'VCF',
		entries: [
			{
				term: 'Model',
				description:
					'Which filter circuit shapes the tone -- Legacy and SVF-12 are cleaner, Acid 24 is a squelchy 4-pole ladder filter.'
			},
			{
				term: 'Cutoff',
				description:
					'The filter’s base brightness -- low is dark and round, high is open and bright.'
			},
			{
				term: 'Resonance',
				description:
					'How strongly the filter emphasizes the cutoff frequency -- high settings edge toward the classic acid "squeal."'
			},
			{
				term: 'Env Mod',
				description:
					'How much the filter envelope pushes the cutoff away from its base value on each note -- positive opens the filter, negative closes it.'
			},
			{
				term: 'Key Tracking',
				description:
					'How much the cutoff follows the note’s own pitch -- 0 keeps cutoff fixed regardless of register, 100 tracks the note almost exactly.'
			},
			{
				term: 'Saturation',
				description: 'Drive into the filter itself, for extra grit before the resonance stage.'
			}
		]
	},
	{
		title: 'ENV',
		entries: [
			{
				term: 'Decay',
				description: 'How quickly the filter envelope’s opening settles back down after each note.'
			},
			{
				term: 'Accent',
				description: 'How much louder and brighter an accented step hits, versus a normal one.'
			},
			{ term: 'Attack', description: 'How quickly each note’s volume rises to full level.' },
			{
				term: 'Release',
				description: 'How quickly each note’s volume fades out after its gate closes.'
			},
			{
				term: 'Glide Time',
				description: 'How long a slide takes to glide from one note to the next.'
			},
			{
				term: 'Glide Curve',
				description: 'The shape of a slide’s pitch glide -- Linear is even, Exponential eases in.'
			}
		]
	},
	{
		title: 'LFO 1 / LFO 2',
		entries: [
			{ term: 'On/Off', description: 'Turns this LFO on or off.' },
			{ term: 'Destination', description: 'Which parameter this LFO modulates.' },
			{ term: 'Depth', description: 'How strongly this LFO modulates its destination.' },
			{
				term: 'Shape',
				description:
					'The LFO’s waveform -- Sine/Triangle are smooth, Square switches abruptly, S&H jumps to a new random value each cycle.'
			},
			{
				term: 'Rate Mode',
				description: 'Free runs at a fixed Hz; Sync locks the rate to the current tempo.'
			},
			{
				term: 'Rate / Division',
				description:
					'The LFO’s speed -- a raw Hz value in Free mode, or a musical division (e.g. 1/8) in Sync mode.'
			}
		]
	},
	{
		title: 'ENV MOD / ACCENT MOD / RANDOM MOD',
		entries: [
			{ term: 'On/Off', description: 'Turns this modulation source on or off.' },
			{ term: 'Destination', description: 'Which parameter this source modulates.' },
			{
				term: 'Depth',
				description:
					'How strongly this source modulates its destination -- bipolar, so a negative depth pushes the destination down instead of up.'
			},
			{
				term: 'Env',
				description: 'Follows the same rise-and-decay shape as each note’s own filter envelope.'
			},
			{
				term: 'Accent',
				description: 'Only ever fires on accented steps -- silent on every normal hit.'
			},
			{
				term: 'Random',
				description:
					'A new, deterministic value on every trigger -- adds subtle per-note variation without ever using true randomness.'
			}
		]
	},
	{
		title: 'DELAY',
		entries: [
			{ term: 'On/Off', description: 'Turns the delay on or off.' },
			{
				term: 'Division',
				description:
					'How far behind the beat each repeat lands, as a musical division of the current tempo.'
			},
			{ term: 'Feedback', description: 'How many times the signal repeats before dying out.' },
			{ term: 'Mix', description: 'How loud the delayed repeats are relative to the dry signal.' }
		]
	},
	{
		title: 'OUTPUT',
		entries: [
			{
				term: 'Character',
				description:
					'The distortion curve shared by Saturation and Drive -- Soft is a smooth, symmetric clip; Diode is asymmetric and brighter on one half; Hard is a harder, more squared-off clip.'
			},
			{
				term: 'Drive',
				description: 'Post-filter saturation on the way to the output -- adds grit and edge.'
			},
			{ term: 'Volume', description: 'The patch’s overall output level.' }
		]
	}
];
