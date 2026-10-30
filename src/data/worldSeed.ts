import {
  Alert,
  AlertSeverity,
  ControlMode,
  GPSCoordinate,
  MonitoringCapability,
  ScenarioPreset,
  SystemArchitectureNode,
  Vector3D,
  Vessel,
  WorldEntity,
} from '../types';

export const BASE_GPS: GPSCoordinate = {
  lat: 8.4215, // Indo-Pacific Coral Triangle / MPA Coordinates
  lon: 119.8432,
};

export const MPA_ZONE = {
  center: { x: 22, z: -22 },
  radius: 36,
  name: 'Palawan Coral Sanctuary (MPA-14.5)',
};

/**
 * Repeatable seeded pseudo-random generator (Mulberry32)
 */
export function createSeededRng(seed = 20261401): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic seabed heightmap (y is negative depth in meters, surface = 0).
 * Range: roughly -26m (coral reef ridge) to -48m (deep abyssal trench).
 */
export function seabedHeightAt(x: number, z: number): number {
  const baseDepth = -36;
  const reefMount =
    9.5 * Math.exp(-((x - 22) * (x - 22) + (z + 22) * (z + 22)) / 950);
  const trench =
    -8.0 * Math.exp(-((x + 35) * (x + 35) + (z - 28) * (z - 28)) / 800);
  const ridgeWaves =
    2.2 * Math.sin(x * 0.055) * Math.cos(z * 0.055) +
    0.8 * Math.sin(x * 0.14 + z * 0.11);
  const ripples = 0.25 * Math.sin(x * 0.6 + z * 0.4);
  return Math.min(-16, Math.max(-52, baseDepth + reefMount + trench + ridgeWaves + ripples));
}

/**
 * Convert local 3D world coordinates (meters) to realistic maritime GPS coordinates
 */
export function worldToGps(pos: Vector3D): GPSCoordinate {
  return {
    lat: Number((BASE_GPS.lat - pos.z * 0.00045).toFixed(5)),
    lon: Number((BASE_GPS.lon + pos.x * 0.00045).toFixed(5)),
  };
}

/**
 * Convert local 3D distance to tactical display distance (e.g., "2.4 km")
 * Scales tactical arena distances so dashboard readouts match maritime patrol ranges.
 */
export function formatTacticalDistanceKm(distMeters: number): string {
  const scaledKm = Math.max(0.2, distMeters * 0.068);
  return `${scaledKm.toFixed(1)} km`;
}

export const SDG_14_TARGETS = [
  {
    code: '14.1',
    title: 'Reduce Marine Pollution',
    shortDesc: 'Prevent and significantly reduce marine pollution of all kinds, particularly plastic debris and nutrient/oil runoff.',
    metricLabel: 'Macro/Micro-plastics & Oil Plumes Mapped',
    color: '#F59E0B',
  },
  {
    code: '14.2',
    title: 'Protect & Restore Ecosystems',
    shortDesc: 'Sustainably manage and protect marine and coastal ecosystems to avoid significant adverse impacts and coral bleaching.',
    metricLabel: 'Reef Health & Biodiversity Index',
    color: '#10B981',
  },
  {
    code: '14.4',
    title: 'End IUU & Destructive Fishing',
    shortDesc: 'Effectively regulate harvesting and end overfishing, illegal, unreported and unregulated (IUU) fishing and ghost gear.',
    metricLabel: 'AIS-Dark Trawlers & Ghost Nets Flagged',
    color: '#EF4444',
  },
  {
    code: '14.5',
    title: 'Conserve Coastal & Marine Areas',
    shortDesc: 'Conserve at least 10–30% of coastal and marine areas through real-time Marine Protected Area (MPA) geofence enforcement.',
    metricLabel: 'MPA Geofence Integrity & Incursion Alerts',
    color: '#06B6D4',
  },
  {
    code: '14.a',
    title: 'Increase Marine Scientific Knowledge',
    shortDesc: 'Increase scientific knowledge, develop autonomous ROV research capacity and transfer marine conservation technology.',
    metricLabel: 'Multi-Sensor Bathymetry & Telemetry Fusion',
    color: '#38BDF8',
  },
];

export const SDG_FRAMING_TEXT = {
  tagline: 'Safer Seas | Cleaner Oceans | A Sustainable Future',
  problemStatement:
    'Our oceans face multiple threats that endanger marine life, ecosystems and human safety: illegal and unregulated fishing, pollution and plastic waste, maritime accidents and security threats, and a lack of real-time monitoring and data. Traditional monitoring is manual, slow and limited in coverage, leaving oceans vulnerable.',
  solutionStatement:
    'AEGIS Ocean Sentinel combines underwater and surface drones, real-time data analytics and satellite communication to ensure safer seas and cleaner oceans.',
  impactBanner:
    'Protects Marine Life | Reduces Pollution | Enhances Maritime Security | Supports Sustainable Oceans',
};

