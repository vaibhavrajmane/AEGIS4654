import {
  AlertMaxHeap,
  computeAlertRiskScore,
  SensorCircularQueue,
  SensorTelemetryPacket,
  PositionStack,
  VisitedWaypoint,
  DfsSurveyNode,
  generateRecursiveDfsSurvey,
} from './dsaStructures';

export const WORLD_WIDTH = 6000;
export const WORLD_DEPTH = 1200; // Total world height (0 = top of sky, 180 = surface, 1380 = max bottom)
export const SURFACE_Y = 180;
export const MAX_WORLD_Y = SURFACE_Y + WORLD_DEPTH; // 1380
export const MPA_BOUNDARY_X = 3200;

export type RovMode = 'Manual' | 'Auto Patrol' | 'Auto Survey' | 'Return to Base';

export type NetTackleStrategy = 'UNDER_NET' | 'OVER_NET' | 'ADAPTIVE';
export type ResolvedNetPass = 'UNDER_NET' | 'OVER_NET';

export interface NetTackleWaypoint {
  x: number;
  y: number;
  label: string;
}

export interface NetTackleState {
  strategy: NetTackleStrategy;
  active: boolean;
  activePass: ResolvedNetPass;
  targetNetId: string;
  targetNetName: string;
  phase: 'IDLE' | 'APPROACH_GATE' | 'CLEARANCE_PASS' | 'EXIT_GATE';
  waypointIdx: number;
  waypoints: NetTackleWaypoint[];
  overCorridorY: number;
  underCorridorY: number;
  netCenterX: number;
  netTopY: number;
  netBottomY: number;
  clearedCount: number;
  lastClearedNetName: string;
  cooldownTimer: number;
}

export interface TrappedRareCreature {
  id: string;
  speciesLabel: string;
  kind: 'rare-turtle' | 'bluefin-tuna' | 'manta-ray' | 'hammerhead' | 'regal-angelfish';
  offsetX: number;
  depthY: number;
  strugglePhase: number;
  primaryColor: string;
  accentColor: string;
}

export interface PoachingShipWithNet {
  id: string;
  vesselName: string;
  callsign: string;
  baseX: number;
  x: number;
  y: number;
  hullColor: string;
  trimColor: string;
  bobPhase: number;
  beaconPhase: number;
  netWidth: number;
  netTopY: number;
  netBottomY: number;
  swayPhase: number;
  trappedCreatures: TrappedRareCreature[];
}

export type DetectionCategory = 'threat' | 'life' | 'pollution';

export interface RovState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tilt: number; // radians
  facing: 1 | -1;
  battery: number; // 0 to 100
  lightsOn: boolean;
  overlayOn: boolean;
  mode: RovMode;
  thrusterPhase: number;
  sonarAngle: number;
  shakeTimer: number;
  shakeMagnitude: number;
  patrolWaypointIdx: number;
  surveyDir: 1 | -1;
  surveyTargetDepthY: number;
}

export interface BoidFish {
  id: number;
  schoolId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colorBody: string;
  colorFin: string;
  tailPhase: number;
}

export interface BubbleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

export interface MarineSnowParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speedY: number;
  driftPhase: number;
}

export interface OilDroplet {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vy: number;
  wobblePhase: number;
}

export interface KelpStalk {
  x: number;
  baseY: number;
  height: number;
  segments: number;
  color: string;
  phaseOffset: number;
}

export interface CoralCluster {
  id: string;
  x: number;
  y: number;
  type: 'branch' | 'brain' | 'fan' | 'tube' | 'bleached';
  color: string;
  secondaryColor: string;
  scale: number;
}

export interface PlasticItem {
  id: string;
  kind: 'bottle' | 'bag';
  x: number;
  y: number;
  baseY: number;
  vx: number;
  rotation: number;
  rotSpeed: number;
  floating: boolean;
  color: string;
}

export interface MicroplasticSpeck {
  x: number;
  y: number;
  size: number;
  color: string;
  phase: number;
}

export interface SeahorseEntity {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  color: string;
}

export interface DetectableTarget {
  id: string;
  label: string;
  category: DetectionCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  baseConfidence: number;
}

export interface ActiveDetection {
  id: string;
  label: string;
  category: DetectionCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  distanceMeters: number;
  firstSeenSec: number;
  lastSeenSec: number;
}

export interface RecentDetectionRecord {
  id: string;
  label: string;
  category: DetectionCategory;
  confidence: number;
  distanceMeters: number;
  timestampStr: string;
  lastUpdatedSec: number;
  worldX: number;
  worldY: number;
}

export interface SonarEcho {
  id: string;
  dx: number;
  dy: number;
  category: DetectionCategory;
  alpha: number;
}

export interface WorldState {
  timeSec: number;
  camera: {
    x: number;
    y: number;
    shakeX: number;
    shakeY: number;
  };
  rov: RovState;
  aegisShip: {
    x: number;
    y: number;
    bobPhase: number;
    radarAngle: number;
  };
  suspiciousShip: {
    x: number;
    y: number;
    bobPhase: number;
    beaconPhase: number;
  };
  poachingShips: PoachingShipWithNet[];
  satellite: {
    x: number;
    y: number;
    pulsePhase: number;
  };
  boids: BoidFish[];
  seaTurtle: {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    flipperPhase: number;
  };
  entangledTurtle: {
    id: string;
    x: number;
    y: number;
    strugglePhase: number;
  };
  shark: {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    tailPhase: number;
    patrolMinX: number;
    patrolMaxX: number;
  };
  dolphin: {
    id: string;
    x: number;
    y: number;
    vx: number;
    arcPhase: number;
  };
  seahorses: SeahorseEntity[];
  kelp: KelpStalk[];
  corals: CoralCluster[];
  plastics: PlasticItem[];
  microplastics: MicroplasticSpeck[];
  oilPlumeSource: { x: number; y: number };
  oilDroplets: OilDroplet[];
  ghostNet: { x: number; y: number; width: number; height: number };
  shipwreck: { x: number; y: number; width: number; height: number };
  pipeline: { startX: number; endX: number };
  trawlScars: Array<{ startX: number; endX: number }>;
  seabedAnomaly: { x: number; y: number; pulsePhase: number };
  bubbles: BubbleParticle[];
  marineSnow: MarineSnowParticle[];
  activeDetections: ActiveDetection[];
  recentDetections: RecentDetectionRecord[];
  sonarEchoes: SonarEcho[];
  patrolWaypoints: Array<{ x: number; y: number }>;
  alertHeap: AlertMaxHeap;
  commsQueue: SensorCircularQueue<SensorTelemetryPacket>;
  commsOffline: boolean;
  lastCommsSampleSec: number;
  lastFlushedCount: number;
  packetSeq: number;
  positionStack: PositionStack;
  safetyState: {
    isWarning: boolean;
    isBacktracking: boolean;
    hazardName: string;
    backtrackTarget: VisitedWaypoint | null;
    backtrackTimer: number;
    poppedCount: number;
  };
  dfsSurvey: {
    enabled: boolean;
    nodes: DfsSurveyNode[];
    gridCells: DfsSurveyNode[];
    currentNodeIdx: number;
  };
  netTackle: NetTackleState;
}

export interface ControlInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// Deterministic hash & 1D smooth value noise
export function hash1D(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function noise1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1D(i);
  const b = hash1D(i + 1);
  return a + (b - a) * u;
}

