import { describe, expect, it } from 'vitest';

import { createBasslineRandom } from '../random';
import { generateBarRhythm } from '../rhythm';
import { getBasslineStyleProfile } from '../styles';
import type { BasslineMeterContext } from '../types';

const SIMPLE_4_4: BasslineMeterContext = {
	stepsPerBar: 16,
	stepsPerBeatGroup: 4,
	isCompound: false
};

/** Average active-rate for slots matching `match`, across many independent seeds -- a statistical assertion, not a single-trial one, so it stays stable under small formula tweaks. */
function averageActiveRate(
	styleId: Parameters<typeof getBasslineStyleProfile>[0],
	meter: BasslineMeterContext,
	density: number,
	match: (slot: ReturnType<typeof generateBarRhythm>[number]) => boolean,
	trials = 400
): number {
	const style = getBasslineStyleProfile(styleId);
	let matchedCount = 0;
	let activeCount = 0;
	for (let seed = 0; seed < trials; seed++) {
		const slots = generateBarRhythm(style, 'main', meter, density, createBasslineRandom(seed));
		for (const slot of slots) {
			if (!match(slot)) continue;
			matchedCount++;
			if (slot.active) activeCount++;
		}
	}
	return matchedCount === 0 ? 0 : activeCount / matchedCount;
}

describe('generateBarRhythm: shape', () => {
	it('produces exactly meter.stepsPerBar slots, for every supported meter -- never a hardcoded 16', () => {
		const style = getBasslineStyleProfile('acid');
		for (const meter of [
			{ stepsPerBar: 12, stepsPerBeatGroup: 4, isCompound: false }, // 3/4
			{ stepsPerBar: 16, stepsPerBeatGroup: 4, isCompound: false }, // 4/4
			{ stepsPerBar: 20, stepsPerBeatGroup: 4, isCompound: false }, // 5/4
			{ stepsPerBar: 12, stepsPerBeatGroup: 6, isCompound: true }, // 6/8
			{ stepsPerBar: 18, stepsPerBeatGroup: 6, isCompound: true }, // 9/8
			{ stepsPerBar: 24, stepsPerBeatGroup: 6, isCompound: true } // 12/8
		] satisfies BasslineMeterContext[]) {
			const slots = generateBarRhythm(style, 'main', meter, 60, createBasslineRandom(1));
			expect(slots).toHaveLength(meter.stepsPerBar);
			expect(slots.map((s) => s.stepIndex)).toEqual(
				Array.from({ length: meter.stepsPerBar }, (_, i) => i)
			);
		}
	});

	it('classifies strongBeat/beatGroupStart/weakSubdivision correctly for a 6/8 bar', () => {
		const style = getBasslineStyleProfile('acid');
		const meter: BasslineMeterContext = { stepsPerBar: 12, stepsPerBeatGroup: 6, isCompound: true };
		const slots = generateBarRhythm(style, 'main', meter, 60, createBasslineRandom(1));
		expect(slots[0]).toMatchObject({
			strongBeat: true,
			beatGroupStart: true,
			weakSubdivision: false
		});
		expect(slots[6]).toMatchObject({
			strongBeat: false,
			beatGroupStart: true,
			weakSubdivision: false
		});
		expect(slots[1]).toMatchObject({
			strongBeat: false,
			beatGroupStart: false,
			weakSubdivision: true
		});
		expect(slots[7]).toMatchObject({
			strongBeat: false,
			beatGroupStart: false,
			weakSubdivision: true
		});
	});

	it('step 0 (strongBeat) is always active, even at density 0', () => {
		const style = getBasslineStyleProfile('rooted');
		for (let seed = 0; seed < 50; seed++) {
			const slots = generateBarRhythm(style, 'main', SIMPLE_4_4, 0, createBasslineRandom(seed));
			expect(slots[0].active).toBe(true);
		}
	});
});

