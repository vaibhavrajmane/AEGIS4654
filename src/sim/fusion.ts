import {
  Detection,
  MonitoringCapability,
  ScenarioPreset,
  SeaState,
  Telemetry,
  Vector3D,
  WorldEntity,
} from '../types';
import { formatTacticalDistanceKm, worldToGps } from '../data/worldSeed';

/**
 * Computes Multi-Sensor Fusion detections from the ROV's current position, heading,
 * active sensors, and environmental conditions.
 * Styled after YOLOv8 optical detections + Multi-Beam Sonar + Environmental CTD/Fluorometer.
 */
export function computeMultiSensorDetections(
  rovPosition: Vector3D,
  rovHeadingDeg: number,
  lightsOn: boolean,
  sonarActive: boolean,
  seaState: SeaState,
  entities: WorldEntity[],
  nowMs: number = Date.now()
): {
  detections: Detection[];
  newlyDiscoveredIds: string[];
  newlyInspectedIds: string[];
} {
  const detections: Detection[] = [];
  const newlyDiscoveredIds: string[] = [];
  const newlyInspectedIds: string[] = [];

  const headingRad = (rovHeadingDeg * Math.PI) / 180;
  const fwdX = Math.sin(headingRad);
  const fwdZ = -Math.cos(headingRad);
  const rightX = Math.cos(headingRad);
  const rightZ = Math.sin(headingRad);

  const visibilityFactor =
    (lightsOn ? 1.0 : 0.78) *
    (seaState === 'rough' ? 0.85 : seaState === 'moderate' ? 0.94 : 1.0);

  for (let idx = 0; idx < entities.length; idx++) {
    const ent = entities[idx];
    const dx = ent.position.x - rovPosition.x;
    const dy = ent.position.y - rovPosition.y;
    const dz = ent.position.z - rovPosition.z;
    const distMeters = Math.hypot(dx, dy, dz);

    // Discover entity if within 34m sonar range
    if (!ent.discovered && distMeters <= 34) {
      newlyDiscoveredIds.push(ent.id);
    }
    // Close-up inspection if within 13.5m
    if (!ent.inspected && distMeters <= 13.5) {
      newlyInspectedIds.push(ent.id);
    }

    // Only include discovered or within-range entities in active detection feed
    if (!ent.discovered && distMeters > 38) continue;

    // Project onto ROV camera view plane for simulated YOLOv8 bounding boxes
    const horizDist = Math.max(0.1, Math.hypot(dx, dz));
    const dotFwd = (dx * fwdX + dz * fwdZ) / horizDist;
    const dotRight = (dx * rightX + dz * rightZ) / horizDist;

    let bbox: Detection['bbox'] | undefined;
    if (dotFwd > 0.25 && distMeters < 55) {
      // Entity is inside forward camera frustum; stagger slots to avoid overlap
      const slotX = 0.12 + ((idx * 0.27) % 0.66);
      const slotY = 0.16 + ((idx * 0.19) % 0.44);
      const screenX = slotX * 0.65 + (0.5 + dotRight * 0.35) * 0.35;
      const screenY = slotY;
      const boxW = Math.max(0.16, Math.min(0.24, (ent.radius * 2.1) / Math.max(8, distMeters)));
      const boxH = boxW * 0.62;
      bbox = {
        x: Math.max(0.05, Math.min(0.72, screenX)),
        y: Math.max(0.14, Math.min(0.58, screenY)),
        w: boxW,
        h: boxH,
      };
    }

    // Calculate individual sensor confidence scores
    const rangeAtten = Math.max(0.55, 1 - distMeters / 110);
    const opticalConfidence = Math.min(
      99.4,
      Math.max(
        62.0,
        Number(((78 + rangeAtten * 20) * visibilityFactor).toFixed(1))
      )
    );
    const sonarConfidence = sonarActive
      ? Math.min(99.6, Math.max(70.0, Number((84 + rangeAtten * 15).toFixed(1))))
      : 54.0;
    const envConfidence =
      ent.category === 'pollution' || ent.id === 'ent-coral-bleaching'
        ? Math.min(98.8, Number((82 + rangeAtten * 16).toFixed(1)))
        : Number((71 + rangeAtten * 14).toFixed(1));

    const confirmedSensors: ('CAM' | 'SONAR' | 'GPS' | 'ENV')[] = ['CAM', 'GPS'];
    if (sonarActive) confirmedSensors.push('SONAR');
    if (
      ent.category === 'pollution' ||
      ent.id === 'ent-coral-bleaching' ||
      distMeters < 28
    ) {
      confirmedSensors.push('ENV');
    }

    // Bayesian-inspired Multi-Sensor Fusion confidence boost
    const sensorBoost = confirmedSensors.length >= 4 ? 4.2 : confirmedSensors.length === 3 ? 2.8 : 1.0;
    const fusedConfidence = Math.min(
      99.8,
      Number(
        (
          opticalConfidence * 0.45 +
          sonarConfidence * 0.38 +
          envConfidence * 0.17 +
          sensorBoost
        ).toFixed(1)
      )
    );

    const dateObj = new Date(nowMs - idx * 14000);
    const timeStr = dateObj.toISOString().slice(11, 19) + ' UTC';

    detections.push({
      id: `DET-${100 + idx}`,
      entityId: ent.id,
      classLabel: ent.classLabel,
      category: ent.category,
      capability: ent.capability,
      opticalConfidence,
      sonarConfidence,
      envConfidence,
      fusedConfidence,
      confirmedSensors,
      distanceMeters: Number(distMeters.toFixed(1)),
      distanceKmDisplay: formatTacticalDistanceKm(distMeters),
      position: { ...ent.position },
      gps: worldToGps(ent.position),
      timestamp: timeStr,
      timestampMs: nowMs - idx * 14000,
      bbox,
      sdgTargets: ent.sdgTargets,
      evidenceNote: ent.metadata,
      cleanupPriority: ent.cleanupPriority,
    });
  }

  return {
    detections,
    newlyDiscoveredIds,
    newlyInspectedIds,
  };
}

