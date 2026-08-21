import { describe, expect, it } from 'vitest';
import { listTimeSignatures, TIME_SIGNATURES } from '../time-signature';

describe('TIME_SIGNATURES', () => {
	it('sizes simple meters at 4 steps per beat', () => {
		expect(TIME_SIGNATURES['3/4']).toMatchObject({ stepsPerBar: 12, stepsPerBeatGroup: 4 });
		expect(TIME_SIGNATURES['4/4']).toMatchObject({ stepsPerBar: 16, stepsPerBeatGroup: 4 });
		expect(TIME_SIGNATURES['5/4']).toMatchObject({ stepsPerBar: 20, stepsPerBeatGroup: 4 });
	});

	it('sizes compound meters at 6 steps per beat', () => {
		expect(TIME_SIGNATURES['6/8']).toMatchObject({ stepsPerBar: 12, stepsPerBeatGroup: 6 });
		expect(TIME_SIGNATURES['9/8']).toMatchObject({ stepsPerBar: 18, stepsPerBeatGroup: 6 });
		expect(TIME_SIGNATURES['12/8']).toMatchObject({ stepsPerBar: 24, stepsPerBeatGroup: 6 });
	});

	it('flags only the /8 meters as compound', () => {
		for (const ts of listTimeSignatures()) {
			expect(TIME_SIGNATURES[ts].isCompound).toBe(ts.endsWith('/8'));
		}
	});

	it('every meter divides evenly into whole beats', () => {
		for (const ts of listTimeSignatures()) {
			const { stepsPerBar, stepsPerBeatGroup } = TIME_SIGNATURES[ts];
			expect(stepsPerBar % stepsPerBeatGroup).toBe(0);
		}
	});
});
