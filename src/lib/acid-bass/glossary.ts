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
 *
 * `GENERATED_BASSLINE_GLOSSARY` below is this file's second, independent
 * glossary (user-requested, 2026-08) -- the Mode picker and Generated
 * mode's own controls in `GrooveEditor.svelte`'s "Bass Steps" tab, a
 * genuinely different vocabulary (bassline generation, not synth sound
 * design) that happens to live in the same `AcidBassGenerationSettings`
 * neighborhood. Kept in this file rather than a second one so glossary
 * content stays in one reviewable place; rendered via the same shared
 * `GlossaryPanel.svelte` component `AcidBassControls.svelte` uses.
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
					'Which filter circuit shapes the tone -- Classic and Smooth are gentler two-pole filters, Squelch is an aggressive 4-pole ladder filter for that classic acid growl.'
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
				description:
					'How quickly the filter envelope’s opening settles back down, and the volume settles to Sustain, after each note.'
			},
			{
				term: 'Sustain',
				description:
					'The volume level a held note settles to after Decay -- 100 stays at full volume for the whole note, lower values let it fall away while the note is still sounding.'
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

export const GENERATED_BASSLINE_GLOSSARY: GlossarySection[] = [
	{
		title: 'MODE',
		entries: [
			{
				term: 'Manual / Generated',
				description:
					'Manual: program each step by hand, note by note. Generated: FretField writes a full bassline from the current chord/scale context instead, and the step grid becomes a read-only view of what it wrote.'
			}
		]
	},
	{
		title: 'GENERATION',
		entries: [
			{
				term: 'Style',
				description:
					'Rooted is a foundational, stable part. Funk is syncopated root/octave/chord-tone language with short articulations. Acid is repeated motifs with chromatic approaches, slides and accents. Chromatic is target-driven chromatic movement, never random outside notes. Melodic is connected, lyrical motion through chord and scale tones. Walking is beat-oriented, connected lines that strongly target chord changes.'
			},
			{
				term: 'Harmony',
				description:
					'Chord picks each note relative to whatever chord is sounding right now -- the classic root/chord-tone-forward bass approach. Key picks notes relative to the overall key instead, so a melodic idea can repeat as a motif even as the chord underneath it changes. Voice Lead favors the smoothest possible move from one note to the next -- common tones and small steps over big jumps, even across a chord change.'
			},
			{
				term: 'Register',
				description:
					'Where on the neck the line prefers to sit. Low/Mid/High are soft pitch-center preferences. Zone strongly prefers positions inside the fretboard zone set above, only falling back to the nearest playable position when nothing exists inside it.'
			},
			{
				term: 'Density',
				description:
					'How many of the available rhythmic slots actually get a note -- low is sparse, high is busy.'
			},
			{
				term: 'Chromatic',
				description:
					'How often a weak, unimportant note gets pulled into a chromatic approach toward the next strong target, instead of staying diatonic.'
			},
			{
				term: 'Movement',
				description:
					'Preference for melodic motion over repetition -- low tends to repeat or anchor on the root, high moves around more.'
			},
			{
				term: 'Playability',
				description:
					'How strongly the generator avoids awkward physical jumps on the neck -- 0 ignores playability entirely, 100 favors smooth, nearby fret positions.'
			},
			{
				term: 'Intelligence',
				description:
					"How much the generated line's articulation (accent, gate, slide) responds to each note's musical role -- 0 still generates real notes, just without that extra expressive shaping."
			},
			{
				term: 'New Variation',
				description:
					'Reseeds the generator for a fresh take on the current settings -- the plan changes, but Style/Harmony/Register and the knobs above stay exactly as set.'
			}
		]
	},
	{
		title: 'STEP INSPECTOR',
		entries: [
			{ term: 'Note', description: 'The pitch actually sounding at this step.' },
			{
				term: 'Interval',
				description: "This note's interval relative to the chord sounding at this step."
			},
			{
				term: 'Function',
				description:
					'The musical role this note is playing -- root, chord tone, scale tone, passing tone, or a chromatic/diatonic approach into the next target.'
			},
			{
				term: 'Position',
				description:
					'Which string and fret the generator chose to play this note on, out of every physically valid option.'
			}
		]
	}
];
