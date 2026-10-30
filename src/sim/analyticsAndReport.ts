import { RecentDetectionRecord } from './rovWorld2d';
import { ThreatAlert, MissionPreset, VisitedWaypoint } from './dsaStructures';

export interface DetectionTimePoint {
  timeLabel: string;
  total: number;
  threats: number;
  pollution: number;
  life: number;
}

export interface DetectionClassStat {
  name: string;
  shortName: string;
  count: number;
  avgConfidence: number;
  category: 'threat' | 'pollution' | 'life';
}

export interface AnalyticsSnapshot {
  pollutionIndex: number; // 0..100
  biodiversityCount: number;
  areaSurveyedPct: number; // 0..100
  detectionsOverTime: DetectionTimePoint[];
  detectionsByClass: DetectionClassStat[];
}

export interface Sdg14TargetReportItem {
  code: '14.1' | '14.2' | '14.4' | '14.5' | '14.a';
  title: string;
  status: 'ACTIVE MONITORING' | 'INTERVENTION REQUIRED' | 'VERIFIED';
  findings: string;
  metrics: string;
}

export interface MissionTimelineEvent {
  time: string;
  type: 'MISSION' | 'DETECTION' | 'ALERT_DISPATCH' | 'SAFETY_STACK' | 'COMMS';
  detail: string;
}

export interface FullMissionReport {
  reportId: string;
  generatedAtIso: string;
  missionTitle: string;
  missionProgressPct: number;
  summary: {
    rovDepthMeters: number;
    waterTempCelsius: number;
    batteryPct: number;
    pollutionIndex: number;
    biodiversityCount: number;
    areaSurveyedPct: number;
    totalUniqueDetections: number;
    queuedAlertsCount: number;
    dispatchedAlertsCount: number;
  };
  timeline: MissionTimelineEvent[];
  detections: RecentDetectionRecord[];
  sdg14Targets: Sdg14TargetReportItem[];
  disclaimer: string;
}

/**
 * Computes real-time Analytics metrics (Pollution Index, Biodiversity Count, Area Surveyed %,
 * Detections Over Time, and Detections By Class) from the simulated session state.
 */
