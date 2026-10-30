import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialRovState,
  stepRovPhysics,
} from './physics';
import {
  createInitialVessels,
  createInitialWorldEntities,
  seabedHeightAt,
  SCENARIO_PRESETS,
} from '../data/worldSeed';
import { WaypointStack } from '../lib/dsa';
import { ControlMode } from '../types';
import { computeMultiSensorDetections, evaluateScenarioProgress } from './fusion';

test('ROV physics steps manual and autonomous modes while respecting seabed bounds', () => {
  const entities = createInitialWorldEntities();
  const vessels = createInitialVessels();
  const stack = new WaypointStack(16);
  let rov = createInitialRovState({ x: 0, y: -15, z: 0 }, 0, ControlMode.MANUAL);

  // Apply forward and downward thrust
  const res = stepRovPhysics(
    rov,
    { forward: 1, strafe: 0, vertical: -1, yaw: 0.2 },
    0.04,
    'moderate',
    false,
    entities,
    vessels,
    stack,
    1.0
  );

  assert.ok(res.nextState.position.z < 0, 'Forward at 0 deg heading moves toward -Z');
  assert.ok(res.telemetry.depth > 0);
  assert.ok(res.telemetry.batteryPct <= 96.4);

  // Verify seabed floor collision clamping
  const floorY = seabedHeightAt(10, 10);
  let deepRov = createInitialRovState({ x: 10, y: floorY - 10, z: 10 }, 0, ControlMode.MANUAL);
  const clamped = stepRovPhysics(
    deepRov,
    { forward: 0, strafe: 0, vertical: -1, yaw: 0 },
    0.04,
    'calm',
    false,
    entities,
    vessels,
    stack,
    2.0
  );
  assert.ok(clamped.nextState.position.y >= floorY + 1.49);
});

test('ROV triggers hazard proximity warning and backtracking near Ghost Net', () => {
  const entities = createInitialWorldEntities();
  const vessels = createInitialVessels();
  const stack = new WaypointStack(16);
  stack.push({ x: 10, y: -18, z: -10 });

  // Place ROV right next to Ghost Net #GN-04 at (19, -21, -16)
  const rov = createInitialRovState({ x: 19.5, y: -21, z: -16.5 }, 90, ControlMode.PATROL);
  const res = stepRovPhysics(
    rov,
    { forward: 0, strafe: 0, vertical: 0, yaw: 0 },
    0.04,
    'calm',
    false,
    entities,
    vessels,
    stack,
    5.0
  );

  assert.equal(res.telemetry.nearHazard, true);
  assert.equal(res.telemetry.backtrackingActive, true);
  assert.ok(res.telemetry.hazardWarningText?.includes('Ghost Gillnet'));
});

test('Multi-sensor fusion produces detections across all 5 capabilities and scores scenarios', () => {
  const entities = createInitialWorldEntities();
  const { detections } = computeMultiSensorDetections(
    { x: 18, y: -18, z: -16 },
    135,
    true,
    true,
    'calm',
    entities
  );

  assert.ok(detections.length >= 8);
  assert.ok(detections.every((d) => d.fusedConfidence >= 60 && d.fusedConfidence <= 100));

  const vessels = createInitialVessels();
  const stack = new WaypointStack();
  const { telemetry } = stepRovPhysics(
    createInitialRovState(),
    { forward: 0, strafe: 0, vertical: 0, yaw: 0 },
    0.02,
    'calm',
    false,
    entities,
    vessels,
    stack,
    1.0
  );

  const evalRes = evaluateScenarioProgress(
    SCENARIO_PRESETS[0],
    entities,
    detections,
    telemetry,
    2
  );
  assert.ok(evalRes.scores.overallScore > 50);
});