describe('generateBarRhythm: determinism', () => {
	it('the exact same mask (golden) for a fixed style/role/meter/density/seed', () => {
		const style = getBasslineStyleProfile('acid');
		const slots = generateBarRhythm(style, 'main', SIMPLE_4_4, 62, createBasslineRandom(0x303303));
		expect(slots.map((s) => s.active)).toEqual([
			true,
			true,
			false,
			true,
			false,
			true,
			false,
			false,
			true,
			false,
			false,
			true,
			true,
			true,
			false,
			false
		]);
	});

	it('two independent runs with the same seed produce an identical mask', () => {
		const style = getBasslineStyleProfile('funk');
		const a = generateBarRhythm(style, 'variation', SIMPLE_4_4, 70, createBasslineRandom(55));
		const b = generateBarRhythm(style, 'variation', SIMPLE_4_4, 70, createBasslineRandom(55));
		expect(a).toEqual(b);
	});
});

describe('generateBarRhythm: style character', () => {
	it('Walking favors beat-group starts far more than weak (off-beat) subdivisions', () => {
		const beatGroupRate = averageActiveRate(
			'walking',
			SIMPLE_4_4,
			70,
			(s) => s.beatGroupStart && !s.strongBeat
		);
		const weakRate = averageActiveRate('walking', SIMPLE_4_4, 70, (s) => s.weakSubdivision);
		expect(beatGroupRate).toBeGreaterThan(weakRate * 2);
	});

	it('Acid and Funk produce more off-beat eligibility than Walking under the same density', () => {
		const walkingWeakRate = averageActiveRate('walking', SIMPLE_4_4, 70, (s) => s.weakSubdivision);
		const acidWeakRate = averageActiveRate('acid', SIMPLE_4_4, 70, (s) => s.weakSubdivision);
		const funkWeakRate = averageActiveRate('funk', SIMPLE_4_4, 70, (s) => s.weakSubdivision);
		expect(acidWeakRate).toBeGreaterThan(walkingWeakRate);
		expect(funkWeakRate).toBeGreaterThan(walkingWeakRate);
	});

	it('Rooted concentrates activity on strong beat-group starts (stable anchors), not weak subdivisions', () => {
		const beatGroupRate = averageActiveRate(
			'rooted',
			SIMPLE_4_4,
			70,
			(s) => s.beatGroupStart && !s.strongBeat
		);
		const weakRate = averageActiveRate('rooted', SIMPLE_4_4, 70, (s) => s.weakSubdivision);
		expect(beatGroupRate).toBeGreaterThan(weakRate);
	});

	it('density scales activation deterministically -- 0 stays near the strongBeat-only floor, 100 is clearly busier', () => {
		const lowRate = averageActiveRate('acid', SIMPLE_4_4, 0, (s) => !s.strongBeat);
		const highRate = averageActiveRate('acid', SIMPLE_4_4, 100, (s) => !s.strongBeat);
		expect(lowRate).toBe(0);
		expect(highRate).toBeGreaterThan(lowRate);
	});
});

describe('generateBarRhythm: phrase-role transforms', () => {
	it('fill concentrates extra activity in the second half of the bar versus main', () => {
		const secondHalfMain = averageActiveRate(
			'acid',
			SIMPLE_4_4,
			60,
			(s) => s.stepIndex >= 8 && !s.strongBeat
		);
		const style = getBasslineStyleProfile('acid');
		let matched = 0;
		let active = 0;
		for (let seed = 0; seed < 400; seed++) {
			const slots = generateBarRhythm(style, 'fill', SIMPLE_4_4, 60, createBasslineRandom(seed));
			for (const slot of slots) {
				if (slot.stepIndex < 8 || slot.strongBeat) continue;
				matched++;
				if (slot.active) active++;
			}
		}
		const secondHalfFill = active / matched;
		expect(secondHalfFill).toBeGreaterThan(secondHalfMain);
	});

	it('turnaround concentrates extra activity in the final beat group versus main', () => {
		const style = getBasslineStyleProfile('acid');
		function finalBeatGroupRate(phraseRole: 'main' | 'turnaround'): number {
			let matched = 0;
			let active = 0;
			for (let seed = 0; seed < 400; seed++) {
				const slots = generateBarRhythm(
					style,
					phraseRole,
					SIMPLE_4_4,
					60,
					createBasslineRandom(seed)
				);
				for (const slot of slots) {
					if (slot.stepIndex < 12 || slot.strongBeat) continue;
					matched++;
					if (slot.active) active++;
				}
			}
			return active / matched;
		}
		expect(finalBeatGroupRate('turnaround')).toBeGreaterThan(finalBeatGroupRate('main'));
	});
});
