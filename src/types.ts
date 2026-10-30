export enum ControlMode {
  MANUAL = 'manual',
  PATROL = 'patrol',
  SURVEY = 'survey',
  FOLLOW = 'follow',
  RTB = 'rtb',
}

export enum MonitoringCapability {
  VESSEL_TRACKING = 'vessel_tracking',
  ILLEGAL_FISHING = 'illegal_fishing',
  POLLUTION = 'pollution',
  MARINE_LIFE = 'marine_life',
  SEABED_MAPPING = 'seabed_mapping',
}

export enum CameraViewMode {
  FIRST_PERSON = 'first_person',
  CHASE = 'chase',
  ORBIT = 'orbit',
  TOP_DOWN = 'top_down',
  SONAR = 'sonar',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export type SeaState = 'calm' | 'moderate' | 'rough';
export type QualityPreset = 'low' | 'medium' | 'high';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GPSCoordinate {
  lat: number;
  lon: number;
}

export interface Vessel {
  id: string;
  mmsi: string;
  name: string;
  type: 'mothership' | 'cargo' | 'research' | 'illegal_trawler' | 'transshipment_carrier' | 'poacher_skiff';
  aisActive: boolean;
  flag: string;
  speedKnots: number;
  heading: number;
  position: Vector3D;
  trail: Vector3D[];
  status: 'normal' | 'loitering' | 'ais_dark' | 'mpa_incursion' | 'rendezvous';
  riskScore: number;
  inMpa: boolean;
  description: string;
}

export type EntityCategory =
  | 'vessel'
  | 'illegal_gear'
  | 'pollution'
  | 'marine_life'
  | 'seabed_anomaly';

export interface WorldEntity {
  id: string;
  name: string;
  classLabel: string;
  category: EntityCategory;
  capability: MonitoringCapability;
  position: Vector3D;
  velocity?: Vector3D;
  radius: number;
  riskScore: number;
  sdgTargets: string[];
  isHazard?: boolean;
  entangledAnimal?: string;
  cleanupPriority?: number;
  speciesCount?: number;
  protectionStatus?: 'Endangered' | 'Vulnerable' | 'Protected' | 'Least Concern';
  metadata: string;
  discovered: boolean;
  inspected: boolean;
}

export interface Detection {
  id: string;
  entityId: string;
  classLabel: string;
  category: EntityCategory;
  capability: MonitoringCapability;
  opticalConfidence: number;
  sonarConfidence: number;
  envConfidence: number;
  fusedConfidence: number;
  confirmedSensors: ('CAM' | 'SONAR' | 'GPS' | 'ENV')[];
  distanceMeters: number;
  distanceKmDisplay: string;
  position: Vector3D;
  gps: GPSCoordinate;
  timestamp: string;
  timestampMs: number;
  bbox?: {
    x: number; // normalized 0..1
    y: number;
    w: number;
    h: number;
  };
  sdgTargets: string[];
  evidenceNote: string;
  cleanupPriority?: number;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  riskScore: number; // 1..100 for MaxHeapPriorityQueue
  capability: MonitoringCapability;
  timestamp: string;
  timestampMs: number;
  gps: GPSCoordinate;
  position: Vector3D;
  sdgTarget: string;
  entityId?: string;
  dispatched: boolean;
  recommendedAction: string;
}

export interface SimulatedNotification {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'APP_PUSH' | 'SAT_UPLINK';
  recipient: string;
  subject: string;
  timestamp: string;
  alertId: string;
  severity: AlertSeverity;
}

export interface Telemetry {
  position: Vector3D;
  velocity: Vector3D;
  depth: number; // meters positive downward
  heading: number; // 0..359 deg
  pitch: number; // deg
  roll: number; // deg
  speedMs: number;
  speedKnots: number;
  batteryPct: number;
  thrusterPowerPct: number;
  lightsOn: boolean;
  sonarActive: boolean;
  waterTempC: number;
  salinityPsu: number;
  turbidityNtu: number;
  phLevel: number;
  dissolvedOxygenMgL: number;
  pressureBar: number;
  gps: GPSCoordinate;
  commsLinkQualityPct: number;
  satelliteLatencyMs: number;
  commsOutage: boolean;
  tetherLengthM: number;
  tetherTensionPct: number;
  inMpaZone: boolean;
  nearHazard: boolean;
  hazardWarningText: string | null;
  backtrackingActive: boolean;
  areaSurveyedSqKm: number;
  patrolCoveragePct: number;
  pollutionIndex: number;
  biodiversityIndex: number;
}

export interface ScenarioObjective {
  id: string;
  description: string;
  targetEntityIds: string[];
  completed: boolean;
}

export interface ScenarioPreset {
  id: string;
  code: 'A' | 'B' | 'C' | 'D' | 'E';
  name: string;
  subtitle: string;
  description: string;
  primaryCapability: MonitoringCapability;
  defaultControlMode: ControlMode;
  spawnPosition: Vector3D;
  spawnHeading: number;
  timeOfDay: number; // 0..24
  seaState: SeaState;
  sdgTargets: string[];
  objectives: ScenarioObjective[];
}

export interface AIBriefing {
  summary: string;
  threat_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  key_findings: string[];
  illegal_fishing_indicators: string[];
  pollution_findings: string[];
  marine_life_notes: string[];
  recommended_actions: string[];
  sdg14_targets_affected: string[];
  confidence: number;
  caveats: string;
  generatedAt: string;
  source: 'gemini-live' | 'deterministic-fallback';
}

export interface MissionReport {
  reportId: string;
  generatedAt: string;
  scenarioName: string;
  missionDurationSec: number;
  summary: string;
  telemetrySnapshot: Telemetry;
  detections: Detection[];
  alertsTriaged: number;
  activeAlertsRemaining: number;
  sdg14Impact: {
    targetCode: string;
    title: string;
    status: string;
    evidenceCount: number;
  }[];
  recommendedActions: string[];
  scores: {
    detectionAccuracyPct: number;
    areaCoveredPct: number;
    responseTimeScore: number;
    batteryEfficiencyPct: number;
    overallScore: number;
  };
}

export interface SystemArchitectureNode {
  id: 'rov' | 'surface_vessel' | 'satellite' | 'ground_station' | 'cloud_server' | 'web_dashboard' | 'alerts_hub';
  name: string;
  subtitle: string;
  roleDescription: string;
  status: 'nominal' | 'degraded' | 'buffering' | 'offline';
  throughputKbps: number;
  latencyMs: number;
  packetsProcessed: number;
  specs: string[];
}
