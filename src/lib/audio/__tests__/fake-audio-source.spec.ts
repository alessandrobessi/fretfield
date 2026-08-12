import { describe, expect, it, vi } from 'vitest';
import { FakeAudioSource } from '../fake-audio-source';

describe('FakeAudioSource', () => {
	it('lists a default fake device', async () => {
		const source = new FakeAudioSource();
		const devices = await source.listDevices();
		expect(devices).toHaveLength(1);
		expect(devices[0].deviceId).toBe('fake-device-1');
	});

	it('lists custom devices when configured', async () => {
		const source = new FakeAudioSource({
			devices: [
				{ deviceId: 'a', label: 'Interface A' },
				{ deviceId: 'b', label: 'Interface B' }
			]
		});
		expect(await source.listDevices()).toHaveLength(2);
	});

	it('setDevices updates the enumerated device list', async () => {
		const source = new FakeAudioSource();
		source.setDevices([{ deviceId: 'x', label: 'X' }]);
		expect(await source.listDevices()).toEqual([{ deviceId: 'x', label: 'X' }]);
	});

	it('is not started until start() is called', () => {
		const source = new FakeAudioSource();
		expect(source.isStarted()).toBe(false);
	});

	it('pushFrame throws if called before start()', () => {
		const source = new FakeAudioSource();
		expect(() => source.pushSilence(16)).toThrow();
	});

	it('delivers pushed frames to the onFrame callback with the configured sample rate', async () => {
		const source = new FakeAudioSource({ sampleRate: 44100 });
		const onFrame = vi.fn();
		await source.start('fake-device-1', onFrame);
		expect(source.isStarted()).toBe(true);
		expect(source.getStartedDeviceId()).toBe('fake-device-1');

		source.pushSilence(8);
		expect(onFrame).toHaveBeenCalledTimes(1);
		const [samples, sampleRate] = onFrame.mock.calls[0];
		expect(samples).toHaveLength(8);
		expect(sampleRate).toBe(44100);
	});

	it('pushSine produces a real sine wave at the requested frequency', async () => {
		const source = new FakeAudioSource({ sampleRate: 48000 });
		const onFrame = vi.fn();
		await source.start(null, onFrame);

		source.pushSine(100, 480, 0.5);
		const [samples] = onFrame.mock.calls[0];
		expect(samples).toHaveLength(480);
		expect(Math.max(...samples)).toBeGreaterThan(0.4);
		expect(Math.min(...samples)).toBeLessThan(-0.4);
	});

	it('stop() clears callbacks so a subsequent pushFrame throws again', async () => {
		const source = new FakeAudioSource();
		await source.start(null, vi.fn());
		source.stop();
		expect(source.isStarted()).toBe(false);
		expect(() => source.pushSilence(4)).toThrow();
	});

	it('simulateDisconnect stops the source and invokes onError', async () => {
		const source = new FakeAudioSource();
		const onFrame = vi.fn();
		const onError = vi.fn();
		await source.start('fake-device-1', onFrame, onError);

		source.simulateDisconnect();

		expect(onError).toHaveBeenCalledTimes(1);
		expect(source.isStarted()).toBe(false);
		expect(() => source.pushSilence(4)).toThrow();
	});
});
