import {
  ControlMode,
  SeaState,
  Telemetry,
  Vector3D,
  Vessel,
  WorldEntity,
} from '../types';
import {
  MPA_ZONE,
  seabedHeightAt,
  worldToGps,
} from '../data/worldSeed';
import { WaypointStack } from '../lib/dsa';

export interface ManualInputState {
  forward: number; // -1..1 (W/S or Up/Down)
  strafe: number; // -1..1 (A/D)
  vertical: number; // -1..1 (Q/E or Space/Shift)
  yaw: number; // -1..1 (Left/Right arrow or mouse)
}

export interface RovSimulationState {
  position: Vector3D;
  velocity: Vector3D;
  heading: number; // degrees 0..360
  pitch: number;
  roll: number;
  batteryPct: number;
  lightsOn: boolean;
  sonarActive: boolean;
  emergencySurface: boolean;
  controlMode: ControlMode;
  patrolWaypointIndex: number;
  surveyWaypointIndex: number;
  followTargetId: string;
  areaSurveyedSqKm: number;
  backtrackTimer: number;
  lastHazardId: string | null;
}

export const PATROL_WAYPOINTS: Vector3D[] = [
  { x: 14, y: -15, z: -10 },
  { x: 26, y: -18, z: -18 },
  { x: 30, y: -24, z: -26 },
  { x: 12, y: -22, z: -28 },
  { x: -16, y: -14, z: 14 },
  { x: -28, y: -26, z: -10 },
  { x: 0, y: -12, z: 4 },
];

export const SURVEY_LAWNMOWER_WAYPOINTS: Vector3D[] = [
  { x: -32, y: -28, z: -24 },
  { x: 32, y: -28, z: -24 },
  { x: 32, y: -28, z: -12 },
  { x: -32, y: -28, z: -12 },
  { x: -32, y: -28, z: 0 },
  { x: 32, y: -28, z: 0 },
  { x: 32, y: -28, z: 12 },
  { x: -32, y: -28, z: 12 },
  { x: -32, y: -28, z: 24 },
  { x: 32, y: -28, z: 24 },
];

export function createInitialRovState(
  spawnPos: Vector3D = { x: 10, y: -14, z: -8 },
  spawnHeading = 135,
  mode: ControlMode = ControlMode.PATROL
): RovSimulationState {
  return {
    position: { ...spawnPos },
    velocity: { x: 0, y: 0, z: 0 },
    heading: spawnHeading,
    pitch: 0,
    roll: 0,
    batteryPct: 96.4,
    lightsOn: true,
    sonarActive: true,
    emergencySurface: false,
    controlMode: mode,
    patrolWaypointIndex: 0,
    surveyWaypointIndex: 0,
    followTargetId: 'ent-sea-turtle',
    areaSurveyedSqKm: 1.42,
    backtrackTimer: 0,
    lastHazardId: null,
  };
}