export function createInitialVessels(): Vessel[] {
  return [
    {
      id: 'vessel-aegis-01',
      mmsi: '244810221',
      name: 'AEGIS-01 Sentinel USV',
      type: 'mothership',
      aisActive: true,
      flag: 'UN-SDG',
      speedKnots: 2.1,
      heading: 45,
      position: { x: 0, y: 0, z: 0 },
      trail: [
        { x: -12, y: 0, z: 10 },
        { x: -6, y: 0, z: 5 },
        { x: 0, y: 0, z: 0 },
      ],
      status: 'normal',
      riskScore: 5,
      inMpa: false,
      description: 'Autonomous Surface Vessel (Mothership). Acoustic USBL positioning & fiber-optic tether link to ROV.',
    },
    {
      id: 'vessel-black-fin',
      mmsi: '538009112',
      name: 'FV Black Fin (Unlicensed Trawler)',
      type: 'illegal_trawler',
      aisActive: false,
      flag: 'UNKNOWN (AIS DARK)',
      speedKnots: 3.4,
      heading: 130,
      position: { x: 28, y: 0, z: -18 },
      trail: [
        { x: 46, y: 0, z: -34 },
        { x: 38, y: 0, z: -26 },
        { x: 28, y: 0, z: -18 },
      ],
      status: 'ais_dark',
      riskScore: 96,
      inMpa: true,
      description: 'AIS transponder disabled 42 min ago. Active bottom-trawl acoustic signature detected inside MPA boundary.',
    },
    {
      id: 'vessel-shadow-carrier',
      mmsi: '352988014',
      name: 'MV Shadow Carrier (Reefer)',
      type: 'transshipment_carrier',
      aisActive: false,
      flag: 'FLAG OF CONVENIENCE',
      speedKnots: 0.6,
      heading: 285,
      position: { x: -42, y: 0, z: -32 },
      trail: [
        { x: -55, y: 0, z: -36 },
        { x: -48, y: 0, z: -34 },
        { x: -42, y: 0, z: -32 },
      ],
      status: 'rendezvous',
      riskScore: 89,
      inMpa: false,
      description: 'Loitering alongside FV Reef Bandit in suspected illicit at-sea catch transshipment rendezvous.',
    },
    {
      id: 'vessel-reef-bandit',
      mmsi: '352988099',
      name: 'FV Reef Bandit',
      type: 'poacher_skiff',
      aisActive: false,
      flag: 'UNREGISTERED',
      speedKnots: 0.8,
      heading: 105,
      position: { x: -37, y: 0, z: -29 },
      trail: [
        { x: -25, y: 0, z: -20 },
        { x: -31, y: 0, z: -25 },
        { x: -37, y: 0, z: -29 },
      ],
      status: 'rendezvous',
      riskScore: 86,
      inMpa: false,
      description: 'Docked hull-to-hull with MV Shadow Carrier; unregistered fishing skiff.',
    },
    {
      id: 'vessel-pacific-trader',
      mmsi: '311040900',
      name: 'MV Pacific Trader',
      type: 'cargo',
      aisActive: true,
      flag: 'SG',
      speedKnots: 11.4,
      heading: 85,
      position: { x: -50, y: 0, z: 42 },
      trail: [
        { x: -72, y: 0, z: 40 },
        { x: -60, y: 0, z: 41 },
        { x: -50, y: 0, z: 42 },
      ],
      status: 'normal',
      riskScore: 12,
      inMpa: false,
      description: 'Civilian container vessel transiting designated shipping lane.',
    },
    {
      id: 'vessel-calypso',
      mmsi: '227006410',
      name: 'RV Calypso Explorer',
      type: 'research',
      aisActive: true,
      flag: 'FR',
      speedKnots: 4.2,
      heading: 210,
      position: { x: 48, y: 0, z: 34 },
      trail: [
        { x: 56, y: 0, z: 44 },
        { x: 52, y: 0, z: 39 },
        { x: 48, y: 0, z: 34 },
      ],
      status: 'normal',
      riskScore: 8,
      inMpa: false,
      description: 'Authorized oceanographic research vessel conducting CTD casts.',
    },
  ];
}

