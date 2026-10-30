import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AEGIS_20_VESSELS,
  AuvBreadcrumbStack,
  HydrophoneCircularQueue16,
  computeOscillatedFleet,
  filterAegisVessels,
} from './aegisFleet20';

test('AEGIS 20-Vessel dataset contains V-001 through V-020 with exact critical attributes', () => {
  assert.equal(AEGIS_20_VESSELS.length, 20);
  const v1 = AEGIS_20_VESSELS[0];
  assert.equal(v1.id, 'V-001');
  assert.equal(v1.codename, 'OCEAN GHOST');
  assert.equal(v1.vesselName, 'FV HAI LONG 88');
  assert.equal(v1.mmsi, '412789120');
  assert.equal(v1.riskScore, 96);
  assert.equal(v1.baseDraftMeters, 5.2);
  assert.equal(v1.draftDeltaMeters, 1.4);

  const v2 = AEGIS_20_VESSELS[1];
  assert.equal(v2.id, 'V-002');
  assert.equal(v2.codename, 'SHADOW REEFER');
  assert.equal(v2.baseDraftMeters, 6.8);
  assert.equal(v2.draftDeltaMeters, 2.1);

  const v4 = AEGIS_20_VESSELS[3];
  assert.equal(v4.id, 'V-004');
  assert.equal(v4.codename, 'PHANTOM RUNNER');
  assert.equal(v4.riskScore, 95);
  assert.equal(v4.baseDraftMeters, 5.9);

  const v20 = AEGIS_20_VESSELS[19];
  assert.equal(v20.id, 'V-020');
  assert.equal(v20.codename, 'ZEPHYR TRADE');
});

test('Synchronized AEGIS Radar filters match exact ship counts and IDs', () => {
  const defaultCriteria = {
    threatFocus: 'ALL' as const,
    riskTier: 'ALL_SHIPS' as const,
    matrixStatus: 'ALL' as const,
    flagName: 'ALL',
    gearType: 'ALL' as const,
  };

  // Threat Focus: HIGH_RISK (5 Ships: V-001..V-005)
  const highRisk = filterAegisVessels(AEGIS_20_VESSELS, {
    ...defaultCriteria,
    threatFocus: 'HIGH_RISK',
  });
  assert.equal(highRisk.length, 5);
  assert.deepEqual(
    highRisk.map((v) => v.id),
    ['V-001', 'V-002', 'V-003', 'V-004', 'V-005']
  );

  // Threat Focus: SANCTUARY (2 Ships: V-001, V-005)
  const sanctuary = filterAegisVessels(AEGIS_20_VESSELS, {
    ...defaultCriteria,
    threatFocus: 'SANCTUARY',
  });
  assert.equal(sanctuary.length, 2);
  assert.deepEqual(
    sanctuary.map((v) => v.id),
    ['V-001', 'V-005']
  );

  // Threat Focus: SIGNAL_OFF (2 Ships: V-001, V-002)
  const signalOff = filterAegisVessels(AEGIS_20_VESSELS, {
    ...defaultCriteria,
    threatFocus: 'SIGNAL_OFF',
  });
  assert.equal(signalOff.length, 2);
  assert.deepEqual(
    signalOff.map((v) => v.id),
    ['V-001', 'V-002']
  );

  // Suspicion Level: HIGH (>80) -> 4 Ships
  const tierHigh = filterAegisVessels(AEGIS_20_VESSELS, {
    ...defaultCriteria,
    threatFocus: 'ALL',
    riskTier: 'HIGH',
  });
  assert.equal(tierHigh.length, 4);

  // Suspicion Level: MEDIUM (50-80) -> 3 Ships (V-005, V-006, V-007)
  const tierMed = filterAegisVessels(AEGIS_20_VESSELS, {
    ...defaultCriteria,
    threatFocus: 'ALL',
    riskTier: 'MEDIUM',
  });
  assert.equal(tierMed.length, 3);
  assert.deepEqual(
    tierMed.map((v) => v.id),
    ['V-005', 'V-006', 'V-007']
  );

  // Matrix Status: CRITICAL (4), ALERTIVE (3), NORMAL (13)
  assert.equal(
    filterAegisVessels(AEGIS_20_VESSELS, {
      ...defaultCriteria,
      matrixStatus: 'CRITICAL',
    }).length,
    4
  );
  assert.equal(
    filterAegisVessels(AEGIS_20_VESSELS, {
      ...defaultCriteria,
      matrixStatus: 'ALERTIVE',
    }).length,
    3
  );
  assert.equal(
    filterAegisVessels(AEGIS_20_VESSELS, {
      ...defaultCriteria,
      matrixStatus: 'NORMAL',
    }).length,
    13
  );
});

test('Live 2.5s Telemetry Oscillator respects SOG, Heading, and Draft bounds', () => {
  const oscillated = computeOscillatedFleet(AEGIS_20_VESSELS, 7);
  assert.equal(oscillated.length, 20);
  for (let i = 0; i < 20; i++) {
    const base = AEGIS_20_VESSELS[i];
    const live = oscillated[i];
    assert.ok(Math.abs(live.liveSogKts - base.baseSogKts) <= 0.19);
    assert.ok(Math.abs(live.liveDraftMeters - base.baseDraftMeters) <= 0.04);
  }
});

test('16-Slot Hydrophone Circular Queue and LIFO Breadcrumb Stack operate in O(1)', () => {
  const ring = new HydrophoneCircularQueue16();
  for (let seq = 1; seq <= 20; seq++) {
    ring.enqueue({
      seq,
      vesselId: 'V-001',
      timestamp: '00:00:01',
      cavitationHz: 142,
      sonarPingDb: 168,
      hullDraftDelta: '+1.4m',
      encryptedHash: `0x${seq.toString(16)}`,
    });
  }
  const snap = ring.getSnapshot();
  assert.equal(snap.capacity, 16);
  assert.equal(snap.count, 16);
  assert.equal(snap.overwrittenCount, 4);

  const flushed = ring.flushToCutterArgus();
  assert.equal(flushed.length, 16);
  assert.equal(flushed[0].seq, 5);
  assert.equal(flushed[15].seq, 20);
  assert.equal(ring.getSnapshot().count, 0);

  const bcStack = new AuvBreadcrumbStack(10);
  bcStack.push({ x: 0, y: 0, depth: 15, heading: 90, timestamp: '00:01', signalDbm: -62 });
  bcStack.push({ x: 12, y: -8, depth: 45, heading: 142, timestamp: '00:02', signalDbm: -78 });
  assert.equal(bcStack.size(), 2);
  const popped = bcStack.pop();
  assert.equal(popped?.depth, 45);
  assert.equal(bcStack.size(), 1);
});