export function stepRovPhysics(
  state: RovSimulationState,
  input: ManualInputState,
  dt: number,
  seaState: SeaState,
  commsOutage: boolean,
  entities: WorldEntity[],
  vessels: Vessel[],
  waypointStack: WaypointStack,
  elapsedTime: number
): { nextState: RovSimulationState; telemetry: Telemetry } {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const next: RovSimulationState = {
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
  };

  // 1. Check Low Battery or Tether Limit -> Auto RTB
  const mothership = vessels[0]?.position ?? { x: 0, y: 0, z: 0 };
  const dxMother = next.position.x - mothership.x;
  const dyMother = next.position.y - mothership.y;
  const dzMother = next.position.z - mothership.z;
  const tetherLengthM = Math.sqrt(
    dxMother * dxMother + dyMother * dyMother + dzMother * dzMother
  );

  if (next.batteryPct <= 12 && next.controlMode !== ControlMode.RTB) {
    next.controlMode = ControlMode.RTB;
  }

  // Recharge when docked near surface vessel
  if (tetherLengthM < 6.5 && next.position.y > -4.5) {
    next.batteryPct = Math.min(100, next.batteryPct + clampedDt * 8.5);
  }

  // 2. Check Obstacle / Ghost Net Entanglement Safety Proximity
  let nearHazard = false;
  let hazardWarningText: string | null = null;
  let closestHazard: WorldEntity | null = null;
  let minHazardDist = Infinity;

  for (const ent of entities) {
    if (!ent.isHazard) continue;
    const dx = next.position.x - ent.position.x;
    const dy = next.position.y - ent.position.y;
    const dz = next.position.z - ent.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ent.radius + 4.5 && dist < minHazardDist) {
      minHazardDist = dist;
      closestHazard = ent;
    }
  }

  if (closestHazard) {
    nearHazard = true;
    hazardWarningText = `PROXIMITY HAZARD: ${closestHazard.name} (${minHazardDist.toFixed(1)}m) — Auto-Slow & DFS Backtrack Ready`;
    if (minHazardDist < closestHazard.radius + 1.2 && next.backtrackTimer <= 0) {
      next.backtrackTimer = 2.2;
      next.lastHazardId = closestHazard.id;
    }
  } else {
    // Push safe breadcrumb onto WaypointStack
    waypointStack.push(next.position);
  }

  // 3. Compute Desired Thrust Vector based on ControlMode
  let desiredThrustForward = 0;
  let desiredThrustStrafe = 0;
  let desiredThrustVertical = 0;
  let desiredYawRate = 0;

  if (next.emergencySurface) {
    desiredThrustVertical = 1.6;
    desiredThrustForward = 0;
    if (next.position.y >= -1.2) {
      next.emergencySurface = false;
    }
  } else if (next.backtrackTimer > 0) {
    // Safety Backtracking via Waypoint Stack!
    next.backtrackTimer = Math.max(0, next.backtrackTimer - clampedDt);
    const safePt = waypointStack.peek() ?? { x: 0, y: -12, z: 0 };
    const bDx = safePt.x - next.position.x;
    const bDy = safePt.y - next.position.y;
    const bDz = safePt.z - next.position.z;
    const bDist = Math.hypot(bDx, bDy, bDz);
    if (bDist < 2.2 && waypointStack.size() > 1) {
      waypointStack.pop();
    }
    desiredThrustForward = -0.75; // Reverse thrusters away from net/wreck
    desiredThrustVertical = bDy > 0 ? 0.5 : 0.2;
    desiredYawRate = 0.4;
  } else if (next.controlMode === ControlMode.MANUAL) {
    desiredThrustForward = input.forward;
    desiredThrustStrafe = input.strafe;
    desiredThrustVertical = input.vertical;
    desiredYawRate = input.yaw;
  } else {
    // Autonomous modes: Patrol, Survey, Follow, RTB
    let targetPos: Vector3D = { x: 0, y: -12, z: 0 };

    if (next.controlMode === ControlMode.PATROL) {
      targetPos = PATROL_WAYPOINTS[next.patrolWaypointIndex % PATROL_WAYPOINTS.length];
      const distToWp = Math.hypot(
        targetPos.x - next.position.x,
        targetPos.y - next.position.y,
        targetPos.z - next.position.z
      );
      if (distToWp < 4.5) {
        next.patrolWaypointIndex = (next.patrolWaypointIndex + 1) % PATROL_WAYPOINTS.length;
        targetPos = PATROL_WAYPOINTS[next.patrolWaypointIndex];
      }
    } else if (next.controlMode === ControlMode.SURVEY) {
      const wp =
        SURVEY_LAWNMOWER_WAYPOINTS[
          next.surveyWaypointIndex % SURVEY_LAWNMOWER_WAYPOINTS.length
        ];
      const safeY = Math.max(seabedHeightAt(wp.x, wp.z) + 5.5, -34);
      targetPos = { x: wp.x, y: safeY, z: wp.z };
      const distToWp = Math.hypot(
        targetPos.x - next.position.x,
        targetPos.y - next.position.y,
        targetPos.z - next.position.z
      );
      if (distToWp < 4.5) {
        next.surveyWaypointIndex =
          (next.surveyWaypointIndex + 1) % SURVEY_LAWNMOWER_WAYPOINTS.length;
      }
    } else if (next.controlMode === ControlMode.FOLLOW) {
      const targetEntity =
        entities.find((e) => e.id === next.followTargetId) ??
        entities.find((e) => e.id === 'ent-sea-turtle') ??
        entities[0];
      if (targetEntity) {
        // Orbit gently 6m around target
        const orbitAngle = elapsedTime * 0.45;
        targetPos = {
          x: targetEntity.position.x + Math.cos(orbitAngle) * 6.5,
          y: Math.min(-3.5, targetEntity.position.y + 1.5),
          z: targetEntity.position.z + Math.sin(orbitAngle) * 6.5,
        };
      }
    } else if (next.controlMode === ControlMode.RTB) {
      targetPos = {
        x: mothership.x,
        y: -2.2,
        z: mothership.z,
      };
    }

    // Allow manual override nudge even in autonomous modes if user holds WASD
    if (
      Math.abs(input.forward) > 0.05 ||
      Math.abs(input.strafe) > 0.05 ||
      Math.abs(input.vertical) > 0.05 ||
      Math.abs(input.yaw) > 0.05
    ) {
      desiredThrustForward = input.forward;
      desiredThrustStrafe = input.strafe;
      desiredThrustVertical = input.vertical;
      desiredYawRate = input.yaw;
    } else {
      const tx = targetPos.x - next.position.x;
      const ty = targetPos.y - next.position.y;
      const tz = targetPos.z - next.position.z;
      const horizDist = Math.hypot(tx, tz);

      // Heading convention: 0 deg = -Z (North), 90 deg = +X (East)
      const desiredHeadingRad = Math.atan2(tx, -tz);
      const desiredHeadingDeg = ((desiredHeadingRad * 180) / Math.PI + 360) % 360;
      let headingDiff = desiredHeadingDeg - next.heading;
      if (headingDiff > 180) headingDiff -= 360;
      if (headingDiff < -180) headingDiff += 360;

      desiredYawRate = Math.max(-1, Math.min(1, headingDiff / 35));
      desiredThrustForward = horizDist > 2.0 ? Math.min(0.85, horizDist * 0.15) : 0.15;
      desiredThrustVertical = Math.max(-0.8, Math.min(0.8, ty * 0.25));
    }
  }

  // Slow down near hazards
  const hazardSpeedFactor = nearHazard ? 0.52 : 1.0;

  // Update heading
  next.heading = (next.heading + desiredYawRate * 75 * clampedDt + 360) % 360;
  const headingRad = (next.heading * Math.PI) / 180;
  const forwardX = Math.sin(headingRad);
  const forwardZ = -Math.cos(headingRad);
  const rightX = Math.cos(headingRad);
  const rightZ = Math.sin(headingRad);

  // Ocean currents by seaState
  const currentMag =
    seaState === 'rough' ? 1.45 : seaState === 'moderate' ? 0.65 : 0.18;
  const currentX = Math.sin(elapsedTime * 0.35 + next.position.y * 0.08) * currentMag;
  const currentZ = Math.cos(elapsedTime * 0.28 + next.position.x * 0.05) * currentMag;

  // Thrust acceleration
  const maxAccel = 9.5 * hazardSpeedFactor;
  const ax =
    (forwardX * desiredThrustForward + rightX * desiredThrustStrafe) * maxAccel +
    currentX * 0.6;
  const az =
    (forwardZ * desiredThrustForward + rightZ * desiredThrustStrafe) * maxAccel +
    currentZ * 0.6;
  const buoyancyBias = 0.15; // slight positive buoyancy safety
  const ay = desiredThrustVertical * 7.5 + buoyancyBias;

  // Apply acceleration & hydrodynamic drag
  const drag = 2.6;
  next.velocity.x += (ax - next.velocity.x * drag) * clampedDt;
  next.velocity.y += (ay - next.velocity.y * drag) * clampedDt;
  next.velocity.z += (az - next.velocity.z * drag) * clampedDt;

  // Update position
  next.position.x += next.velocity.x * clampedDt;
  next.position.y += next.velocity.y * clampedDt;
  next.position.z += next.velocity.z * clampedDt;

  // Clamp world arena bounds (-65..65) and Seabed/Surface collision
  next.position.x = Math.max(-64, Math.min(64, next.position.x));
  next.position.z = Math.max(-64, Math.min(64, next.position.z));

  const floorY = seabedHeightAt(next.position.x, next.position.z) + 1.5;
  if (next.position.y < floorY) {
    next.position.y = floorY;
    next.velocity.y = Math.max(0, next.velocity.y);
  }
  if (next.position.y > -0.6) {
    next.position.y = -0.6;
    next.velocity.y = Math.min(0, next.velocity.y);
  }

  // Pitch and roll aesthetics from thrust
  next.pitch = desiredThrustForward * -11 + desiredThrustVertical * 7;
  next.roll = -desiredYawRate * 9 + desiredThrustStrafe * 8;

  // Speed & Thruster Power
  const speedMs = Math.hypot(next.velocity.x, next.velocity.y, next.velocity.z);
  const speedKnots = speedMs * 1.94384;
  const thrustEffort = Math.min(
    1,
    Math.hypot(desiredThrustForward, desiredThrustStrafe, desiredThrustVertical) +
      Math.abs(desiredYawRate) * 0.3
  );
  const thrusterPowerPct = Math.round(12 + thrustEffort * 86);

  // Battery Drain
  const drainRate =
    0.045 * thrustEffort + (next.lightsOn ? 0.015 : 0) + (next.sonarActive ? 0.012 : 0);
  next.batteryPct = Math.max(5, Number((next.batteryPct - drainRate * clampedDt).toFixed(2)));

  // Area surveyed increment
  if (speedMs > 0.25) {
    next.areaSurveyedSqKm = Number(
      Math.min(12.5, next.areaSurveyedSqKm + speedMs * clampedDt * 0.0045).toFixed(3)
    );
  }

  // Environmental sensor calculations based on position & proximity to plumes
  const depth = Math.max(0.5, Number((-next.position.y).toFixed(1)));
  const pressureBar = Number((1.013 + depth * 0.1005).toFixed(2));

  // Check distance to oil plume & coral bleaching patch
  const oilEntity = entities.find((e) => e.id === 'ent-oil-plume');
  const distToOil = oilEntity
    ? Math.hypot(
        next.position.x - oilEntity.position.x,
        next.position.y - oilEntity.position.y,
        next.position.z - oilEntity.position.z
      )
    : 100;
  const bleachEntity = entities.find((e) => e.id === 'ent-coral-bleaching');
  const distToBleach = bleachEntity
    ? Math.hypot(
        next.position.x - bleachEntity.position.x,
        next.position.y - bleachEntity.position.y,
        next.position.z - bleachEntity.position.z
      )
    : 100;

  const oilInfluence = Math.exp(-(distToOil * distToOil) / 220);
  const bleachInfluence = Math.exp(-(distToBleach * distToBleach) / 180);

  const waterTempC = Number(
    (27.4 - depth * 0.19 + bleachInfluence * 1.9).toFixed(1)
  );
  const salinityPsu = Number((34.6 + depth * 0.012).toFixed(2));
  const baseTurbidity = seaState === 'rough' ? 6.8 : seaState === 'moderate' ? 3.4 : 1.6;
  const turbidityNtu = Number((baseTurbidity + oilInfluence * 44.5).toFixed(1));
  const phLevel = Number((8.12 - oilInfluence * 0.48).toFixed(2));
  const dissolvedOxygenMgL = Number((6.9 - depth * 0.03 - oilInfluence * 1.8).toFixed(2));

  // MPA Geofence Check
  const distToMpaCenter = Math.hypot(
    next.position.x - MPA_ZONE.center.x,
    next.position.z - MPA_ZONE.center.z
  );
  const inMpaZone = distToMpaCenter <= MPA_ZONE.radius;

  // Comms link quality
  const weatherPenalty = seaState === 'rough' ? 18 : seaState === 'moderate' ? 7 : 0;
  const depthPenalty = depth * 0.22;
  const commsLinkQualityPct = commsOutage
    ? 0
    : Math.max(42, Math.min(99, Math.round(98 - weatherPenalty - depthPenalty)));
  const satelliteLatencyMs = commsOutage
    ? 9999
    : Math.round(38 + weatherPenalty * 2.2 + Math.sin(elapsedTime * 1.7) * 4);

  const tetherTensionPct = Math.min(
    99,
    Math.round((tetherLengthM / 85) * 75 + (seaState === 'rough' ? 16 : 4))
  );

  const discoveredCount = entities.filter((e) => e.discovered).length;
  const patrolCoveragePct = Math.min(
    100,
    Math.round((discoveredCount / Math.max(1, entities.length)) * 65 + next.areaSurveyedSqKm * 12)
  );

  const telemetry: Telemetry = {
    position: {
      x: Number(next.position.x.toFixed(1)),
      y: Number(next.position.y.toFixed(1)),
      z: Number(next.position.z.toFixed(1)),
    },
    velocity: { ...next.velocity },
    depth,
    heading: Math.round(next.heading),
    pitch: Number(next.pitch.toFixed(1)),
    roll: Number(next.roll.toFixed(1)),
    speedMs: Number(speedMs.toFixed(2)),
    speedKnots: Number(speedKnots.toFixed(2)),
    batteryPct: Number(next.batteryPct.toFixed(1)),
    thrusterPowerPct,
    lightsOn: next.lightsOn,
    sonarActive: next.sonarActive,
    waterTempC,
    salinityPsu,
    turbidityNtu,
    phLevel,
    dissolvedOxygenMgL,
    pressureBar,
    gps: worldToGps(next.position),
    commsLinkQualityPct,
    satelliteLatencyMs,
    commsOutage,
    tetherLengthM: Number(tetherLengthM.toFixed(1)),
    tetherTensionPct,
    inMpaZone,
    nearHazard,
    hazardWarningText,
    backtrackingActive: next.backtrackTimer > 0,
    areaSurveyedSqKm: next.areaSurveyedSqKm,
    patrolCoveragePct,
    pollutionIndex: Math.round(34 + oilInfluence * 52),
    biodiversityIndex: Number((8.4 + (inMpaZone ? 0.8 : 0)).toFixed(1)),
  };

  return { nextState: next, telemetry };
}