/**
 * Evaluates scenario progress and computes the 4 KPI scores + overall score.
 */
export function evaluateScenarioProgress(
  scenario: ScenarioPreset,
  entities: WorldEntity[],
  detections: Detection[],
  telemetry: Telemetry,
  alertsTriagedCount: number
) {
  const updatedObjectives = scenario.objectives.map((obj) => {
    const allTargetsMet = obj.targetEntityIds.every((targetId) => {
      const entity = entities.find((e) => e.id === targetId);
      return entity ? entity.discovered || entity.inspected : false;
    });
    return {
      ...obj,
      completed: obj.completed || allTargetsMet,
    };
  });

  const completedCount = updatedObjectives.filter((o) => o.completed).length;
  const objectiveProgressPct = Math.round(
    (completedCount / Math.max(1, updatedObjectives.length)) * 100
  );

  const avgFusedConf =
    detections.length > 0
      ? detections.reduce((acc, d) => acc + d.fusedConfidence, 0) / detections.length
      : 92.5;

  const detectionAccuracyPct = Math.round(avgFusedConf);
  const areaCoveredPct = Math.min(100, telemetry.patrolCoveragePct);
  const responseTimeScore = Math.min(100, 78 + alertsTriagedCount * 7);
  const batteryEfficiencyPct = Math.min(100, Math.round(telemetry.batteryPct));

  const overallScore = Math.round(
    detectionAccuracyPct * 0.3 +
      areaCoveredPct * 0.25 +
      responseTimeScore * 0.25 +
      batteryEfficiencyPct * 0.2
  );

  return {
    objectives: updatedObjectives,
    objectiveProgressPct,
    scores: {
      detectionAccuracyPct,
      areaCoveredPct,
      responseTimeScore,
      batteryEfficiencyPct,
      overallScore,
    },
  };
}