export function fbm1D(x: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let o = 0; o < octaves; o++) {
    value += amplitude * noise1D(x * frequency);
    frequency *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

/**
 * Returns the seabed Y coordinate (in world pixels) at world X [0..6000].
 * Surface is at Y = 180; seabed varies between Y = 920 and Y = 1310.
 */
export function getSeabedY(x: number): number {
  const clampedX = Math.max(0, Math.min(WORLD_WIDTH, x));
  // Shallow coastal coral reef shelf around x = 0..1300 (y ~ 715..765) so sky, ship, waves, fish, kelp, coral, and ROV are all visible on load;
  // then slopes into the deep ocean trench (y ~ 960..1300) for deep-sea exploration.
  const shelfFactor = Math.max(0, Math.min(1, (clampedX - 1100) / 550));
  const shallowShelfY = 725 + Math.sin(clampedX * 0.005) * 28 + Math.cos(clampedX * 0.011) * 18;
  const deepTrenchY =
    1040 +
    Math.sin(clampedX * 0.0012) * 110 +
    Math.cos(clampedX * 0.0024 - 1.2) * 75 +
    (clampedX / WORLD_WIDTH) * 85 +
    (fbm1D(clampedX * 0.0045, 4) - 0.5) * 160;
  const blended = shallowShelfY * (1 - shelfFactor) + deepTrenchY * shelfFactor;
  const ripples = Math.sin(clampedX * 0.09) * 4.0;
  return Math.max(685, Math.min(MAX_WORLD_Y - 50, blended + ripples));
}

/**
 * Returns the animated surface wave Y coordinate at world X and timeSec.
 */
export function getWaveY(x: number, timeSec: number): number {
  return (
    SURFACE_Y +
    Math.sin(x * 0.018 + timeSec * 2.1) * 6.5 +
    Math.sin(x * 0.042 - timeSec * 1.4) * 3.2 +
    Math.cos(x * 0.008 + timeSec * 0.9) * 4.0
  );
}

/**
 * Converts world Y to realistic depth in meters (0m at SURFACE_Y, ~240m at MAX_WORLD_Y)
 */
export function worldYToDepthMeters(y: number): number {
  return Math.max(0, (y - SURFACE_Y) * 0.2);
}

/**
 * Water temperature in Celsius dropping realistically with depth (thermocline)
 */
export function getWaterTemperatureCelsius(y: number): number {
  const depthM = worldYToDepthMeters(y);
  const surfaceTemp = 23.4;
  const deepTemp = 5.8;
  const factor = 1 - Math.exp(-depthM / 85);
  return Number((surfaceTemp - (surfaceTemp - deepTemp) * factor).toFixed(1));
}

/**
 * Ocean current horizontal velocity (px/s) varying with depth and time
 */
export function getOceanCurrentVx(y: number, timeSec: number): number {
  const depthNorm = Math.max(0, Math.min(1, (y - SURFACE_Y) / WORLD_DEPTH));
  return Math.sin(depthNorm * Math.PI * 2.5 + timeSec * 0.35) * 14 * (1 - depthNorm * 0.45);
}

const SCHOOL_PALETTES = [
  { body: '#38bdf8', fin: '#fde047' }, // Blue tang / yellow tail
  { body: '#fb923c', fin: '#fef08a' }, // Anthias orange-gold
  { body: '#2dd4bf', fin: '#ccfbf1' }, // Damselfish cyan-teal
  { body: '#f472b6', fin: '#fbcfe8' }, // Reef magenta
  { body: '#a3e635', fin: '#fef9c3' }, // Wrasse lime-yellow
];

export function createInitialWorldState(): WorldState {
  // 160 boid fish across 5 schools
  const boids: BoidFish[] = [];
  const schoolCenters = [
    { x: 960, y: 470 },
    { x: 1650, y: 640 },
    { x: 2650, y: 560 },
    { x: 3580, y: 690 },
    { x: 4820, y: 580 },
  ];

  for (let i = 0; i < 165; i++) {
    const schoolId = i % schoolCenters.length;
    const center = schoolCenters[schoolId];
    const palette = SCHOOL_PALETTES[schoolId];
    const angle = hash1D(i * 13.7) * Math.PI * 2;
    const dist = hash1D(i * 29.3) * 140;
    const speed = 45 + hash1D(i * 7.1) * 35;
    boids.push({
      id: i,
      schoolId,
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.3,
      size: 6.5 + (i % 5) * 1.1,
      colorBody: palette.body,
      colorFin: palette.fin,
      tailPhase: hash1D(i * 3.3) * Math.PI * 2,
    });
  }

  // Swaying kelp stalks along the seabed
  const kelp: KelpStalk[] = [];
  const kelpColors = ['#15803d', '#166534', '#0d9488', '#0f766e', '#4d7c0f'];
  for (let i = 0; i < 68; i++) {
    const x = 180 + i * 84 + (hash1D(i * 19.1) - 0.5) * 45;
    const baseY = getSeabedY(x);
    kelp.push({
      x,
      baseY,
      height: 85 + hash1D(i * 41.2) * 145,
      segments: 7,
      color: kelpColors[i % kelpColors.length],
      phaseOffset: hash1D(i * 11.9) * Math.PI * 2,
    });
  }

  // Coral clusters (healthy colorful + bleached coral patch around x = 3450..3660)
  const corals: CoralCluster[] = [];
  const coralPalette = [
    { main: '#f43f5e', sec: '#fda4af', type: 'branch' as const },
    { main: '#a855f7', sec: '#d8b4fe', type: 'fan' as const },
    { main: '#f97316', sec: '#fdba74', type: 'tube' as const },
    { main: '#ec4899', sec: '#f9a8d4', type: 'brain' as const },
    { main: '#eab308', sec: '#fef08a', type: 'branch' as const },
    { main: '#06b6d4', sec: '#67e8f9', type: 'fan' as const },
  ];

  for (let i = 0; i < 46; i++) {
    const x = 260 + i * 122 + (hash1D(i * 53.7) - 0.5) * 40;
    const isBleachedZone = x >= 3420 && x <= 3680;
    const spec = coralPalette[i % coralPalette.length];
    corals.push({
      id: `coral-${i}`,
      x,
      y: getSeabedY(x),
      type: isBleachedZone ? 'bleached' : spec.type,
      color: isBleachedZone ? '#e2e8f0' : spec.main,
      secondaryColor: isBleachedZone ? '#f8fafc' : spec.sec,
      scale: 0.85 + hash1D(i * 17.4) * 0.65,
    });
  }

  // Ensure a dense bleached coral patch right around x = 3540
  const bleachedExtras = [3470, 3515, 3555, 3595, 3635];
  bleachedExtras.forEach((bx, idx) => {
    corals.push({
      id: `coral-bleached-${idx}`,
      x: bx,
      y: getSeabedY(bx),
      type: 'bleached',
      color: '#f1f5f9',
      secondaryColor: '#cbd5e1',
      scale: 1.15 + (idx % 2) * 0.25,
    });
  });

  // Seahorses near healthy coral clusters
  const seahorseXPositions = [780, 815, 1380, 1410, 3050, 3085];
  const seahorseColors = ['#facc15', '#fb923c', '#f472b6', '#38bdf8', '#fde047', '#fb7185'];
  const seahorses: SeahorseEntity[] = seahorseXPositions.map((sx, idx) => {
    const sy = getSeabedY(sx) - 52 - (idx % 2) * 24;
    return {
      id: `seahorse-${idx + 1}`,
      x: sx,
      y: sy,
      baseX: sx,
      baseY: sy,
      phase: idx * 1.3,
      color: seahorseColors[idx % seahorseColors.length],
    };
  });

  // Plastic waste: bottles & bags (both drifting in water column and resting on seabed)
  const plastics: PlasticItem[] = [
    // Close to initial ROV patrol path so detections trigger quickly!
    { id: 'plastic-bottle-1', kind: 'bottle', x: 1090, y: 490, baseY: 490, vx: 6, rotation: 0.4, rotSpeed: 0.3, floating: true, color: '#38bdf8' },
    { id: 'plastic-bag-1', kind: 'bag', x: 1185, y: 580, baseY: 580, vx: 5, rotation: -0.2, rotSpeed: 0.2, floating: true, color: '#e2e8f0' },
    { id: 'plastic-bottle-2', kind: 'bottle', x: 1290, y: getSeabedY(1290) - 8, baseY: getSeabedY(1290) - 8, vx: 0, rotation: 1.1, rotSpeed: 0, floating: false, color: '#60a5fa' },
    { id: 'plastic-bag-2', kind: 'bag', x: 1580, y: 720, baseY: 720, vx: 4, rotation: 0.1, rotSpeed: 0.25, floating: true, color: '#cbd5e1' },
    { id: 'plastic-bottle-3', kind: 'bottle', x: 2040, y: getSeabedY(2040) - 8, baseY: getSeabedY(2040) - 8, vx: 0, rotation: -0.9, rotSpeed: 0, floating: false, color: '#38bdf8' },
    { id: 'plastic-bag-3', kind: 'bag', x: 2490, y: 660, baseY: 660, vx: -4, rotation: 0.3, rotSpeed: 0.2, floating: true, color: '#f1f5f9' },
    { id: 'plastic-bottle-4', kind: 'bottle', x: 3120, y: 540, baseY: 540, vx: 5, rotation: 0.8, rotSpeed: 0.35, floating: true, color: '#22d3ee' },
    { id: 'plastic-bag-4', kind: 'bag', x: 3890, y: getSeabedY(3890) - 10, baseY: getSeabedY(3890) - 10, vx: 0, rotation: 0.2, rotSpeed: 0, floating: false, color: '#e2e8f0' },
    { id: 'plastic-bottle-5', kind: 'bottle', x: 4480, y: 630, baseY: 630, vx: 6, rotation: -0.5, rotSpeed: 0.3, floating: true, color: '#38bdf8' },
    { id: 'plastic-bag-5', kind: 'bag', x: 5060, y: 740, baseY: 740, vx: 4, rotation: 0.4, rotSpeed: 0.2, floating: true, color: '#cbd5e1' },
  ];

  // Microplastic specks drifting
  const microplastics: MicroplasticSpeck[] = [];
  const microColors = ['#f43f5e', '#facc15', '#38bdf8', '#a855f7', '#fb923c'];
  for (let i = 0; i < 95; i++) {
    const mx = 400 + hash1D(i * 61.3) * 5200;
    const my = SURFACE_Y + 60 + hash1D(i * 83.9) * (WORLD_DEPTH - 140);
    microplastics.push({
      x: mx,
      y: my,
      size: 1.8 + (i % 3) * 0.9,
      color: microColors[i % microColors.length],
      phase: hash1D(i * 19.7) * Math.PI * 2,
    });
  }

  // Marine snow particles across the water column
  const marineSnow: MarineSnowParticle[] = [];
  for (let i = 0; i < 180; i++) {
    marineSnow.push({
      x: hash1D(i * 37.2) * WORLD_WIDTH,
      y: SURFACE_Y + 20 + hash1D(i * 71.8) * (WORLD_DEPTH - 40),
      size: 1.0 + (i % 3) * 0.8,
      alpha: 0.2 + hash1D(i * 13.1) * 0.45,
      speedY: 6 + hash1D(i * 23.4) * 10,
      driftPhase: hash1D(i * 43.9) * Math.PI * 2,
    });
  }

  // Oil leak plume rising from pipeline fracture at x = 2350
  const oilSourceX = 2350;
  const oilSourceY = getSeabedY(oilSourceX) - 6;
  const oilDroplets: OilDroplet[] = [];
  for (let i = 0; i < 42; i++) {
    const progress = i / 42;
    oilDroplets.push({
      x: oilSourceX + (hash1D(i * 17.3) - 0.5) * (18 + progress * 90),
      y: oilSourceY - progress * 340,
      radius: 10 + progress * 34,
      alpha: (1 - progress * 0.82) * 0.52,
      vy: -(24 + hash1D(i * 31.1) * 16),
      wobblePhase: hash1D(i * 9.7) * Math.PI * 2,
    });
  }

  const ghostNetX = 1480;
  const ghostNetY = getSeabedY(ghostNetX) - 42;

  const shipwreckX = 2820;
  const shipwreckY = getSeabedY(shipwreckX) - 35;

  const anomalyX = 4180;
  const anomalyY = getSeabedY(anomalyX) - 12;

  // Patrol waypoints spanning the full 6000px ocean from West to East and back, with safe clearance above seabed hazards
  const patrolWaypoints = [
    { x: 1120, y: 480 }, // 0: Plastic bottle & bag cluster + boid school + turtle
    { x: 1480, y: ghostNetY - 155 }, // 1: Safe overhead pass above Ghost Net & Entangled Sea Turtle
    { x: 1960, y: 455 }, // 2: East of Poaching Ship #1 (FV HAI LONG 88 at X:1740) — triggers Net Tackle pass
    { x: 2350, y: oilSourceY - 145 }, // 3: Subsea pipeline oil-leak plume
    { x: 2820, y: shipwreckY - 165 }, // 4: Safe overhead pass above Shipwreck
    { x: 3580, y: 495 }, // 5: East of Poaching Ship #2 (FV BLACK MARLIN at X:3360 MPA) — triggers Net Tackle pass
    { x: 4180, y: anomalyY - 135 }, // 6: Deep trench glowing metallic seabed anomaly
    { x: 4880, y: 460 }, // 7: East of Poaching Ship #3 (FV KRAKEN-04 at X:4650) — triggers Net Tackle pass
    { x: 5380, y: 520 }, // 8: Far eastern deep-pelagic sector (completes full 6km area sweep)
    { x: 840, y: 206 }, // 9: High-altitude surface-corridor return transit back to AEGIS mothership
  ];

  // 3 Illegal Poaching Ships on the sea surface with long submerged drift/gill nets trapping rare species
  const poachingShips: PoachingShipWithNet[] = [
    {
      id: 'poaching-ship-1',
      vesselName: 'FV HAI LONG 88',
      callsign: 'DRIFT-NETTER [V-001]',
      baseX: 1740,
      x: 1740,
      y: SURFACE_Y,
      hullColor: '#3b1d2e',
      trimColor: '#ef4444',
      bobPhase: 0.4,
      beaconPhase: 0,
      netWidth: 128,
      netTopY: SURFACE_Y + 8,
      netBottomY: 585,
      swayPhase: 0.2,
      trappedCreatures: [
        {
          id: 'trapped-rare-turtle-1',
          speciesLabel: 'Trapped Rare Sea Turtle',
          kind: 'rare-turtle',
          offsetX: -14,
          depthY: 365,
          strugglePhase: 0.5,
          primaryColor: '#15803d',
          accentColor: '#fde047',
        },
        {
          id: 'trapped-bluefin-1',
          speciesLabel: 'Trapped Golden Bluefin Tuna',
          kind: 'bluefin-tuna',
          offsetX: 16,
          depthY: 455,
          strugglePhase: 1.8,
          primaryColor: '#0284c7',
          accentColor: '#facc15',
        },
        {
          id: 'trapped-angelfish-1',
          speciesLabel: 'Trapped Rare Sea Turtle',
          kind: 'regal-angelfish',
          offsetX: -8,
          depthY: 535,
          strugglePhase: 3.1,
          primaryColor: '#a855f7',
          accentColor: '#fde047',
        },
      ],
    },
    {
      id: 'poaching-ship-2',
      vesselName: 'FV BLACK MARLIN',
      callsign: 'MPA GILLNETTER [V-005]',
      baseX: 3360,
      x: 3360,
      y: SURFACE_Y,
      hullColor: '#27272a',
      trimColor: '#f97316',
      bobPhase: 1.9,
      beaconPhase: 1.2,
      netWidth: 140,
      netTopY: SURFACE_Y + 8,
      netBottomY: 665,
      swayPhase: 1.4,
      trappedCreatures: [
        {
          id: 'trapped-hawksbill-2',
          speciesLabel: 'Trapped Hawksbill Turtle',
          kind: 'rare-turtle',
          offsetX: 14,
          depthY: 395,
          strugglePhase: 0.9,
          primaryColor: '#b45309',
          accentColor: '#fef08a',
        },
        {
          id: 'trapped-manta-2',
          speciesLabel: 'Trapped Reef Manta Ray',
          kind: 'manta-ray',
          offsetX: -12,
          depthY: 505,
          strugglePhase: 2.3,
          primaryColor: '#0e7490',
          accentColor: '#67e8f9',
        },
        {
          id: 'trapped-bluefin-2',
          speciesLabel: 'Trapped Golden Bluefin Tuna',
          kind: 'bluefin-tuna',
          offsetX: 10,
          depthY: 605,
          strugglePhase: 3.9,
          primaryColor: '#1d4ed8',
          accentColor: '#fde047',
        },
      ],
    },
    {
      id: 'poaching-ship-3',
      vesselName: 'FV KRAKEN-04',
      callsign: 'DEEP PELAGIC SEINE [V-008]',
      baseX: 4650,
      x: 4650,
      y: SURFACE_Y,
      hullColor: '#1e1b4b',
      trimColor: '#f43f5e',
      bobPhase: 1.7,
      beaconPhase: 2.5,
      netWidth: 136,
      netTopY: SURFACE_Y + 8,
      netBottomY: 635,
      swayPhase: 2.7,
      trappedCreatures: [
        {
          id: 'trapped-hammerhead-3',
          speciesLabel: 'Trapped Hammerhead Shark',
          kind: 'hammerhead',
          offsetX: -10,
          depthY: 425,
          strugglePhase: 1.1,
          primaryColor: '#475569',
          accentColor: '#bae6fd',
        },
        {
          id: 'trapped-turtle-3',
          speciesLabel: 'Trapped Rare Sea Turtle',
          kind: 'rare-turtle',
          offsetX: 15,
          depthY: 545,
          strugglePhase: 2.6,
          primaryColor: '#166534',
          accentColor: '#bef264',
        },
      ],
    },
  ];

  const initialState: WorldState = {
    timeSec: 0,
    camera: {
      x: 920,
      y: 440,
      shakeX: 0,
      shakeY: 0,
    },
    rov: {
      x: 920,
      y: 440,
      vx: 78,
      vy: 18,
      tilt: 0.08,
      facing: 1,
      battery: 98.4,
      lightsOn: true,
      overlayOn: true,
      mode: 'Auto Patrol',
      thrusterPhase: 0,
      sonarAngle: 0,
      shakeTimer: 0,
      shakeMagnitude: 0,
      patrolWaypointIdx: 0,
      surveyDir: 1,
      surveyTargetDepthY: 360,
    },
    aegisShip: {
      x: 840,
      y: SURFACE_Y,
      bobPhase: 0,
      radarAngle: 0,
    },
    suspiciousShip: {
      x: 4650,
      y: SURFACE_Y,
      bobPhase: 1.7,
      beaconPhase: 0,
    },
    poachingShips,
    satellite: {
      x: 680,
      y: 44,
      pulsePhase: 0,
    },
    boids,
    seaTurtle: {
      id: 'turtle-free',
      x: 1035,
      y: 445,
      vx: 36,
      vy: 4,
      flipperPhase: 0,
    },
    entangledTurtle: {
      id: 'turtle-entangled',
      x: ghostNetX + 18,
      y: ghostNetY - 16,
      strugglePhase: 0,
    },
    shark: {
      id: 'shark-patrol',
      x: 1860,
      y: 620,
      vx: 68,
      vy: 0,
      tailPhase: 0,
      patrolMinX: 1620,
      patrolMaxX: 2320,
    },
    dolphin: {
      id: 'dolphin-1',
      x: 1180,
      y: SURFACE_Y + 45,
      vx: 115,
      arcPhase: 0,
    },
    seahorses,
    kelp,
    corals,
    plastics,
    microplastics,
    oilPlumeSource: { x: oilSourceX, y: oilSourceY },
    oilDroplets,
    ghostNet: { x: ghostNetX, y: ghostNetY, width: 150, height: 82 },
    shipwreck: { x: shipwreckX, y: shipwreckY, width: 260, height: 115 },
    pipeline: { startX: 1950, endX: 2740 },
    trawlScars: [
      { startX: 1360, endX: 1760 },
      { startX: 3260, endX: 3780 },
      { startX: 4380, endX: 4920 },
    ],
    seabedAnomaly: { x: anomalyX, y: anomalyY, pulsePhase: 0 },
    bubbles: [],
    marineSnow,
    activeDetections: [],
    recentDetections: [],
    sonarEchoes: [],
    patrolWaypoints,
    alertHeap: new AlertMaxHeap(),
    commsQueue: new SensorCircularQueue<SensorTelemetryPacket>(12),
    commsOffline: false,
    lastCommsSampleSec: 0,
    lastFlushedCount: 0,
    packetSeq: 1,
    positionStack: new PositionStack(14),
    safetyState: {
      isWarning: false,
      isBacktracking: false,
      hazardName: '',
      backtrackTarget: null,
      backtrackTimer: 0,
      poppedCount: 0,
    },
    dfsSurvey: (() => {
      const dfs = generateRecursiveDfsSurvey(6, 3);
      return {
        enabled: true,
        nodes: dfs.traversalOrder,
        gridCells: dfs.gridCells,
        currentNodeIdx: 0,
      };
    })(),
    netTackle: {
      strategy: 'UNDER_NET',
      active: false,
      activePass: 'UNDER_NET',
      targetNetId: 'poaching-ship-1',
      targetNetName: 'FV HAI LONG 88',
      phase: 'IDLE',
      waypointIdx: 0,
      waypoints: [],
      overCorridorY: SURFACE_Y + 26,
      underCorridorY: 647,
      netCenterX: 1740,
      netTopY: SURFACE_Y + 8,
      netBottomY: 585,
      clearedCount: 0,
      lastClearedNetName: '',
      cooldownTimer: 0,
    },
  };

  // Seed initial safe breadcrumbs on the waypoint retrace stack
  initialState.positionStack.push({ x: 840, y: 360, depthMeters: 36.0, timestampSec: 0 });
  initialState.positionStack.push({ x: 920, y: 440, depthMeters: 52.0, timestampSec: 0 });

  // Seed initial high-priority alerts so the Threat Triage & Rapid Dispatch system is live immediately
  initialState.alertHeap.insert({
    id: 'alert-init-poacher-1',
    targetId: 'poaching-net-1',
    title: 'Attached Long Drift-Net (FV HAI LONG 88)',
    category: 'threat',
    riskScore: 97,
    severity: 'CRITICAL',
    depthMeters: 48.0,
    worldX: 1740,
    worldY: 420,
    timestampStr: '00:00',
  });
  initialState.alertHeap.insert({
    id: 'alert-init-vessel',
    targetId: 'suspicious-vessel-1',
    title: 'Poaching Drift-Netter (FV KRAKEN-04)',
    category: 'threat',
    riskScore: 96,
    severity: 'CRITICAL',
    depthMeters: 2.0,
    worldX: 4650,
    worldY: SURFACE_Y,
    timestampStr: '00:00',
  });
  initialState.alertHeap.insert({
    id: 'alert-init-net',
    targetId: 'ghost-net-1',
    title: 'Ghost Net',
    category: 'threat',
    riskScore: 89,
    severity: 'CRITICAL',
    depthMeters: Number(worldYToDepthMeters(ghostNetY).toFixed(1)),
    worldX: ghostNetX,
    worldY: ghostNetY,
    timestampStr: '00:00',
  });
  initialState.alertHeap.insert({
    id: 'alert-init-oil',
    targetId: 'oil-plume-1',
    title: 'Oil Plume',
    category: 'threat',
    riskScore: 91,
    severity: 'CRITICAL',
    depthMeters: Number(worldYToDepthMeters(oilSourceY).toFixed(1)),
    worldX: oilSourceX,
    worldY: oilSourceY,
    timestampStr: '00:00',
  });

  // Run an initial detection scan so immediate targets in light cone / sonar are registered on frame 1
  scanDetections(initialState, 0);
  return initialState;
}

/**
 * Gathers all currently inspectable targets in the world with their current coordinates
 */
export function getInspectableTargets(state: WorldState): DetectableTarget[] {
  const targets: DetectableTarget[] = [];

  // Sea Turtle (free swimming)
  targets.push({
    id: state.seaTurtle.id,
    label: 'Sea Turtle',
    category: 'life',
    x: state.seaTurtle.x,
    y: state.seaTurtle.y,
    width: 74,
    height: 44,
    baseConfidence: 96,
  });

  // Entangled Sea Turtle inside Ghost Net
  targets.push({
    id: state.entangledTurtle.id,
    label: 'Entangled Sea Turtle',
    category: 'threat',
    x: state.entangledTurtle.x,
    y: state.entangledTurtle.y,
    width: 76,
    height: 48,
    baseConfidence: 94,
  });

  // Ghost Net
  targets.push({
    id: 'ghost-net-1',
    label: 'Ghost Net',
    category: 'threat',
    x: state.ghostNet.x,
    y: state.ghostNet.y,
    width: state.ghostNet.width,
    height: state.ghostNet.height,
    baseConfidence: 88,
  });

  // Poaching Trawlers, their Attached Long Drift-Nets, and Trapped Rare Species
  for (const ship of state.poachingShips) {
    targets.push({
      id: ship.id,
      label: 'Poaching Drift-Netter',
      category: 'threat',
      x: ship.x,
      y: ship.y + 8,
      width: 196,
      height: 66,
      baseConfidence: 96,
    });

    const netMidY = (ship.netTopY + ship.netBottomY) * 0.54;
    targets.push({
      id: `${ship.id}-long-net`,
      label: 'Attached Long Drift-Net',
      category: 'threat',
      x: ship.x,
      y: netMidY,
      width: ship.netWidth,
      height: ship.netBottomY - ship.netTopY - 40,
      baseConfidence: 94,
    });

    for (const tc of ship.trappedCreatures) {
      targets.push({
        id: tc.id,
        label: tc.speciesLabel,
        category: 'threat',
        x: ship.x + tc.offsetX,
        y: tc.depthY,
        width: tc.kind === 'manta-ray' || tc.kind === 'hammerhead' ? 92 : 76,
        height: 48,
        baseConfidence: 95,
      });
    }
  }

  // Reef Shark
  targets.push({
    id: state.shark.id,
    label: 'Reef Shark',
    category: 'life',
    x: state.shark.x,
    y: state.shark.y,
    width: 128,
    height: 52,
    baseConfidence: 95,
  });

  // Dolphin
  targets.push({
    id: state.dolphin.id,
    label: 'Bottlenose Dolphin',
    category: 'life',
    x: state.dolphin.x,
    y: state.dolphin.y,
    width: 105,
    height: 44,
    baseConfidence: 92,
  });

  // Seahorses
  for (const sh of state.seahorses) {
    targets.push({
      id: sh.id,
      label: 'Seahorse',
      category: 'life',
      x: sh.x,
      y: sh.y,
      width: 28,
      height: 38,
      baseConfidence: 89,
    });
  }

  // Plastics (bottles and bags)
  for (const p of state.plastics) {
    targets.push({
      id: p.id,
      label: p.kind === 'bottle' ? 'Plastic Bottle' : 'Plastic Bag',
      category: 'pollution',
      x: p.x,
      y: p.y,
      width: p.kind === 'bottle' ? 34 : 38,
      height: p.kind === 'bottle' ? 24 : 32,
      baseConfidence: p.kind === 'bottle' ? 91 : 87,
    });
  }

  // Oil Plume
  targets.push({
    id: 'oil-plume-1',
    label: 'Oil Plume',
    category: 'threat',
    x: state.oilPlumeSource.x,
    y: state.oilPlumeSource.y - 110,
    width: 110,
    height: 210,
    baseConfidence: 84,
  });

  // Shipwreck
  targets.push({
    id: 'shipwreck-1',
    label: 'Shipwreck Hull',
    category: 'pollution',
    x: state.shipwreck.x,
    y: state.shipwreck.y,
    width: state.shipwreck.width,
    height: state.shipwreck.height,
    baseConfidence: 90,
  });

  // Bleached Coral Patch
  targets.push({
    id: 'bleached-coral-patch',
    label: 'Bleached Coral',
    category: 'pollution',
    x: 3550,
    y: getSeabedY(3550) - 24,
    width: 170,
    height: 60,
    baseConfidence: 86,
  });

  // Glowing Metallic Seabed Anomaly
  targets.push({
    id: 'seabed-anomaly-1',
    label: 'Seabed Anomaly',
    category: 'pollution',
    x: state.seabedAnomaly.x,
    y: state.seabedAnomaly.y,
    width: 86,
    height: 46,
    baseConfidence: 79,
  });

  // Suspicious Vessel (Dark Hull IUU Trawler)
  targets.push({
    id: 'suspicious-vessel-1',
    label: 'Suspicious Vessel',
    category: 'threat',
    x: state.suspiciousShip.x,
    y: state.suspiciousShip.y + 10,
    width: 185,
    height: 64,
    baseConfidence: 93,
  });

  return targets;
}

/**
 * Checks whether a target at (tx, ty) is inside the ROV's light cone or active sonar range
 */
export function isTargetDetectedByRov(rov: RovState, tx: number, ty: number): boolean {
  const dx = tx - rov.x;
  const dy = ty - rov.y;
  const dist = Math.hypot(dx, dy);

  // Active sonar omni-directional range (280 px)
  if (dist <= 280) {
    return true;
  }

  // Forward spotlight cone when lights are on (up to 480 px ahead within cone angle)
  if (rov.lightsOn && dist <= 480) {
    const dirX = rov.facing;
    const forwardDot = (dx * dirX) / Math.max(1, dist);
    // Cone half-angle ~ 38 degrees (cos(38 deg) ~ 0.78)
    if (forwardDot > 0.62 && Math.abs(dy) < dist * 0.68 + 45) {
      return true;
    }
  }

  return false;
}

function formatMissionTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const mins = Math.floor(total / 60);
  const remSec = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

/**
 * Updates activeDetections, deduplicated recentDetections, and sonarEchoes
 */
export function scanDetections(state: WorldState, nowSec: number): void {
  const targets = getInspectableTargets(state);
  const prevMap = new Map<string, ActiveDetection>();
  for (const prev of state.activeDetections) {
    prevMap.set(prev.id, prev);
  }

  const nextActive: ActiveDetection[] = [];
  const nextEchoes: SonarEcho[] = [];
  const sonarRange = 540;

  for (const t of targets) {
    const dx = t.x - state.rov.x;
    const dy = t.y - state.rov.y;
    const distPx = Math.hypot(dx, dy);
    const distMeters = Number((distPx * 0.2).toFixed(1));

    // Sonar echo blip if within 540 px
    if (distPx <= sonarRange) {
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = state.rov.sonarAngle - targetAngle;
      while (angleDiff < 0) angleDiff += Math.PI * 2;
      while (angleDiff >= Math.PI * 2) angleDiff -= Math.PI * 2;
      const alpha = Math.max(0.18, 1 - angleDiff / (Math.PI * 2));
      nextEchoes.push({
        id: t.id,
        dx: dx / sonarRange,
        dy: dy / sonarRange,
        category: t.category,
        alpha,
      });
    }

    if (isTargetDetectedByRov(state.rov, t.x, t.y)) {
      const prev = prevMap.get(t.id);
      // Slight realistic confidence jitter +/- 2%
      const confVariation = Math.round(Math.sin(nowSec * 1.9 + t.x * 0.03) * 1.5);
      const confidence = Math.max(72, Math.min(99, t.baseConfidence + confVariation));

      nextActive.push({
        id: t.id,
        label: t.label,
        category: t.category,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        confidence,
        distanceMeters: distMeters,
        firstSeenSec: prev ? prev.firstSeenSec : nowSec,
        lastSeenSec: nowSec,
      });

      // Upsert into recentDetections WITHOUT duplicates for the same object ID
      const existingIdx = state.recentDetections.findIndex((r) => r.id === t.id);
      const record: RecentDetectionRecord = {
        id: t.id,
        label: t.label,
        category: t.category,
        confidence,
        distanceMeters: distMeters,
        timestampStr: formatMissionTime(nowSec),
        lastUpdatedSec: nowSec,
        worldX: t.x,
        worldY: t.y,
      };

      if (existingIdx >= 0) {
        // Update in-place and move to top if newly re-acquired after > 4s
        const wasStale = nowSec - state.recentDetections[existingIdx].lastUpdatedSec > 4.0;
        state.recentDetections[existingIdx] = record;
        if (wasStale && existingIdx > 0) {
          const [item] = state.recentDetections.splice(existingIdx, 1);
          state.recentDetections.unshift(item);
        }
      } else {
        state.recentDetections.unshift(record);
        if (state.recentDetections.length > 18) {
          state.recentDetections.pop();
        }
      }

      // Enqueue into Binary Max-Heap Priority Queue if threat or pollution alert
      const riskInfo = computeAlertRiskScore(t.label, t.category, confidence);
      if (riskInfo) {
        state.alertHeap.insert({
          id: `alert-${t.id}`,
          targetId: t.id,
          title: t.label,
          category: t.category,
          riskScore: riskInfo.riskScore,
          severity: riskInfo.severity,
          depthMeters: Number(worldYToDepthMeters(t.y).toFixed(1)),
          worldX: Math.round(t.x),
          worldY: Math.round(t.y),
          timestampStr: formatMissionTime(nowSec),
        });
      }
    }
  }

  state.activeDetections = nextActive;
  state.sonarEchoes = nextEchoes;
}

/**
 * Updates the 165 boids using separation, alignment, cohesion, school home attraction,
 * surface/seabed collision avoidance, and ROV scare repulsion.
 */
export function stepBoids(state: WorldState, dt: number): void {
  const boids = state.boids;
  const count = boids.length;
  const rovX = state.rov.x;
  const rovY = state.rov.y;

  const neighborDist = 68;
  const separationDist = 22;
  const scareDist = 175;

  for (let i = 0; i < count; i++) {
    const b = boids[i];
    let sepX = 0;
    let sepY = 0;
    let alignX = 0;
    let alignY = 0;
    let cohX = 0;
    let cohY = 0;
    let neighbors = 0;

    // Sample a stride of boids in same school for fast O(N) performance
    for (let j = i % 3; j < count; j += 3) {
      if (i === j) continue;
      const other = boids[j];
      if (other.schoolId !== b.schoolId) continue;

      const dx = other.x - b.x;
      const dy = other.y - b.y;
      if (Math.abs(dx) > neighborDist || Math.abs(dy) > neighborDist) continue;

      const d = Math.hypot(dx, dy);
      if (d > 0 && d < neighborDist) {
        alignX += other.vx;
        alignY += other.vy;
        cohX += other.x;
        cohY += other.y;
        neighbors++;

        if (d < separationDist) {
          sepX -= (dx / d) * (separationDist - d);
          sepY -= (dy / d) * (separationDist - d);
        }
      }
    }

    if (neighbors > 0) {
      alignX /= neighbors;
      alignY /= neighbors;
      cohX = cohX / neighbors - b.x;
      cohY = cohY / neighbors - b.y;

      b.vx += (sepX * 2.4 + (alignX - b.vx) * 1.1 + cohX * 0.45) * dt;
      b.vy += (sepY * 2.4 + (alignY - b.vy) * 1.1 + cohY * 0.45) * dt;
    }

    // Scare away from ROV!
    const rdx = b.x - rovX;
    const rdy = b.y - rovY;
    const rDist = Math.hypot(rdx, rdy);
    if (rDist > 0 && rDist < scareDist) {
      const fleeStrength = ((scareDist - rDist) / scareDist) * 420;
      b.vx += (rdx / rDist) * fleeStrength * dt;
      b.vy += (rdy / rDist) * fleeStrength * dt;
    }

    // Scare away from patrolling shark
    const sdx = b.x - state.shark.x;
    const sdy = b.y - state.shark.y;
    const sDist = Math.hypot(sdx, sdy);
    if (sDist > 0 && sDist < 150) {
      const sharkFlee = ((150 - sDist) / 150) * 320;
      b.vx += (sdx / sDist) * sharkFlee * dt;
      b.vy += (sdy / sDist) * sharkFlee * dt;
    }

    // Keep within water column vertically
    const minSurface = SURFACE_Y + 45;
    const maxSeabed = getSeabedY(b.x) - 38;
    if (b.y < minSurface) {
      b.vy += (minSurface - b.y) * 4.5 * dt;
    } else if (b.y > maxSeabed) {
      b.vy -= (b.y - maxSeabed) * 5.5 * dt;
    }

    // Soft horizontal world bounds
    if (b.x < 160) b.vx += 140 * dt;
    if (b.x > WORLD_WIDTH - 160) b.vx -= 140 * dt;

    // Clamp speed
    const speed = Math.hypot(b.vx, b.vy);
    const maxSpeed = rDist < scareDist ? 165 : 78;
    const minSpeed = 32;
    if (speed > maxSpeed) {
      b.vx = (b.vx / speed) * maxSpeed;
      b.vy = (b.vy / speed) * maxSpeed;
    } else if (speed < minSpeed) {
      const dir = b.vx >= 0 ? 1 : -1;
      b.vx = dir * minSpeed;
    }

    // Limit vertical steepness so fish swim naturally
    b.vy = Math.max(-55, Math.min(55, b.vy));

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.tailPhase += (6.5 + speed * 0.09) * dt;
  }
}

/**
 * Computes the safe Over-Net (surface crest) and Under-Net (deep dive) clearance Y coordinates for a poaching ship net
 */
export function getNetClearanceCorridors(ps: PoachingShipWithNet): {
  overCorridorY: number;
  underCorridorY: number;
} {
  // Over-Net corridor sits in the upper surface layer between wave limit (198) and the cork float headline (233+)
  const overCorridorY = SURFACE_Y + 26;
  // Under-Net corridor sits safely below the lead sinker line (netBottomY + 62) and well above the seabed
  const underCorridorY = Math.min(getSeabedY(ps.x) - 55, ps.netBottomY + 62);
  return { overCorridorY, underCorridorY };
}

/**
 * Resolves whether to pass ABOVE ('OVER_NET') or BELOW ('UNDER_NET') the net given the current strategy and ROV depth
 */
export function resolveNetTacklePass(
  strategy: NetTackleStrategy,
  rovY: number,
  overCorridorY: number,
  underCorridorY: number
): ResolvedNetPass {
  if (strategy === 'OVER_NET') return 'OVER_NET';
  if (strategy === 'UNDER_NET') return 'UNDER_NET';
  // ADAPTIVE: choose Over-Net when ROV is in the upper water column, or Under-Net when cruising deeper
  const distOver = Math.abs(rovY - overCorridorY);
  const distUnder = Math.abs(rovY - underCorridorY);
  return distOver <= distUnder || rovY < 395 ? 'OVER_NET' : 'UNDER_NET';
}

/**
/**
 * Advances patrolWaypointIdx and dfsSurvey.currentNodeIdx to the next waypoint ahead of netCenterX
 * in the direction of travel (dir) so the ROV never turns back toward an already-passed waypoint behind the net.
 */
export function syncRouteWaypointsPastNet(
  state: WorldState,
  netCenterX: number,
  dir: 1 | -1
): void {
  // 1. Sync Auto Patrol waypoint index to the next forward waypoint past the net
  const wps = state.patrolWaypoints;
  if (wps.length > 0) {
    if (dir === 1) {
      const nextEastIdx = wps.findIndex((wp) => wp.x > netCenterX + 100);
      if (nextEastIdx >= 0) {
        state.rov.patrolWaypointIdx = nextEastIdx;
      } else {
        state.rov.patrolWaypointIdx = wps.length - 1; // Return transit leg
      }
    } else {
      // Moving West on return leg: if still west of net, keep heading to wp[0]
      const curWp = wps[state.rov.patrolWaypointIdx % wps.length];
      if (curWp && curWp.x > netCenterX - 90) {
        state.rov.patrolWaypointIdx = 0;
      }
    }
  }

  // 2. Sync Auto Survey direction and DFS node index past the net
  state.rov.surveyDir = dir;
  const nodes = state.dfsSurvey.nodes;
  if (nodes.length > 0) {
    const startIdx = state.dfsSurvey.currentNodeIdx % nodes.length;
    for (let offset = 0; offset < nodes.length; offset++) {
      const idx = (startIdx + offset) % nodes.length;
      const n = nodes[idx];
      if (dir === 1 && n.worldX > netCenterX + 100) {
        state.dfsSurvey.currentNodeIdx = idx;
        break;
      }
      if (dir === -1 && n.worldX < netCenterX - 100) {
        state.dfsSurvey.currentNodeIdx = idx;
        break;
      }
    }
  }
}

/**
 * Engages the 3-waypoint Net Tackling maneuver (APPROACH_GATE -> CLEARANCE_PASS -> EXIT_GATE)
 * so the ROV clears a poaching ship's attached long net either from below (UNDER_NET) or above (OVER_NET).
 */
export function engageNetTackleOnShip(
  state: WorldState,
  shipIndex: number,
  forcedStrategy?: NetTackleStrategy,
  dirOverride?: 1 | -1
): void {
  const ps = state.poachingShips[shipIndex] || state.poachingShips[0];
  if (!ps) return;

  if (forcedStrategy) {
    state.netTackle.strategy = forcedStrategy;
  }

  const { overCorridorY, underCorridorY } = getNetClearanceCorridors(ps);
  const activePass = resolveNetTacklePass(
    state.netTackle.strategy,
    state.rov.y,
    overCorridorY,
    underCorridorY
  );
  const corridorY = activePass === 'OVER_NET' ? overCorridorY : underCorridorY;
  const dir: 1 | -1 = dirOverride ?? (state.rov.x <= ps.x ? 1 : -1);
  const halfSpan = Math.round(ps.netWidth * 0.5 + 84);

  const waypoints: NetTackleWaypoint[] = [
    {
      x: Math.round(ps.x - dir * halfSpan),
      y: Math.round(corridorY),
      label: activePass === 'OVER_NET' ? 'OVER-NET ENTRY GATE' : 'UNDER-NET DIVE GATE',
    },
    {
      x: Math.round(ps.x),
      y: Math.round(corridorY),
      label: activePass === 'OVER_NET' ? 'SKIM ABOVE NET HEADLINE' : 'PASS BENEATH LEAD LINE',
    },
    {
      x: Math.round(ps.x + dir * halfSpan),
      y: Math.round(corridorY),
      label: 'NET CLEARED — RESUME',
    },
  ];

  // Clear any active collision backtrack timer and advance route waypoints past this net
  state.safetyState.backtrackTimer = 0;
  state.safetyState.isWarning = false;
  state.safetyState.isBacktracking = false;
  syncRouteWaypointsPastNet(state, ps.x, dir);

  state.netTackle = {
    ...state.netTackle,
    active: true,
    activePass,
    targetNetId: ps.id,
    targetNetName: ps.vesselName,
    phase: 'APPROACH_GATE',
    waypointIdx: 0,
    waypoints,
    overCorridorY,
    underCorridorY,
    netCenterX: Math.round(ps.x),
    netTopY: ps.netTopY,
    netBottomY: ps.netBottomY,
    cooldownTimer: 0,
  };
}

/**
 * Advances the entire 2D underwater world by dt seconds.
 */
export function stepWorldSimulation(
  state: WorldState,
  input: ControlInput,
  dt: number,
  viewportWidth = 1280,
  viewportHeight = 720
): void {
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  state.timeSec += clampedDt;
  const t = state.timeSec;
  const rov = state.rov;

  // If user presses any manual directional key, immediately engage Manual control
  const hasManualInput = input.up || input.down || input.left || input.right;
  if (hasManualInput && rov.mode !== 'Manual' && rov.battery >= 15) {
    rov.mode = 'Manual';
  }

  // Battery auto-failsafe: under 15%, force Return to Base
  if (rov.battery < 15 && rov.mode !== 'Return to Base') {
    rov.mode = 'Return to Base';
  }

  // Cancel active net tackle if switched to Manual or Return to Base
  if (hasManualInput || rov.mode === 'Manual' || rov.mode === 'Return to Base') {
    state.netTackle.active = false;
    state.netTackle.phase = 'IDLE';
  }
  if (state.netTackle.cooldownTimer > 0) {
    state.netTackle.cooldownTimer = Math.max(0, state.netTackle.cooldownTimer - clampedDt);
  }

  // 3b. PROACTIVE NET TACKLING CHECK (Runs BEFORE emergency collision check when in Auto Patrol or Auto Survey)
  if (
    (rov.mode === 'Auto Patrol' || rov.mode === 'Auto Survey') &&
    !state.netTackle.active &&
    state.netTackle.cooldownTimer <= 0 &&
    state.safetyState.backtrackTimer <= 0
  ) {
    let intendedTargetX = rov.x + rov.facing * 300;
    if (rov.mode === 'Auto Patrol') {
      const wp = state.patrolWaypoints[rov.patrolWaypointIdx % state.patrolWaypoints.length];
      intendedTargetX = wp.x;
    } else if (rov.mode === 'Auto Survey') {
      if (state.dfsSurvey.enabled && state.dfsSurvey.nodes.length > 0) {
        const targetNode =
          state.dfsSurvey.nodes[state.dfsSurvey.currentNodeIdx % state.dfsSurvey.nodes.length];
        intendedTargetX = targetNode.worldX;
      } else {
        intendedTargetX = rov.surveyDir === 1 ? 5450 : 550;
      }
    }

    for (let sIdx = 0; sIdx < state.poachingShips.length; sIdx++) {
      const ps = state.poachingShips[sIdx];
      const distX = Math.abs(ps.x - rov.x);
      const outsideMesh = distX >= ps.netWidth * 0.42;
      const withinApproachRange = distX <= 260;
      const movingTowardOrAcrossNet =
        (intendedTargetX - rov.x) * (ps.x - rov.x) > 0 || Math.abs(intendedTargetX - ps.x) < 185;

      if (outsideMesh && withinApproachRange && movingTowardOrAcrossNet) {
        const passDir: 1 | -1 = ps.x >= rov.x ? 1 : -1;
        engageNetTackleOnShip(state, sIdx, undefined, passDir);
        break;
      }
    }
  }

  // 4. SAFETY CHECK: Proximity to Ghost Net, Shipwreck, or Poaching Ship Attached Long Net -> slow down, warn, and retrace waypoints
  // Bypassed while state.netTackle.active is true so the ROV smoothly executes its Over-Net or Under-Net pass without bouncing back!
  const isAutonomousSweep = rov.mode === 'Auto Patrol' || rov.mode === 'Auto Survey';
  const distToGhostNet = Math.hypot(rov.x - state.ghostNet.x, rov.y - state.ghostNet.y);
  const distToShipwreck = Math.hypot(rov.x - state.shipwreck.x, rov.y - state.shipwreck.y);
  const nearGhostNet = !state.netTackle.active && !isAutonomousSweep && distToGhostNet < 125;
  const nearShipwreck = !state.netTackle.active && !isAutonomousSweep && distToShipwreck < 140;

  let nearPoachingNetShip: PoachingShipWithNet | null = null;
  if (!state.netTackle.active) {
    for (const ps of state.poachingShips) {
      const withinX = Math.abs(rov.x - ps.x) < ps.netWidth * 0.42;
      const withinY = rov.y >= ps.netTopY + 45 && rov.y <= ps.netBottomY + 15;
      if (withinX && withinY) {
        nearPoachingNetShip = ps;
        break;
      }
    }
  }
  const nearPoachingNet = nearPoachingNetShip !== null;

  if ((nearGhostNet || nearShipwreck || nearPoachingNet) && state.safetyState.backtrackTimer <= 0) {
    state.safetyState.isWarning = true;
    state.safetyState.isBacktracking = true;
    state.safetyState.hazardName = nearGhostNet
      ? 'Ghost Net Entanglement Hazard'
      : nearPoachingNetShip
        ? `${nearPoachingNetShip.vesselName} Attached Drift-Net Entanglement`
        : 'Shipwreck Hull Collision Hazard';
    state.safetyState.backtrackTimer = 1.65;
    const popped = state.positionStack.pop();
    if (popped) {
      state.safetyState.backtrackTarget = popped;
      state.safetyState.poppedCount += 1;
    } else {
      state.safetyState.backtrackTarget = {
        x: Math.max(200, rov.x - 160),
        y: Math.max(SURFACE_Y + 60, rov.y - 120),
        depthMeters: worldYToDepthMeters(rov.y - 120),
        timestampSec: t,
      };
    }
    // Immediate hydrodynamic brake on entering hazard radius
    rov.vx *= 0.35;
    rov.vy *= 0.35;
    // If in Auto Patrol, advance waypoint so it doesn't immediately re-enter the same hazard
    if (rov.mode === 'Auto Patrol') {
      rov.patrolWaypointIdx = (rov.patrolWaypointIdx + 1) % state.patrolWaypoints.length;
    }
  }

  // Record safe breadcrumb onto Waypoint Retrace History when outside hazard radius
  if (!nearGhostNet && !nearShipwreck && !nearPoachingNet && state.safetyState.backtrackTimer <= 0) {
    state.safetyState.isWarning = false;
    state.safetyState.isBacktracking = false;
    state.positionStack.push({
      x: Math.round(rov.x),
      y: Math.round(rov.y),
      depthMeters: Number(worldYToDepthMeters(rov.y).toFixed(1)),
      timestampSec: Number(t.toFixed(1)),
    });
  }

  // Determine thrust vector from Safety Backtrack, Manual input, or Autonomous mode (with Net Tackling Strategy)
  let thrustX = 0;
  let thrustY = 0;
  const maxThrust = 340;

  if (state.safetyState.backtrackTimer > 0 && state.safetyState.backtrackTarget) {
    state.safetyState.backtrackTimer = Math.max(0, state.safetyState.backtrackTimer - clampedDt);
    const bt = state.safetyState.backtrackTarget;
    const dx = bt.x - rov.x;
    const dy = bt.y - rov.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 18) {
      thrustX = (dx / dist) * (maxThrust * 0.65);
      thrustY = (dy / dist) * (maxThrust * 0.65);
    } else if (state.positionStack.size() > 1) {
      state.safetyState.backtrackTarget = state.positionStack.pop();
      state.safetyState.poppedCount += 1;
    }
    if (state.safetyState.backtrackTimer <= 0) {
      state.safetyState.isBacktracking = false;
      state.safetyState.isWarning = false;
    }
  } else if (rov.mode === 'Manual') {
    if (input.left) thrustX -= maxThrust;
    if (input.right) thrustX += maxThrust;
    if (input.up) thrustY -= maxThrust;
    if (input.down) thrustY += maxThrust;
  } else if (rov.mode === 'Auto Patrol' || rov.mode === 'Auto Survey') {
    // Execute 3-stage Net Tackling Maneuver (UNDER_NET dive or OVER_NET surface crest) if active
    if (state.netTackle.active && state.netTackle.waypoints.length > 0) {
      const wpIdx = Math.min(state.netTackle.waypointIdx, state.netTackle.waypoints.length - 1);
      const tackleWp = state.netTackle.waypoints[wpIdx];
      state.netTackle.phase =
        wpIdx === 0 ? 'APPROACH_GATE' : wpIdx === 1 ? 'CLEARANCE_PASS' : 'EXIT_GATE';

      const dx = tackleWp.x - rov.x;
      const dy = tackleWp.y - rov.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 42) {
        state.netTackle.waypointIdx += 1;
        if (state.netTackle.waypointIdx >= state.netTackle.waypoints.length) {
          // Completed net clearance pass! Advance route forward so ROV continues across the ocean
          const exitDir: 1 | -1 =
            state.netTackle.waypoints[2].x >= state.netTackle.netCenterX ? 1 : -1;
          state.netTackle.active = false;
          state.netTackle.phase = 'IDLE';
          state.netTackle.clearedCount += 1;
          state.netTackle.lastClearedNetName = state.netTackle.targetNetName;
          state.netTackle.cooldownTimer = 1.6;
          syncRouteWaypointsPastNet(state, state.netTackle.netCenterX, exitDir);
        }
      } else if (wpIdx === 0 && Math.abs(dy) > 22) {
        // Prioritize reaching vertical clearance corridor (above or below net) BEFORE crossing net X
        thrustY = Math.sign(dy) * maxThrust;
        thrustX = (dx / Math.max(1, Math.abs(dx))) * (maxThrust * 0.45);
        // Prevent horizontal momentum from drifting inside the net curtain before reaching clearance depth
        const minSafeDistFromNet = 88;
        const distFromNetCenter = Math.abs(rov.x - state.netTackle.netCenterX);
        if (distFromNetCenter < minSafeDistFromNet) {
          const sideSign = rov.x <= state.netTackle.netCenterX ? -1 : 1;
          rov.x = state.netTackle.netCenterX + sideSign * minSafeDistFromNet;
          rov.vx *= 0.2;
        }
      } else {
        thrustX = (dx / Math.max(1, dist)) * (maxThrust * 0.94);
        thrustY = (dy / Math.max(1, dist)) * (maxThrust * 0.94);
      }
    } else if (rov.mode === 'Auto Patrol') {
      const wp = state.patrolWaypoints[rov.patrolWaypointIdx % state.patrolWaypoints.length];
      let targetY = wp.y;
      // Smoothly crest above Ghost Net or Shipwreck if passing horizontally near them
      if (Math.abs(rov.x - state.ghostNet.x) < 175) {
        targetY = Math.min(targetY, state.ghostNet.y - 155);
      }
      if (Math.abs(rov.x - state.shipwreck.x) < 185) {
        targetY = Math.min(targetY, state.shipwreck.y - 165);
      }
      const dx = wp.x - rov.x;
      const dy = targetY - rov.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 68) {
        rov.patrolWaypointIdx = (rov.patrolWaypointIdx + 1) % state.patrolWaypoints.length;
      } else {
        thrustX = (dx / dist) * (maxThrust * 0.78);
        thrustY = (dy / dist) * (maxThrust * 0.78);
      }
    } else if (rov.mode === 'Auto Survey') {
      if (state.dfsSurvey.enabled && state.dfsSurvey.nodes.length > 0) {
        // Autonomous Sector Grid Survey traversal across the full ocean
        const targetNode =
          state.dfsSurvey.nodes[state.dfsSurvey.currentNodeIdx % state.dfsSurvey.nodes.length];
        const localSeabed = getSeabedY(targetNode.worldX) - 70;
        let targetY = Math.min(targetNode.worldY, localSeabed);
        if (Math.abs(rov.x - state.ghostNet.x) < 175) {
          targetY = Math.min(targetY, state.ghostNet.y - 155);
        }
        if (Math.abs(rov.x - state.shipwreck.x) < 185) {
          targetY = Math.min(targetY, state.shipwreck.y - 165);
        }
        const dx = targetNode.worldX - rov.x;
        const dy = targetY - rov.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 68) {
          state.dfsSurvey.currentNodeIdx =
            (state.dfsSurvey.currentNodeIdx + 1) % state.dfsSurvey.nodes.length;
        } else {
          thrustX = (dx / dist) * (maxThrust * 0.82);
          thrustY = (dy / dist) * (maxThrust * 0.82);
        }
      } else {
        // Lawnmower sweep pattern across the full 6000px ocean
        const minSweepX = 550;
        const maxSweepX = 5450;
        const localSeabed = getSeabedY(rov.x) - 75;
        let targetY = Math.min(rov.surveyTargetDepthY, localSeabed);
        if (Math.abs(rov.x - state.ghostNet.x) < 175) {
          targetY = Math.min(targetY, state.ghostNet.y - 155);
        }
        if (Math.abs(rov.x - state.shipwreck.x) < 185) {
          targetY = Math.min(targetY, state.shipwreck.y - 165);
        }

        thrustX = rov.surveyDir * (maxThrust * 0.82);
        const dy = targetY - rov.y;
        thrustY = Math.max(-maxThrust * 0.68, Math.min(maxThrust * 0.68, dy * 3.2));

        if (rov.surveyDir === 1 && rov.x >= maxSweepX) {
          rov.surveyDir = -1;
          rov.surveyTargetDepthY += 135;
          if (rov.surveyTargetDepthY > 1100) rov.surveyTargetDepthY = 340;
        } else if (rov.surveyDir === -1 && rov.x <= minSweepX) {
          rov.surveyDir = 1;
          rov.surveyTargetDepthY += 135;
          if (rov.surveyTargetDepthY > 1100) rov.surveyTargetDepthY = 340;
        }
      }
    }
  } else if (rov.mode === 'Return to Base') {
    const targetX = state.aegisShip.x;
    const targetY = SURFACE_Y + 34;
    const dx = targetX - rov.x;
    const dy = targetY - rov.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 22) {
      thrustX = (dx / dist) * (maxThrust * 0.85);
      thrustY = (dy / dist) * (maxThrust * 0.85);
    } else {
      // Docked below AEGIS mothership: recharge battery rapidly!
      rov.battery = Math.min(100, rov.battery + 14 * clampedDt);
      if (rov.battery >= 99.5) {
        rov.mode = 'Auto Patrol';
      }
    }
  }

  // 3. COMMS OUTAGE CIRCULAR QUEUE BUFFERING
  if (state.commsOffline && t - state.lastCommsSampleSec >= 0.85) {
    state.lastCommsSampleSec = t;
    state.commsQueue.enqueue({
      seq: state.packetSeq++,
      timestampStr: formatMissionTime(t),
      depthMeters: Number(worldYToDepthMeters(rov.y).toFixed(1)),
      tempCelsius: getWaterTemperatureCelsius(rov.y),
      rovX: Math.round(rov.x),
      rovY: Math.round(rov.y),
      detectionsCount: state.activeDetections.length,
    });
  }

  // Physics forces on ROV: thrust + water drag + slight positive buoyancy + depth-varying current
  const currentVx = getOceanCurrentVx(rov.y, t);
  const dragCoeff = 2.15;
  const slightBuoyancy = -12; // gentle upward buoyancy

  const ax = thrustX - (rov.vx - currentVx * 0.35) * dragCoeff;
  const ay = thrustY + slightBuoyancy - rov.vy * dragCoeff;

  rov.vx += ax * clampedDt;
  rov.vy += ay * clampedDt;

  // Cap ROV max velocity
  const speed = Math.hypot(rov.vx, rov.vy);
  const maxSpeed = 210;
  if (speed > maxSpeed) {
    rov.vx = (rov.vx / speed) * maxSpeed;
    rov.vy = (rov.vy / speed) * maxSpeed;
  }

  rov.x += rov.vx * clampedDt;
  rov.y += rov.vy * clampedDt;

  // Update facing direction
  if (thrustX > 15 || rov.vx > 24) {
    rov.facing = 1;
  } else if (thrustX < -15 || rov.vx < -24) {
    rov.facing = -1;
  }

  // Smoothly tilt ROV with horizontal & vertical velocity
  const targetTilt =
    (rov.vy / maxSpeed) * 0.28 * rov.facing + (rov.vx / maxSpeed) * 0.14;
  rov.tilt += (targetTilt - rov.tilt) * Math.min(1, clampedDt * 8);

  // World wall & surface boundaries
  const minX = 70;
  const maxX = WORLD_WIDTH - 70;
  if (rov.x < minX) {
    rov.x = minX;
    rov.vx = Math.max(0, rov.vx * -0.3);
  } else if (rov.x > maxX) {
    rov.x = maxX;
    rov.vx = Math.min(0, rov.vx * -0.3);
  }

  const surfaceLimitY = getWaveY(rov.x, t) + 18;
  if (rov.y < surfaceLimitY) {
    rov.y = surfaceLimitY;
    rov.vy = Math.max(0, rov.vy);
  }

  // Seabed collision + camera shake
  const seabedLimitY = getSeabedY(rov.x) - 22;
  if (rov.y >= seabedLimitY) {
    const impactSpeed = Math.abs(rov.vy);
    rov.y = seabedLimitY;
    if (impactSpeed > 28) {
      rov.shakeTimer = 0.32;
      rov.shakeMagnitude = Math.min(11, impactSpeed * 0.085);
    }
    rov.vy = -Math.abs(rov.vy) * 0.35;
    rov.vx *= 0.82;
  }

  // Update camera shake decay
  if (rov.shakeTimer > 0) {
    rov.shakeTimer = Math.max(0, rov.shakeTimer - clampedDt);
    state.camera.shakeX = (Math.sin(t * 95) * 0.7 + (Math.random() - 0.5) * 0.6) * rov.shakeMagnitude;
    state.camera.shakeY = (Math.cos(t * 110) * 0.7 + (Math.random() - 0.5) * 0.6) * rov.shakeMagnitude;
  } else {
    state.camera.shakeX = 0;
    state.camera.shakeY = 0;
  }

  // Spin thrusters & sonar sweep
  const thrustEffort = Math.hypot(thrustX, thrustY) / maxThrust;
  rov.thrusterPhase += (8 + thrustEffort * 26) * clampedDt;
  rov.sonarAngle = (rov.sonarAngle + clampedDt * 2.6) % (Math.PI * 2);

  // Battery drain from thrust and lights
  const drainRate = 0.09 + thrustEffort * 0.28 + (rov.lightsOn ? 0.08 : 0);
  rov.battery = Math.max(0, rov.battery - drainRate * clampedDt);

  // Emit bubbles from thrusters when moving
  if (thrustEffort > 0.1 || speed > 35) {
    const spawnCount = thrustEffort > 0.5 ? 2 : 1;
    for (let i = 0; i < spawnCount; i++) {
      if (state.bubbles.length < 140) {
        state.bubbles.push({
          x: rov.x - rov.facing * 26 + (Math.random() - 0.5) * 8,
          y: rov.y + (Math.random() - 0.5) * 10,
          vx: -rov.vx * 0.25 + (Math.random() - 0.5) * 18,
          vy: -(28 + Math.random() * 32),
          radius: 1.6 + Math.random() * 2.8,
          alpha: 0.75,
        });
      }
    }
  }

  // Update bubbles
  for (let i = state.bubbles.length - 1; i >= 0; i--) {
    const b = state.bubbles[i];
    b.x += (b.vx + Math.sin(t * 6 + b.y * 0.08) * 10) * clampedDt;
    b.y += b.vy * clampedDt;
    b.alpha -= 0.42 * clampedDt;
    if (b.alpha <= 0.02 || b.y <= SURFACE_Y) {
      state.bubbles.splice(i, 1);
    }
  }

  // Smoothly follow ROV with camera lerp
  const halfW = viewportWidth * 0.5;
  const halfH = viewportHeight * 0.5;
  const desiredCamX = Math.max(halfW, Math.min(WORLD_WIDTH - halfW, rov.x + rov.facing * 60));
  const desiredCamY = Math.max(halfH * 0.75, Math.min(MAX_WORLD_Y - halfH * 0.75, rov.y));
  const lerpFactor = Math.min(1, clampedDt * 5.2);
  state.camera.x += (desiredCamX - state.camera.x) * lerpFactor;
  state.camera.y += (desiredCamY - state.camera.y) * lerpFactor;

  // Surface AEGIS ship gently tracks ROV horizontally over long distances & bobs on waves
  const shipFollowDiff = rov.x - state.aegisShip.x;
  if (Math.abs(shipFollowDiff) > 480) {
    state.aegisShip.x += Math.sign(shipFollowDiff) * 26 * clampedDt;
    state.aegisShip.x = Math.max(300, Math.min(MPA_BOUNDARY_X - 180, state.aegisShip.x));
  }
  state.aegisShip.y = getWaveY(state.aegisShip.x, t);
  state.aegisShip.bobPhase = t * 1.8;
  state.aegisShip.radarAngle = (state.aegisShip.radarAngle + clampedDt * 3.4) % (Math.PI * 2);

  // Suspicious ship & Poaching ships with attached long nets bob on waves and animate trapped rare species
  state.suspiciousShip.x = 4650 + Math.sin(t * 0.25) * 36;
  state.suspiciousShip.y = getWaveY(state.suspiciousShip.x, t);
  state.suspiciousShip.bobPhase = t * 1.6 + 1.4;
  state.suspiciousShip.beaconPhase = t * 4.5;

  for (let i = 0; i < state.poachingShips.length; i++) {
    const ps = state.poachingShips[i];
    ps.x = ps.baseX + Math.sin(t * 0.22 + i * 1.3) * 28;
    ps.y = getWaveY(ps.x, t);
    ps.bobPhase = t * 1.7 + i * 0.9;
    ps.beaconPhase = t * 4.8 + i * 1.5;
    ps.swayPhase = t * 1.4 + i * 0.8;
    for (const tc of ps.trappedCreatures) {
      tc.strugglePhase += clampedDt * 4.4;
    }
  }

  // Satellite orbits gently in the sky
  state.satellite.x = 450 + ((t * 38) % (WORLD_WIDTH - 900));
  state.satellite.y = 42 + Math.sin(t * 0.5) * 6;
  state.satellite.pulsePhase = t * 4.0;

  // Step 165 boids
  stepBoids(state, clampedDt);

  // Step free-gliding Sea Turtle
  const turtle = state.seaTurtle;
  turtle.flipperPhase += clampedDt * 3.4;
  turtle.x += turtle.vx * clampedDt;
  turtle.y += Math.sin(t * 0.9) * 14 * clampedDt;
  if (turtle.x > 1680) turtle.vx = -Math.abs(turtle.vx);
  if (turtle.x < 680) turtle.vx = Math.abs(turtle.vx);

  // Step Entangled Turtle struggle animation
  state.entangledTurtle.strugglePhase += clampedDt * 4.2;

  // Step patrolling Reef Shark
  const shark = state.shark;
  shark.tailPhase += clampedDt * 5.2;
  shark.x += shark.vx * clampedDt;
  shark.y = 630 + Math.sin(t * 0.7) * 45;
  if (shark.x > shark.patrolMaxX) shark.vx = -Math.abs(shark.vx);
  if (shark.x < shark.patrolMinX) shark.vx = Math.abs(shark.vx);

  // Step Dolphin arcing near the surface
  const dolphin = state.dolphin;
  dolphin.arcPhase += clampedDt * 1.85;
  dolphin.x += dolphin.vx * clampedDt;
  if (dolphin.x > 2900) dolphin.vx = -Math.abs(dolphin.vx);
  if (dolphin.x < 550) dolphin.vx = Math.abs(dolphin.vx);
  // Dolphin arcs in and out of the surface waves
  dolphin.y = SURFACE_Y + 38 - Math.sin(dolphin.arcPhase) * 58;

  // Step Seahorses bobbing near coral
  for (const sh of state.seahorses) {
    sh.phase += clampedDt * 2.2;
    sh.x = sh.baseX + Math.sin(sh.phase * 0.8) * 6;
    sh.y = sh.baseY + Math.cos(sh.phase) * 8;
  }

  // Step floating plastics
  for (const p of state.plastics) {
    if (p.floating) {
      p.x += p.vx * clampedDt;
      p.y = p.baseY + Math.sin(t * 1.3 + p.x * 0.02) * 16;
      p.rotation += p.rotSpeed * clampedDt;
      if (p.x > WORLD_WIDTH - 200) p.vx = -Math.abs(p.vx);
      if (p.x < 200) p.vx = Math.abs(p.vx);
    }
  }

  // Step rising Oil Plume droplets
  for (const drop of state.oilDroplets) {
    drop.y += drop.vy * clampedDt;
    drop.wobblePhase += clampedDt * 2.1;
    drop.x += Math.sin(drop.wobblePhase) * 14 * clampedDt;
    const heightAboveSource = state.oilPlumeSource.y - drop.y;
    const progress = Math.max(0, Math.min(1, heightAboveSource / 340));
    drop.radius = 10 + progress * 36;
    drop.alpha = (1 - progress * 0.85) * 0.52;
    if (heightAboveSource >= 340) {
      drop.y = state.oilPlumeSource.y;
      drop.x = state.oilPlumeSource.x + (Math.random() - 0.5) * 14;
      drop.radius = 10;
      drop.alpha = 0.52;
    }
  }

  // Step Marine Snow drifting
  for (const snow of state.marineSnow) {
    snow.y += snow.speedY * clampedDt;
    snow.driftPhase += clampedDt * 1.2;
    snow.x += Math.sin(snow.driftPhase) * 6 * clampedDt;
    if (snow.y > MAX_WORLD_Y - 30) {
      snow.y = SURFACE_Y + 15;
    }
  }

  // Pulse glowing seabed anomaly
  state.seabedAnomaly.pulsePhase += clampedDt * 3.2;

  // Run simulated YOLOv8 object detection scan
  scanDetections(state, t);
}