export function createInitialWorldEntities(): WorldEntity[] {
  return [
    // 1. VESSEL DETECTION & TRACKING
    {
      id: 'ent-trawler-hull',
      name: 'Suspicious Vessel Hull (FV Black Fin)',
      classLabel: 'Suspicious Vessel (AIS-Dark)',
      category: 'vessel',
      capability: MonitoringCapability.VESSEL_TRACKING,
      position: { x: 28, y: -3.2, z: -18 },
      radius: 8,
      riskScore: 96,
      sdgTargets: ['14.4', '14.5'],
      metadata: 'AIS off · Cavitation acoustic profile matches 42m bottom trawler inside MPA',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-rendezvous-pair',
      name: 'Transshipment Rendezvous (Shadow Carrier & Skiff)',
      classLabel: 'Vessel Rendezvous / Transshipment',
      category: 'vessel',
      capability: MonitoringCapability.VESSEL_TRACKING,
      position: { x: -40, y: -2.8, z: -31 },
      radius: 9,
      riskScore: 89,
      sdgTargets: ['14.4'],
      metadata: 'Dual hull acoustic echo · Loitering < 1 kt for 38 mins',
      discovered: true,
      inspected: false,
    },

    // 2. ILLEGAL FISHING DETECTION
    {
      id: 'ent-ghost-net-01',
      name: 'Abandoned Ghost Gillnet #GN-04',
      classLabel: 'Illegal Ghost Net (Entanglement)',
      category: 'illegal_gear',
      capability: MonitoringCapability.ILLEGAL_FISHING,
      position: { x: 19, y: -21, z: -16 },
      radius: 6.5,
      riskScore: 98,
      sdgTargets: ['14.4', '14.2'],
      isHazard: true,
      entangledAnimal: 'Green Sea Turtle (Chelonia mydas)',
      metadata: 'Illegal monofilament drift net snagged on coral pinnacle · Active wildlife entanglement!',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-trawl-scar-01',
      name: 'Bottom-Trawl Seabed Scar & Otter Doors',
      classLabel: 'Illegal Bottom-Trawl Gear & Scar',
      category: 'illegal_gear',
      capability: MonitoringCapability.ILLEGAL_FISHING,
      position: { x: 33, y: seabedHeightAt(33, -24) + 1.5, z: -24 },
      radius: 7,
      riskScore: 91,
      sdgTargets: ['14.4', '14.2', '14.5'],
      isHazard: true,
      metadata: 'Heavy steel trawl doors gouging 45m scar across protected coral habitat',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-trap-lines',
      name: 'Unmarked Poaching Trap Line Array',
      classLabel: 'Unreported Longline / Crab Pots',
      category: 'illegal_gear',
      capability: MonitoringCapability.ILLEGAL_FISHING,
      position: { x: 8, y: seabedHeightAt(8, -32) + 2.0, z: -32 },
      radius: 5.5,
      riskScore: 78,
      sdgTargets: ['14.4'],
      isHazard: true,
      metadata: '12 acoustic-untagged benthic traps laid across reef channel',
      discovered: false,
      inspected: false,
    },

    // 3. POLLUTION MONITORING
    {
      id: 'ent-plastic-gyre',
      name: 'Macro-Plastic Debris Hotspot #PL-01',
      classLabel: 'Plastic Waste Accumulation',
      category: 'pollution',
      capability: MonitoringCapability.POLLUTION,
      position: { x: -18, y: -12, z: 16 },
      radius: 7.5,
      riskScore: 84,
      cleanupPriority: 92,
      sdgTargets: ['14.1', '14.2'],
      metadata: 'High-density polymers (HDPE drums, PET bottles, bags) + 420 particles/m³ microplastic plume',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-oil-plume',
      name: 'Subsea Pipeline Hydrocarbon Leak #OL-02',
      classLabel: 'Crude Oil & Methane Plume',
      category: 'pollution',
      capability: MonitoringCapability.POLLUTION,
      position: { x: -28, y: seabedHeightAt(-28, -12) + 3.5, z: -12 },
      radius: 8.0,
      riskScore: 95,
      cleanupPriority: 99,
      sdgTargets: ['14.1', '14.2'],
      metadata: 'Turbidity spike 48 NTU · PAH hydrocarbon fluorescence & pH drop to 7.62',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-microplastic-cloud',
      name: 'Suspended Microplastic & Ghost-Fiber Cloud',
      classLabel: 'Microplastic Plume',
      category: 'pollution',
      capability: MonitoringCapability.POLLUTION,
      position: { x: -8, y: -18, z: 28 },
      radius: 6.5,
      riskScore: 72,
      cleanupPriority: 76,
      sdgTargets: ['14.1'],
      metadata: 'Synthetic polymer fibers from degraded fishing lines suspended at thermocline',
      discovered: false,
      inspected: false,
    },

    // 4. MARINE LIFE TRACKING
    {
      id: 'ent-sea-turtle',
      name: 'Green Sea Turtle (Tag #MT-104)',
      classLabel: 'Marine Life: Green Sea Turtle',
      category: 'marine_life',
      capability: MonitoringCapability.MARINE_LIFE,
      position: { x: 18, y: -20, z: -15 },
      radius: 4.5,
      riskScore: 97, // High priority because distressed near ghost net
      speciesCount: 1,
      protectionStatus: 'Endangered',
      entangledAnimal: 'Distressed near Ghost Net #GN-04',
      sdgTargets: ['14.2', '14.4', '14.5'],
      metadata: 'Endangered Chelonia mydas · Restricted fin movement near Ghost Net #GN-04',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-reef-shark',
      name: 'Grey Reef Shark Patrol (#MS-208)',
      classLabel: 'Marine Life: Grey Reef Shark',
      category: 'marine_life',
      capability: MonitoringCapability.MARINE_LIFE,
      position: { x: 26, y: -15, z: -26 },
      velocity: { x: 1.2, y: 0, z: 0.8 },
      radius: 5.5,
      riskScore: 35,
      speciesCount: 2,
      protectionStatus: 'Endangered',
      sdgTargets: ['14.2', '14.5'],
      metadata: 'Apex predator indicator species inside Palawan MPA sanctuary',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-dolphin-pod',
      name: 'Indo-Pacific Bottlenose Dolphin Pod',
      classLabel: 'Marine Life: Dolphin Pod (4)',
      category: 'marine_life',
      capability: MonitoringCapability.MARINE_LIFE,
      position: { x: -12, y: -8, z: -22 },
      velocity: { x: 1.8, y: 0.1, z: -1.1 },
      radius: 6.5,
      riskScore: 20,
      speciesCount: 4,
      protectionStatus: 'Protected',
      sdgTargets: ['14.2', '14.5'],
      metadata: 'Acoustic echolocation clicks detected at 45 kHz · Healthy pod behavior',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-eagle-ray',
      name: 'Spotted Eagle Ray (Aetobatus narinari)',
      classLabel: 'Marine Life: Spotted Eagle Ray',
      category: 'marine_life',
      capability: MonitoringCapability.MARINE_LIFE,
      position: { x: 12, y: -24, z: 10 },
      velocity: { x: -0.9, y: 0, z: 1.0 },
      radius: 5.0,
      riskScore: 25,
      speciesCount: 2,
      protectionStatus: 'Vulnerable',
      sdgTargets: ['14.2'],
      metadata: 'Gliding above benthic sand ripples · Wingspan 2.4m',
      discovered: false,
      inspected: false,
    },
    {
      id: 'ent-seahorse-colony',
      name: 'Pygmy Seahorse Gorgonian Colony (Rare)',
      classLabel: 'Marine Life: Pygmy Seahorse (Rare)',
      category: 'marine_life',
      capability: MonitoringCapability.MARINE_LIFE,
      position: { x: 24, y: seabedHeightAt(24, -20) + 1.4, z: -20 },
      radius: 4.0,
      riskScore: 40,
      speciesCount: 6,
      protectionStatus: 'Endangered',
      sdgTargets: ['14.2', '14.5', '14.a'],
      metadata: 'Hippocampus bargibanti on Muricella sea fan · High biodiversity marker',
      discovered: false,
      inspected: false,
    },

    // 5. SEABED MAPPING & INSPECTION
    {
      id: 'ent-seabed-anomaly',
      name: 'Uncharted Metallic Seabed Anomaly #SA-07',
      classLabel: 'Seabed Anomaly (Metallic Object)',
      category: 'seabed_anomaly',
      capability: MonitoringCapability.SEABED_MAPPING,
      position: { x: -34, y: seabedHeightAt(-34, 24) + 1.6, z: 24 },
      radius: 6.5,
      riskScore: 88,
      sdgTargets: ['14.1', '14.a'],
      metadata: 'High-reflectivity side-scan sonar target · Suspected dumped toxic container / ordnance',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-shipwreck',
      name: 'Sunken Wreck (SS Poseidon Hull)',
      classLabel: 'Seabed Wreck & Artificial Reef',
      category: 'seabed_anomaly',
      capability: MonitoringCapability.SEABED_MAPPING,
      position: { x: 36, y: seabedHeightAt(36, 18) + 2.5, z: 18 },
      radius: 8.5,
      riskScore: 68,
      isHazard: true,
      sdgTargets: ['14.2', '14.a'],
      metadata: '38m steel hull resting at -36m · Entanglement & structural collapse hazard',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-pipeline-manifold',
      name: 'Subsea Telecom & Pipeline Manifold #PM-01',
      classLabel: 'Subsea Infrastructure / Pipeline',
      category: 'seabed_anomaly',
      capability: MonitoringCapability.SEABED_MAPPING,
      position: { x: -24, y: seabedHeightAt(-24, -8) + 1.2, z: -8 },
      radius: 6.5,
      riskScore: 82,
      sdgTargets: ['14.1', '14.a'],
      metadata: 'Anchor-drag dent near Flange #4 · Requires close-up optical & sonar inspection',
      discovered: true,
      inspected: false,
    },
    {
      id: 'ent-coral-bleaching',
      name: 'Thermal Stress Coral Bleaching Patch #CB-03',
      classLabel: 'Coral Bleaching Zone',
      category: 'seabed_anomaly',
      capability: MonitoringCapability.SEABED_MAPPING,
      position: { x: 14, y: seabedHeightAt(14, -28) + 1.2, z: -28 },
      radius: 6.0,
      riskScore: 76,
      sdgTargets: ['14.2', '14.5', '14.a'],
      metadata: '+1.8°C localized thermal anomaly · 34% Acropora colony paling recorded',
      discovered: false,
      inspected: false,
    },
  ];
}

