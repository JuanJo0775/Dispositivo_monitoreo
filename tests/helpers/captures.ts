import type { CaptureFlags, CapturePayload, RawCapture } from '@/domain/capture/types';

export const DEFAULT_PAYLOAD: CapturePayload = {
  latitude: 4.5339,
  longitude: -75.6811,
  altitudeM: 1550,
  speedKmh: 0.4,
  satellites: 9,
  hdop: 0.9,
  fixAgeS: 1.2,
  depthCm: 20,
  cropCode: 'cafe',
  plotCode: 'lote-1',
  lastFertilizationDate: '2026-09-01',
  humidityPct: 38,
  temperatureC: 21.5,
  ph: 5.4,
  ecUsCm: 120,
  nMgKg: 12,
  pMgKg: 18,
  kMgKg: 95,
  batteryPct: 82,
  firmwareVersion: '0.1.0',
};

export const DEFAULT_FLAGS: CaptureFlags = {
  positionValid: true,
  recentFix: true,
  probeOk: true,
  ecOverThreshold: false,
  timeValid: true,
  simulated: false,
};

export function makeCapture(
  payload: Partial<CapturePayload> = {},
  flags: Partial<CaptureFlags> = {},
  sequence = 1,
): RawCapture {
  return {
    deviceId: 'stick-01',
    sequence,
    payload: { ...DEFAULT_PAYLOAD, ...payload },
    capturedAtUtc: '2026-11-12T17:05:00Z',
    receivedAtUtc: '2026-11-12T17:05:01Z',
    origin: 'stick',
    flags: { ...DEFAULT_FLAGS, ...flags },
    configId: 7,
    plotId: 'plot-1',
  };
}

export function makeIncompleteCapture(payload: Partial<CapturePayload> = {}): RawCapture {
  const empty: CapturePayload = {
    latitude: null,
    longitude: null,
    altitudeM: null,
    speedKmh: null,
    satellites: null,
    hdop: null,
    fixAgeS: null,
    depthCm: null,
    cropCode: null,
    plotCode: null,
    lastFertilizationDate: null,
    humidityPct: null,
    temperatureC: null,
    ph: null,
    ecUsCm: null,
    nMgKg: null,
    pMgKg: null,
    kMgKg: null,
    batteryPct: null,
    firmwareVersion: null,
  };

  return makeCapture({ ...empty, ...payload }, { positionValid: false });
}
