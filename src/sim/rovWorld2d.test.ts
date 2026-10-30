import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_WIDTH,
  WORLD_DEPTH,
  createInitialWorldState,
  stepWorldSimulation,
  getSeabedY,
  scanDetections,
} from './rovWorld2d.ts';

test('World dimensions and initial state meet strict 2D side-view specification', () => {
  assert.equal(WORLD_WIDTH, 6000);
  assert.equal(WORLD_DEPTH, 1200);

  const state = createInitialWorldState();
  assert.ok(state.boids.length >= 150, 'Should spawn at least 150 boid fish');
  assert.ok(state.kelp.length > 30, 'Should spawn swaying kelp stalks');
  assert.ok(state.corals.length > 30, 'Should spawn coral clusters');
  assert.ok(state.plastics.length >= 8, 'Should spawn plastic bottles and bags');
  assert.ok(state.seahorses.length >= 4, 'Should spawn seahorses near coral');
  assert.equal(state.rov.lightsOn, true);
  assert.equal(state.rov.overlayOn, true);
});

test('Boids flock and flee away when the ROV approaches closely', () => {
  const state = createInitialWorldState();
  const targetBoid = state.boids[0];
  // Place ROV right next to targetBoid on its left
  state.rov.x = targetBoid.x - 30;
  state.rov.y = targetBoid.y;
  targetBoid.vx = 0;

  stepWorldSimulation(state, { up: false, down: false, left: false, right: false }, 0.04);
  assert.ok(targetBoid.vx > 0, 'Boid should accelerate away from nearby ROV');
});

test('Manual keyboard input immediately switches ROV to Manual mode and moves drone', () => {
  const state = createInitialWorldState();
  assert.equal(state.rov.mode, 'Auto Patrol');
  const startY = state.rov.y;

  for (let i = 0; i < 15; i++) {
    stepWorldSimulation(state, { up: false, down: true, left: false, right: true }, 0.03);
  }

  assert.equal(state.rov.mode, 'Manual');
  assert.ok(state.rov.y > startY, 'ROV should descend when down input is held');
});

test('Seabed collision clamps ROV above terrain and triggers camera shake', () => {
  const state = createInitialWorldState();
  state.rov.mode = 'Manual';
  const seabedY = getSeabedY(state.rov.x);
  state.rov.y = seabedY - 10;
  state.rov.vy = 120; // Fast downward impact

  stepWorldSimulation(state, { up: false, down: true, left: false, right: false }, 0.03);
  const newSeabedY = getSeabedY(state.rov.x);
  assert.ok(state.rov.y <= newSeabedY - 22 + 0.01, 'ROV should collide with seabed and stay above it');
  assert.ok(state.rov.shakeTimer > 0, 'Seabed impact should trigger camera shake');
});

test('Battery under 15% automatically engages Return to Base mode', () => {
  const state = createInitialWorldState();
  state.rov.mode = 'Manual';
  state.rov.battery = 14.2;

  stepWorldSimulation(state, { up: false, down: false, left: false, right: false }, 0.03);
  assert.equal(state.rov.mode, 'Return to Base');
});

test('Detection scanner logs nearby objects without duplicates in recentDetections', () => {
  const state = createInitialWorldState();
  // Position ROV right in front of the Ghost Net & Entangled Turtle
  state.rov.x = state.ghostNet.x - 90;
  state.rov.y = state.ghostNet.y;
  state.rov.facing = 1;
  state.rov.lightsOn = true;

  scanDetections(state, 10);
  scanDetections(state, 11);
  scanDetections(state, 12);

  const ids = state.recentDetections.map((d) => d.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'recentDetections must never contain duplicate IDs');
  assert.ok(
    state.recentDetections.some((d) => d.label === 'Ghost Net'),
    'Ghost Net should be detected when inside ROV cone/sonar'
  );
  assert.ok(
    state.recentDetections.some((d) => d.label === 'Entangled Sea Turtle'),
    'Entangled Sea Turtle should be detected when inside ROV cone/sonar'
  );
});

test('Poaching ships tow attached long drift-nets with trapped rare species and trigger collision evasion', () => {
  const state = createInitialWorldState();
  assert.equal(state.poachingShips.length, 3, 'World should contain 3 poaching ships with attached long nets');
  const firstShip = state.poachingShips[0];
  assert.ok(firstShip.netBottomY - firstShip.netTopY >= 380, 'Attached net must extend deep into the water column');
  assert.ok(firstShip.trappedCreatures.length >= 2, 'Attached net must contain trapped rare species');

  // Position ROV near first poaching ship net and scan detections
  state.rov.x = firstShip.x - 80;
  state.rov.y = 430;
  state.rov.facing = 1;
  state.rov.lightsOn = true;
  scanDetections(state, 5);

  assert.ok(
    state.recentDetections.some((d) => d.label === 'Attached Long Drift-Net'),
    'Attached Long Drift-Net should be detected'
  );
  assert.ok(
    state.recentDetections.some(
      (d) => d.label === 'Trapped Rare Sea Turtle' || d.label === 'Trapped Golden Bluefin Tuna'
    ),
    'Trapped rare species inside the ship net should be detected'
  );

  // Move ROV directly into the ship's attached long net mesh to verify collision evasion trigger
  state.rov.x = firstShip.x;
  state.rov.y = 430;
  stepWorldSimulation(state, { up: false, down: false, left: false, right: false }, 0.016);
  assert.equal(state.safetyState.isWarning, true, 'Entering attached poaching net must trigger collision evasion warning');
});