export function createInitialAlerts(): Alert[] {
  const now = Date.now();
  return [
    {
      id: 'ALT-901',
      title: 'CRITICAL: Ghost Net Entangling Endangered Sea Turtle',
      message: 'Optical + Sonar fusion confirmed Green Sea Turtle (Chelonia mydas) entangled in illegal drift net #GN-04 inside Palawan MPA.',
      severity: AlertSeverity.CRITICAL,
      riskScore: 98,
      capability: MonitoringCapability.ILLEGAL_FISHING,
      timestamp: '03:58:12 UTC',
      timestampMs: now - 45000,
      gps: worldToGps({ x: 19, y: -21, z: -16 }),
      position: { x: 19, y: -21, z: -16 },
      sdgTarget: 'SDG 14.4 & 14.2',
      entityId: 'ent-ghost-net-01',
      dispatched: false,
      recommendedAction: 'Deploy ROV cutter/beacon & dispatch AEGIS-01 rapid wildlife rescue team immediately.',
    },
    {
      id: 'ALT-902',
      title: 'CRITICAL: AIS-Dark Unlicensed Trawler Incursion in MPA',
      message: 'FV Black Fin detected operating bottom-trawl gear 1.2 nm inside Marine Protected Area with AIS transponder disabled.',
      severity: AlertSeverity.CRITICAL,
      riskScore: 96,
      capability: MonitoringCapability.VESSEL_TRACKING,
      timestamp: '03:57:40 UTC',
      timestampMs: now - 78000,
      gps: worldToGps({ x: 28, y: 0, z: -18 }),
      position: { x: 28, y: -3, z: -18 },
      sdgTarget: 'SDG 14.4 & 14.5',
      entityId: 'ent-trawler-hull',
      dispatched: false,
      recommendedAction: 'Capture GPS-stamped acoustic & hull evidence snapshot; transmit to Coast Guard via Satellite link.',
    },
    {
      id: 'ALT-903',
      title: 'CRITICAL: Subsea Pipeline Hydrocarbon Plume Detected',
      message: 'Fluorometer & turbidity sensors spiked to 48 NTU at Pipeline Manifold #PM-01 (-38m). Active crude oil micro-seepage confirmed.',
      severity: AlertSeverity.CRITICAL,
      riskScore: 95,
      capability: MonitoringCapability.POLLUTION,
      timestamp: '03:56:55 UTC',
      timestampMs: now - 120000,
      gps: worldToGps({ x: -28, y: -35, z: -12 }),
      position: { x: -28, y: -35, z: -12 },
      sdgTarget: 'SDG 14.1',
      entityId: 'ent-oil-plume',
      dispatched: false,
      recommendedAction: 'Isolate pipeline valve sector B4 and deploy containment boom from surface support vessel.',
    },
    {
      id: 'ALT-904',
      title: 'WARNING: Suspected At-Sea Transshipment Rendezvous',
      message: 'MV Shadow Carrier and unregistered skiff FV Reef Bandit loitering hull-to-hull (< 0.8 kt) outside shipping lane.',
      severity: AlertSeverity.WARNING,
      riskScore: 89,
      capability: MonitoringCapability.VESSEL_TRACKING,
      timestamp: '03:55:20 UTC',
      timestampMs: now - 210000,
      gps: worldToGps({ x: -40, y: 0, z: -31 }),
      position: { x: -40, y: -2, z: -31 },
      sdgTarget: 'SDG 14.4',
      entityId: 'ent-rendezvous-pair',
      dispatched: false,
      recommendedAction: 'Task ROV to covertly approach at 15m depth and log hull markings.',
    },
    {
      id: 'ALT-905',
      title: 'WARNING: High-Density Macro-Plastic Gyre & Microplastics',
      message: 'Debris field #PL-01 exceeds 420 particles/m³ cleanup priority threshold (Score: 92/100) drifting toward coral sanctuary.',
      severity: AlertSeverity.WARNING,
      riskScore: 84,
      capability: MonitoringCapability.POLLUTION,
      timestamp: '03:54:05 UTC',
      timestampMs: now - 290000,
      gps: worldToGps({ x: -18, y: -12, z: 16 }),
      position: { x: -18, y: -12, z: 16 },
      sdgTarget: 'SDG 14.1',
      entityId: 'ent-plastic-gyre',
      dispatched: false,
      recommendedAction: 'Log perimeter waypoints for autonomous surface skimmer interceptor deployment.',
    },
    {
      id: 'ALT-906',
      title: 'INFO: Uncharted Metallic Seabed Anomaly #SA-07',
      message: 'Side-scan sonar sweep identified high-acoustic-impedance cylindrical target in sector SW (-34, 24).',
      severity: AlertSeverity.INFO,
      riskScore: 74,
      capability: MonitoringCapability.SEABED_MAPPING,
      timestamp: '03:52:10 UTC',
      timestampMs: now - 400000,
      gps: worldToGps({ x: -34, y: -36, z: 24 }),
      position: { x: -34, y: -36, z: 24 },
      sdgTarget: 'SDG 14.a & 14.1',
      entityId: 'ent-seabed-anomaly',
      dispatched: false,
      recommendedAction: 'Switch ROV to Seabed Mapping & Close-Up Inspection mode within 10m.',
    },
  ];
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'scenario-trawler',
    code: 'A',
    name: 'Illegal Trawler Patrol',
    subtitle: 'IUU Fishing & Ghost Gear Interdiction (SDG 14.4)',
    description:
      'Locate the AIS-dark vessel FV Black Fin inside the Marine Protected Area, document its illegal ghost nets, and map the bottom-trawl seabed scars.',
    primaryCapability: MonitoringCapability.ILLEGAL_FISHING,
    defaultControlMode: ControlMode.PATROL,
    spawnPosition: { x: 10, y: -14, z: -8 },
    spawnHeading: 135,
    timeOfDay: 14.5,
    seaState: 'moderate',
    sdgTargets: ['14.4', '14.5', '14.2'],
    objectives: [
      {
        id: 'obj-a1',
        description: 'Detect & lock onto AIS-dark trawler hull (FV Black Fin)',
        targetEntityIds: ['ent-trawler-hull'],
        completed: false,
      },
      {
        id: 'obj-a2',
        description: 'Inspect Ghost Net #GN-04 & entangled Green Sea Turtle',
        targetEntityIds: ['ent-ghost-net-01', 'ent-sea-turtle'],
        completed: false,
      },
      {
        id: 'obj-a3',
        description: 'Document bottom-trawl seabed scars inside MPA',
        targetEntityIds: ['ent-trawl-scar-01'],
        completed: false,
      },
    ],
  },
  {
    id: 'scenario-plastic',
    code: 'B',
    name: 'Plastic Hotspot Cleanup Survey',
    subtitle: 'Marine Pollution & Hydrocarbon Plume Mapping (SDG 14.1)',
    description:
      'Survey the macro-plastic debris field, quantify the microplastic cloud, and pinpoint the subsea pipeline oil leak to rank cleanup priority.',
    primaryCapability: MonitoringCapability.POLLUTION,
    defaultControlMode: ControlMode.SURVEY,
    spawnPosition: { x: -12, y: -14, z: 6 },
    spawnHeading: 240,
    timeOfDay: 11.0,
    seaState: 'calm',
    sdgTargets: ['14.1', '14.2', '14.a'],
    objectives: [
      {
        id: 'obj-b1',
        description: 'Map Macro-Plastic Debris Hotspot #PL-01',
        targetEntityIds: ['ent-plastic-gyre'],
        completed: false,
      },
      {
        id: 'obj-b2',
        description: 'Locate Subsea Pipeline Hydrocarbon Plume #OL-02',
        targetEntityIds: ['ent-oil-plume'],
        completed: false,
      },
      {
        id: 'obj-b3',
        description: 'Sample Suspended Microplastic Cloud at thermocline',
        targetEntityIds: ['ent-microplastic-cloud'],
        completed: false,
      },
    ],
  },
  {
    id: 'scenario-reef',
    code: 'C',
    name: 'Protected Reef Guard',
    subtitle: 'MPA Biodiversity Census & Wildlife Protection (SDG 14.2 & 14.5)',
    description:
      'Monitor the Palawan Coral Sanctuary MPA, track endangered sea turtles, reef sharks, and pygmy seahorses, and flag perimeter incursions.',
    primaryCapability: MonitoringCapability.MARINE_LIFE,
    defaultControlMode: ControlMode.FOLLOW,
    spawnPosition: { x: 16, y: -16, z: -18 },
    spawnHeading: 90,
    timeOfDay: 13.0,
    seaState: 'calm',
    sdgTargets: ['14.2', '14.5', '14.a'],
    objectives: [
      {
        id: 'obj-c1',
        description: 'Track Endangered Green Sea Turtle & Grey Reef Shark',
        targetEntityIds: ['ent-sea-turtle', 'ent-reef-shark'],
        completed: false,
      },
      {
        id: 'obj-c2',
        description: 'Locate rare Pygmy Seahorse colony on coral ridge',
        targetEntityIds: ['ent-seahorse-colony'],
        completed: false,
      },
      {
        id: 'obj-c3',
        description: 'Assess Coral Bleaching Patch #CB-03',
        targetEntityIds: ['ent-coral-bleaching'],
        completed: false,
      },
    ],
  },
  {
    id: 'scenario-seabed',
    code: 'D',
    name: 'Seabed Inspection & Bathymetry',
    subtitle: 'Benthic Sonar Sweep, Pipeline & Anomaly Survey (SDG 14.a)',
    description:
      'Execute a high-resolution acoustic bathymetry sweep over the subsea pipeline manifold, sunken shipwreck SS Poseidon, and metallic anomaly #SA-07.',
    primaryCapability: MonitoringCapability.SEABED_MAPPING,
    defaultControlMode: ControlMode.SURVEY,
    spawnPosition: { x: -20, y: -24, z: 8 },
    spawnHeading: 195,
    timeOfDay: 16.5,
    seaState: 'moderate',
    sdgTargets: ['14.a', '14.1', '14.2'],
    objectives: [
      {
        id: 'obj-d1',
        description: 'Inspect Subsea Pipeline Manifold #PM-01',
        targetEntityIds: ['ent-pipeline-manifold'],
        completed: false,
      },
      {
        id: 'obj-d2',
        description: 'Perform close-up scan of Seabed Anomaly #SA-07',
        targetEntityIds: ['ent-seabed-anomaly'],
        completed: false,
      },
      {
        id: 'obj-d3',
        description: 'Survey Sunken Wreck SS Poseidon without collision',
        targetEntityIds: ['ent-shipwreck'],
        completed: false,
      },
    ],
  },
  {
    id: 'scenario-sandbox',
    code: 'E',
    name: 'Free Explore Sandbox',
    subtitle: 'Full Multi-Capability Autonomous & Manual Command',
    description:
      'Open-ocean sandbox with full manual flight controls, all 5 autonomous navigation modes, live environmental sliders, and comms-outage testing.',
    primaryCapability: MonitoringCapability.VESSEL_TRACKING,
    defaultControlMode: ControlMode.MANUAL,
    spawnPosition: { x: 0, y: -12, z: 8 },
    spawnHeading: 0,
    timeOfDay: 12.5,
    seaState: 'calm',
    sdgTargets: ['14.1', '14.2', '14.4', '14.5', '14.a'],
    objectives: [
      {
        id: 'obj-e1',
        description: 'Fly ROV manually or engage Autonomous Patrol mode',
        targetEntityIds: ['ent-trawler-hull', 'ent-plastic-gyre'],
        completed: false,
      },
      {
        id: 'obj-e2',
        description: 'Triage & dispatch a high-priority alert from the Max-Heap',
        targetEntityIds: ['ent-ghost-net-01'],
        completed: false,
      },
      {
        id: 'obj-e3',
        description: 'Generate an AI Analyst Mission Briefing',
        targetEntityIds: ['ent-seabed-anomaly'],
        completed: false,
      },
    ],
  },
];