export function computeAnalyticsSnapshot(
  recentDetections: RecentDetectionRecord[],
  alerts: ThreatAlert[],
  visitedStack: VisitedWaypoint[],
  rovX: number,
  rovY: number,
  dispatchedCount: number
): AnalyticsSnapshot {
  // 1. Pollution Index (0..100)
  const pollutionDetections = recentDetections.filter(
    (d) =>
      d.category === 'pollution' ||
      d.label.includes('Oil') ||
      d.label.includes('Plastic') ||
      d.label.includes('Ghost Net') ||
      d.label.includes('Bleached')
  );
  const rawPollution =
    42 +
    pollutionDetections.length * 7 +
    alerts.filter((a) => a.category !== 'life').length * 4 -
    dispatchedCount * 3;
  const pollutionIndex = Math.max(12, Math.min(98, Math.round(rawPollution)));

  // 2. Biodiversity Count (165 schooling boid fish + 2 turtles + 1 shark + 1 dolphin + 6 seahorses + observed life)
  const lifeDetections = recentDetections.filter((d) => d.category === 'life').length;
  const biodiversityCount = 175 + lifeDetections * 3;

  // 3. Area Surveyed % (computed from visited stack spread + current ROV X/Y coverage across 6000x1200 world)
  const uniqueSectors = new Set<string>();
  uniqueSectors.add(`${Math.floor(rovX / 450)},${Math.floor(rovY / 240)}`);
  for (const pt of visitedStack) {
    uniqueSectors.add(`${Math.floor(pt.x / 450)},${Math.floor(pt.y / 240)}`);
  }
  for (const d of recentDetections) {
    uniqueSectors.add(`${Math.floor(d.worldX / 450)},${Math.floor(d.worldY / 240)}`);
  }
  const totalSectors = 28;
  const areaSurveyedPct = Math.min(
    100,
    Math.max(14, Math.round((uniqueSectors.size / totalSectors) * 100))
  );

  // 4. Detections By Class (grouped for Recharts BarChart)
  const classMap = new Map<
    string,
    { count: number; confSum: number; category: 'threat' | 'pollution' | 'life' }
  >();

  // Seed baseline world classes so the chart is rich immediately and grows as new objects are scanned
  const baselineClasses: Array<{
    label: string;
    count: number;
    conf: number;
    cat: 'threat' | 'pollution' | 'life';
  }> = [
    { label: 'Plastic Bottle', count: 2, conf: 91, cat: 'pollution' },
    { label: 'Plastic Bag', count: 2, conf: 87, cat: 'pollution' },
    { label: 'Ghost Net', count: 1, conf: 88, cat: 'threat' },
    { label: 'Sea Turtle', count: 2, conf: 95, cat: 'life' },
    { label: 'Oil Plume', count: 1, conf: 84, cat: 'threat' },
    { label: 'Reef Shark', count: 1, conf: 95, cat: 'life' },
  ];

  for (const base of baselineClasses) {
    classMap.set(base.label, {
      count: base.count,
      confSum: base.conf * base.count,
      category: base.cat,
    });
  }

  for (const det of recentDetections) {
    const existing = classMap.get(det.label);
    if (existing) {
      existing.count += 1;
      existing.confSum += det.confidence;
    } else {
      classMap.set(det.label, {
        count: 1,
        confSum: det.confidence,
        category: det.category,
      });
    }
  }

  const shortLabel = (lbl: string) => {
    if (lbl === 'Plastic Bottle') return 'Bottle';
    if (lbl === 'Plastic Bag') return 'Bag';
    if (lbl === 'Entangled Sea Turtle') return 'Ent.Turtle';
    if (lbl === 'Suspicious Vessel') return 'Dark Ship';
    if (lbl === 'Shipwreck Hull') return 'Wreck';
    if (lbl === 'Seabed Anomaly') return 'Anomaly';
    if (lbl === 'Bleached Coral') return 'Bleach';
    if (lbl === 'Bottlenose Dolphin') return 'Dolphin';
    return lbl.slice(0, 9);
  };

  const detectionsByClass: DetectionClassStat[] = Array.from(classMap.entries()).map(
    ([name, val]) => ({
      name,
      shortName: shortLabel(name),
      count: val.count,
      avgConfidence: Math.round(val.confSum / Math.max(1, val.count)),
      category: val.category,
    })
  );

  // 5. Detections Over Time (for Recharts AreaChart)
  const totalNow = Math.max(6, recentDetections.length + 4);
  const threatsNow =
    recentDetections.filter((d) => d.category === 'threat').length + 2;
  const pollutionNow =
    recentDetections.filter((d) => d.category === 'pollution').length + 2;
  const lifeNow = recentDetections.filter((d) => d.category === 'life').length + 2;

  const detectionsOverTime: DetectionTimePoint[] = [
    { timeLabel: 'T+00s', total: 2, threats: 1, pollution: 1, life: 0 },
    { timeLabel: 'T+15s', total: 4, threats: 1, pollution: 2, life: 1 },
    { timeLabel: 'T+30s', total: Math.max(5, totalNow - 3), threats: Math.max(1, threatsNow - 1), pollution: Math.max(2, pollutionNow - 1), life: Math.max(1, lifeNow - 1) },
    { timeLabel: 'T+45s', total: Math.max(6, totalNow - 1), threats: threatsNow, pollution: pollutionNow, life: Math.max(2, lifeNow - 1) },
    { timeLabel: 'LIVE', total: totalNow, threats: threatsNow, pollution: pollutionNow, life: lifeNow },
  ];

  return {
    pollutionIndex,
    biodiversityCount,
    areaSurveyedPct,
    detectionsOverTime,
    detectionsByClass,
  };
}

/**
 * Generates the comprehensive Mission Report including Summary, Timeline, Detections,
 * and UN SDG 14 Targets (14.1, 14.2, 14.4, 14.5, 14.a).
 */