test('Net tackling strategy guides ROV under or above poaching nets in Auto Patrol and Auto Survey', () => {
  // 1. Test UNDER_NET strategy in Auto Patrol
  const patrolState = createInitialWorldState();
  const ship1 = patrolState.poachingShips[0];
  patrolState.rov.mode = 'Auto Patrol';
  patrolState.rov.patrolWaypointIdx = 2; // Waypoint at X:1860 across Ship #1 (X:1740)
  patrolState.rov.x = ship1.x - 160;
  patrolState.rov.y = 450;
  patrolState.netTackle.strategy = 'UNDER_NET';

  stepWorldSimulation(patrolState, { up: false, down: false, left: false, right: false }, 0.04);
  assert.equal(patrolState.netTackle.active, true, 'Auto Patrol should engage net tackling when approaching net');
  assert.equal(patrolState.netTackle.activePass, 'UNDER_NET', 'Should resolve UNDER_NET pass');
  assert.ok(
    patrolState.netTackle.waypoints[1].y > ship1.netBottomY,
    'UNDER_NET clearance waypoint must sit below the net bottom lead line'
  );

  // Step until ROV dives toward the under-net clearance gate
  for (let i = 0; i < 60; i++) {
    stepWorldSimulation(patrolState, { up: false, down: false, left: false, right: false }, 0.04);
  }
  assert.ok(patrolState.rov.y > 580, 'ROV should dive below the net depth during UNDER_NET tackle');

  // 2. Test OVER_NET strategy in Auto Survey
  const surveyState = createInitialWorldState();
  const ship2 = surveyState.poachingShips[1];
  surveyState.rov.mode = 'Auto Survey';
  surveyState.dfsSurvey.enabled = false;
  surveyState.rov.surveyDir = 1;
  surveyState.rov.x = ship2.x - 165;
  surveyState.rov.y = 320;
  surveyState.netTackle.strategy = 'OVER_NET';

  stepWorldSimulation(surveyState, { up: false, down: false, left: false, right: false }, 0.04);
  assert.equal(surveyState.netTackle.active, true, 'Auto Survey should engage net tackling when approaching net');
  assert.equal(surveyState.netTackle.activePass, 'OVER_NET', 'Should resolve OVER_NET pass');
  assert.ok(
    surveyState.netTackle.waypoints[1].y < ship2.netTopY + 45,
    'OVER_NET clearance waypoint must sit above the submerged net mesh'
  );

  for (let i = 0; i < 45; i++) {
    stepWorldSimulation(surveyState, { up: false, down: false, left: false, right: false }, 0.04);
  }
  assert.ok(surveyState.rov.y < 235, 'ROV should ascend to the upper surface clearance corridor during OVER_NET tackle');
});

test('Auto Patrol and Auto Survey traverse the full ocean area across all 3 nets without bouncing back', () => {
  // 1. Verify Auto Patrol traverses from X:920 past all 3 poaching nets (1740, 3360, 4650) to X > 4900 without backtracking
  const patrolState = createInitialWorldState();
  patrolState.rov.mode = 'Auto Patrol';
  patrolState.rov.battery = 100;
  let maxPatrolX = patrolState.rov.x;
  let backtrackTriggeredInPatrol = false;

  for (let step = 0; step < 1200; step++) {
    patrolState.rov.battery = 100; // keep battery full for long-range test
    stepWorldSimulation(patrolState, { up: false, down: false, left: false, right: false }, 0.05);
    if (patrolState.rov.x > maxPatrolX) {
      maxPatrolX = patrolState.rov.x;
    }
    if (patrolState.safetyState.isBacktracking) {
      backtrackTriggeredInPatrol = true;
    }
  }

  assert.equal(backtrackTriggeredInPatrol, false, 'Auto Patrol must never get stuck in a collision backtrack loop');
  assert.ok(maxPatrolX > 4900, `Auto Patrol should traverse the full ocean past X:4900 (reached ${Math.round(maxPatrolX)})`);
  assert.ok(patrolState.netTackle.clearedCount >= 3, 'Auto Patrol should clear all 3 poaching ship nets');

  // 2. Verify Auto Survey (DFS Grid Sweep) also traverses across the full ocean past X:4900 without backtracking
  const surveyState = createInitialWorldState();
  surveyState.rov.mode = 'Auto Survey';
  surveyState.netTackle.strategy = 'OVER_NET';
  let maxSurveyX = surveyState.rov.x;
  let backtrackTriggeredInSurvey = false;

  for (let step = 0; step < 1200; step++) {
    surveyState.rov.battery = 100;
    stepWorldSimulation(surveyState, { up: false, down: false, left: false, right: false }, 0.05);
    if (surveyState.rov.x > maxSurveyX) {
      maxSurveyX = surveyState.rov.x;
    }
    if (surveyState.safetyState.isBacktracking) {
      backtrackTriggeredInSurvey = true;
    }
  }

  assert.equal(backtrackTriggeredInSurvey, false, 'Auto Survey must never get stuck in a collision backtrack loop');
  assert.ok(maxSurveyX > 4900, `Auto Survey should traverse the full ocean past X:4900 (reached ${Math.round(maxSurveyX)})`);
});