export const SYSTEM_ARCHITECTURE_NODES: SystemArchitectureNode[] = [
  {
    id: 'rov',
    name: 'AEGIS Underwater Drone (ROV)',
    subtitle: 'Subsea Edge Sensor & Actuator Node',
    roleDescription:
      '6-thruster autonomous/tethered underwater vehicle equipped with low-light HD optical camera, multi-beam imaging sonar, CTD/fluorometer environmental suite, and obstacle-avoidance DFS stack.',
    status: 'nominal',
    throughputKbps: 14200,
    latencyMs: 4,
    packetsProcessed: 18420,
    specs: [
      '6× Brushless Vectored Thrusters (300m depth rating)',
      'Simulated YOLOv8 Optical Vision + 450 kHz Side-Scan Sonar',
      'Circular Ring Buffer (12-frame outage resilience)',
      'Stack/DFS Autonomous Entanglement Backtracking',
    ],
  },
  {
    id: 'surface_vessel',
    name: 'AEGIS-01 Surface Vessel (USV)',
    subtitle: 'Acoustic USBL Tracking & Tether Relay',
    roleDescription:
      'Unmanned Surface Vessel mothership that tracks the ROV via Ultra-Short Baseline (USBL) acoustics, supplies tether power, correlates surface radar/AIS tracks, and uplinks to LEO satellite.',
    status: 'nominal',
    throughputKbps: 12800,
    latencyMs: 12,
    packetsProcessed: 18390,
    specs: [
      'USBL Acoustic Transponder + Fiber Umbilical Winch',
      'X-Band Surface Marine Radar + AIS Receiver',
      'Solar/Hybrid Station-Keeping Dynamic Positioning',
      'Ku-Band Stabilized Satellite Phased Array',
    ],
  },
  {
    id: 'satellite',
    name: 'LEO Maritime Relay Satellite',
    subtitle: 'Beyond-Line-of-Sight Orbital Telemetry Link',
    roleDescription:
      'Low-Earth Orbit (LEO) satellite constellation providing high-bandwidth, low-latency backhaul from offshore Marine Protected Areas to coastal ground stations.',
    status: 'nominal',
    throughputKbps: 9600,
    latencyMs: 42,
    packetsProcessed: 18340,
    specs: [
      'Altitude: 550 km Low-Earth Orbit (Ka/Ku Band)',
      'AES-256 Encrypted Telemetry & Evidence Framing',
      'Weather/Sea-State Adaptive Coding & Modulation',
      'Automatic Handover & Outage Detection',
    ],
  },
  {
    id: 'ground_station',
    name: 'Coastal Ground Station',
    subtitle: 'Telemetry Ingestion & Packet Demux',
    roleDescription:
      'Receives orbital telemetry frames, reassembles burst-flushed ring buffer packets after signal dropouts, and validates cryptographic GPS timestamps.',
    status: 'nominal',
    throughputKbps: 9600,
    latencyMs: 58,
    packetsProcessed: 18310,
    specs: [
      'Dual-Redundant Parabolic Gateway Dish Array',
      'Out-of-Order Frame Reassembly & CRC Verification',
      'AIS / VMS National Maritime Registry Cross-Check',
      'Fiber Backhaul to Cloud AI Analytics Cluster',
    ],
  },
  {
    id: 'cloud_server',
    name: 'Cloud AI & Fusion Server',
    subtitle: 'Multi-Sensor Fusion, DSA Indexing & Gemini Analyst',
    roleDescription:
      'Executes Bayesian multi-sensor fusion (Camera + Sonar + GPS + Env), indexes vessels in an O(1) FNV-1a Hash Table, ranks threats in a Binary Max-Heap, and powers the Gemini AI Analyst.',
    status: 'nominal',
    throughputKbps: 24500,
    latencyMs: 85,
    packetsProcessed: 18290,
    specs: [
      'Bayesian Multi-Sensor Confidence Fusion Engine',
      'Binary Max-Heap Threat Triage + Merge/Quick Sort',
      'Bathymetric 3D Point-Cloud & Pollution Heatmapper',
      'Gemini Flash AI Analyst Decision-Support Engine',
    ],
  },
  {
    id: 'web_dashboard',
    name: 'Command Center Web Dashboard',
    subtitle: 'Operator Situational Awareness & Mission Control',
    roleDescription:
      'Real-time 3D/2D digital twin interface displaying ROV HUD telemetry, live YOLO overlays, sonar sweep, SDG 14 KPIs, and interactive mission reporting.',
    status: 'nominal',
    throughputKbps: 6400,
    latencyMs: 95,
    packetsProcessed: 18280,
    specs: [
      '60 FPS WebGL 3D Ocean Twin + 2D Canvas Fallback',
      '5 Mission Monitoring Capabilities + SDG 14 Mapping',
      'Interactive DSA Visualizer & Self-Test Diagnostics',
      'Evidence Snapshot & PDF/JSON Mission Report Export',
    ],
  },
  {
    id: 'alerts_hub',
    name: 'Early Warning & Dispatch Hub',
    subtitle: 'Multi-Channel Maritime Enforcement Notifications',
    roleDescription:
      'Dispatches prioritized critical alerts via simulated Email, SMS, and Coast Guard / Marine Park Ranger App push channels when dequeued from the Max-Heap.',
    status: 'nominal',
    throughputKbps: 1200,
    latencyMs: 110,
    packetsProcessed: 642,
    specs: [
      'Max-Heap Priority Triage (Risk Score 1–100)',
      'Simulated Coast Guard & MPA Ranger Dispatch API',
      'Automated GPS Evidence Package Attachment',
      'Audit Log for SDG 14.4 & 14.5 Compliance',
    ],
  },
];