export function generateMissionReportData(params: {
  activeMission: MissionPreset;
  missionProgressPct: number;
  depthMeters: number;
  tempCelsius: number;
  battery: number;
  analytics: AnalyticsSnapshot;
  recentDetections: RecentDetectionRecord[];
  alerts: ThreatAlert[];
  dispatchedCount: number;
  poppedStackCount: number;
}): FullMissionReport {
  const {
    activeMission,
    missionProgressPct,
    depthMeters,
    tempCelsius,
    battery,
    analytics,
    recentDetections,
    alerts,
    dispatchedCount,
    poppedStackCount,
  } = params;

  const timeline: MissionTimelineEvent[] = [
    {
      time: '00:00',
      type: 'MISSION',
      detail: `Deployed AUV-09 on preset "${activeMission.title}" (${activeMission.sdgTarget}).`,
    },
  ];

  for (const det of recentDetections.slice(0, 6)) {
    timeline.push({
      time: det.timestampStr,
      type: 'DETECTION',
      detail: `YOLOv8 Optical/Sonar Lock: ${det.label} (${det.confidence}% conf, Dist ${det.distanceMeters}m at X:${Math.round(det.worldX)}m).`,
    });
  }

  if (dispatchedCount > 0) {
    timeline.push({
      time: 'LIVE',
      type: 'ALERT_DISPATCH',
      detail: `Prioritized and dispatched ${dispatchedCount} high-risk threat alert(s) via Automated Threat Triage Matrix.`,
    });
  }

  if (poppedStackCount > 0) {
    timeline.push({
      time: 'LIVE',
      type: 'SAFETY_STACK',
      detail: `Entanglement/Collision proximity brake triggered; retraced ${poppedStackCount} safe tether waypoint(s).`,
    });
  }

  const sdg14Targets: Sdg14TargetReportItem[] = [
    {
      code: '14.1',
      title: 'Reduce Marine Pollution',
      status: 'INTERVENTION REQUIRED',
      findings:
        'Macro-plastic bottles, drifting polyethylene bags, microplastic specks, and a subsea pipeline hydrocarbon oil plume localized at X:2350m.',
      metrics: `Pollution Index: ${analytics.pollutionIndex}/100 | Plastic & Oil Targets Tagged`,
    },
    {
      code: '14.2',
      title: 'Protect & Restore Marine Ecosystems',
      status: 'INTERVENTION REQUIRED',
      findings:
        'Monitored coral reef biodiversity, swaying kelp forests, bleached coral stress zone (X:3550m), and trapped rare sea turtles, bluefin tuna, and manta rays requiring rescue.',
      metrics: `Biodiversity Count: ${analytics.biodiversityCount} organisms tracked across 5 schools`,
    },
    {
      code: '14.4',
      title: 'End IUU & Destructive Fishing',
      status: 'INTERVENTION REQUIRED',
      findings:
        'Detected 3 illegal poaching drift-netter vessels towing deep submerged nets (X:1740m, X:3360m, X:4650m) trapping rare species, plus seabed trawl scars and ghost gear.',
      metrics: `Active Priority Alerts: ${alerts.length} triaged | ${dispatchedCount} dispatched`,
    },
    {
      code: '14.5',
      title: 'Conserve Coastal & Marine Areas',
      status: 'ACTIVE MONITORING',
      findings:
        'Continuous acoustic and optical boundary patrol along the Marine Protected Area (MPA: no fishing) perimeter at X:3200m.',
      metrics: `Area Surveyed: ${analytics.areaSurveyedPct}% of 6.0 km × 1.2 km sector`,
    },
    {
      code: '14.a',
      title: 'Increase Marine Scientific Knowledge & Tech',
      status: 'VERIFIED',
      findings:
        'Demonstrated autonomous ROV multi-sensor telemetry, Criticality Threat Triage, Store-and-Forward Blackout Telemetry Vault, and Systematic Sector Grid Sweep.',
      metrics: `ROV Depth: ${depthMeters}m | Water Temp: ${tempCelsius}°C | Battery: ${battery}%`,
    },
  ];

  return {
    reportId: `AEGIS-REP-${Date.now().toString().slice(-6)}`,
    generatedAtIso: new Date().toISOString(),
    missionTitle: activeMission.title,
    missionProgressPct,
    summary: {
      rovDepthMeters: depthMeters,
      waterTempCelsius: tempCelsius,
      batteryPct: battery,
      pollutionIndex: analytics.pollutionIndex,
      biodiversityCount: analytics.biodiversityCount,
      areaSurveyedPct: analytics.areaSurveyedPct,
      totalUniqueDetections: recentDetections.length,
      queuedAlertsCount: alerts.length,
      dispatchedAlertsCount: dispatchedCount,
    },
    timeline,
    detections: recentDetections,
    sdg14Targets,
    disclaimer:
      'AI output is decision support, not proof of a violation. All data is simulated. Simulated data for demonstration.',
  };
}
