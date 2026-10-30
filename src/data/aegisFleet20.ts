export type ThreatFocusFilter = 'HIGH_RISK' | 'SANCTUARY' | 'SIGNAL_OFF' | 'ALL';
export type RiskTierFilter = 'HIGH' | 'MEDIUM' | 'ALL_SHIPS';
export type MatrixStatusFilter = 'CRITICAL' | 'ALERTIVE' | 'NORMAL' | 'ALL';
export type GearTypeFilter =
  | 'ALL'
  | 'Net Trawlers'
  | 'Longline Boats'
  | 'Freezer Ships'
  | 'Commercial/Research';

export type SubseaVisionMode =
  | 'OPTICAL'
  | 'THERMAL'
  | 'SONAR'
  | 'LASER_DRAFT';

export interface VesselWaypoint {
  id: string;
  label: string;
  coords: string;
  svgPos?: [number, number];
  summary: string;
}

export interface DllTrajectoryNode {
  id: string;
  time: string;
  coords: [number, number];
  speedKts: number;
  note?: string;
}

export interface SubseaAnomalySpec {
  id: string;
  title: string;
  depthRange: string;
  category: 'ILLEGAL_GEAR' | 'HULL_DRAFT' | 'ACOUSTIC_SPOOF' | 'WILDLIFE_RISK' | 'DISCHARGE' | 'COMPLIANT_SYSTEM';
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  description: string;
  sdgTarget: string;
  relativePos: [number, number, number]; // relative to ship hull in 3D scene
}

export interface AegisVesselRecord {
  id: string; // 'V-001' .. 'V-020'
  vesselNum: number; // 1 .. 20
  codename: string;
  vesselName: string;
  mmsi: string;
  imo: string;
  callsign: string;
  flagCode: string;
  flagName: string;
  vesselType: string;
  gearCategory: Exclude<GearTypeFilter, 'ALL'>;
  lengthMeters: number;
  grossTonnage: number;
  riskScore: number;
  status: 'CRITICAL' | 'ALERTIVE' | 'NORMAL';
  isOnline: boolean;
  signalTurnedOff: boolean;
  aisStatusText: string;
  sanctuaryTrespass: boolean;
  baseCoordinates: string;
  baseLatDeg: number;
  baseLngDeg: number;
  baseSogKts: number;
  baseHeadingDeg: number;
  headingCardinal: string;
  baseDraftMeters: number;
  manifestDraftMeters: number;
  draftDeltaMeters: number;
  draftDisplayNote: string;
  leafletPos: [number, number];
  radarPos: { xPct: number; yPct: number };
  voyageRoute: {
    originPort: string;
    originSvg: [number, number];
    destPort: string;
    destSvg: [number, number];
    currentSvg: [number, number];
    protectedZone: string;
  };
  waypoints: VesselWaypoint[];
  dllTrajectoryNodes: DllTrajectoryNode[];
  underwaterReconTarget: string;
  dsaAlgorithm: string;
  dsaComplexity: string;
  hullColorHex: number;
  acousticSignature: {
    propellerRpm: number;
    cavitationHz: number;
    sonarPingDb: number;
    noiseProfile: string;
  };
  wildlifeProximity: {
    species: string;
    distanceMeters: number;
    status: string;
  }[];
  subseaAnomalies: SubseaAnomalySpec[];
}

export interface LiveOscillatedVessel extends AegisVesselRecord {
  liveCoordinates: string;
  liveSogKts: number;
  liveHeadingDeg: number;
  liveHeadingDisplay: string;
  liveDraftMeters: number;
  liveCavitationHz: number;
  liveSonarPingDb: number;
}

export interface BreadcrumbNode {
  id: string;
  index: number;
  x: number;
  y: number;
  depth: number;
  heading: number;
  timestamp: string;
  signalDbm: number;
}

export interface HydrophoneRingPacket {
  seq: number;
  slotIndex: number;
  vesselId: string;
  timestamp: string;
  cavitationHz: number;
  sonarPingDb: number;
  hullDraftDelta: string;
  encryptedHash: string;
}

export interface SubseaEvidenceRecord {
  id: string;
  vesselId: string;
  vesselName: string;
  codename: string;
  mmsi: string;
  imo: string;
  timestamp: string;
  visionMode: SubseaVisionMode;
  coordinates: string;
  auvDepthMeters: number;
  measuredDraftMeters: number;
  draftDeltaMeters: number;
  anomalyTitle: string;
  findingSummary: string;
  sdgTarget: string;
  cryptoHash: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

export const AEGIS_20_VESSELS: AegisVesselRecord[] = [
  // ================= A. CRITICAL PRIORITY TARGETS (Risk Score >= 80) =================
  {
    id: 'V-001',
    vesselNum: 1,
    codename: 'OCEAN GHOST',
    vesselName: 'FV HAI LONG 88',
    mmsi: '412789120',
    imo: '9144820',
    callsign: 'BZ8K',
    flagCode: 'PA',
    flagName: 'Panama',
    vesselType: 'Squid Jigging Vessel',
    gearCategory: 'Net Trawlers',
    lengthMeters: 73.2,
    grossTonnage: 1840,
    riskScore: 96,
    status: 'CRITICAL',
    isOnline: false,
    signalTurnedOff: true,
    aisStatusText: '6h 12m ago - Signal Off',
    sanctuaryTrespass: true,
    baseCoordinates: '04°18\'22"S 082°44\'09"W',
    baseLatDeg: -4.3061,
    baseLngDeg: -82.7358,
    baseSogKts: 1.4,
    baseHeadingDeg: 142,
    headingCardinal: 'SE',
    baseDraftMeters: 5.2,
    manifestDraftMeters: 3.8,
    draftDeltaMeters: 1.4,
    draftDisplayNote: '5.2m deep (+1.4m heavier — loaded with catch)',
    leafletPos: [39.2, -149.2],
    radarPos: { xPct: 52, yPct: 51 },
    voyageRoute: {
      originPort: 'Valparaíso, Chile',
      originSvg: [120, 330],
      destPort: 'Busan, South Korea',
      destSvg: [920, 80],
      currentSvg: [790, 190],
      protectedZone: 'GALÁPAGOS SANCTUARY POLYGON #4',
    },
    waypoints: [
      {
        id: 'V001-W1',
        label: 'STOP #1',
        coords: '04°18\'22"S, 082°44\'09"W',
        svgPos: [350, 295],
        summary: '72h Trawling at 0.4 kts, dragging fine-mesh squid jigs inside no-take reserve',
      },
      {
        id: 'V001-W2',
        label: 'STOP #2',
        coords: '02°11\'05"S, 085°18\'33"W',
        svgPos: [490, 210],
        summary: '114h Sanctuary / Transshipment alongside HAI QING 12 at 0.1 kts',
      },
      {
        id: 'V001-W3',
        label: 'STOP #3',
        coords: '01°55\'40"S, 091°12\'04"W',
        svgPos: [680, 205],
        summary: '4.8h Cargo Hand-off / 19h loitering longlines at 0.8 kts',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '14:00', coords: [-3.8, -83.2], speedKts: 11.2, note: 'Approach Vector' },
      { id: 'T2', time: '16:00', coords: [-4.0, -83.0], speedKts: 8.4, note: 'Boundary Entry' },
      { id: 'T3', time: '18:00', coords: [-4.18, -82.73], speedKts: 1.4, note: 'Dark Gap' },
    ],
    underwaterReconTarget:
      'Submerged fine-mesh squid jigging lines at 45m–120m depth, overloaded hull draft (5.2m), disabled acoustic transponder ping, Scalloped Hammerhead shark entanglement risk.',
    dsaAlgorithm: 'Graph Traversal (BFS & Polygon Edge Intersection)',
    dsaComplexity: 'O(V + E)',
    hullColorHex: 0x7f1d1d,
    acousticSignature: {
      propellerRpm: 118,
      cavitationHz: 142,
      sonarPingDb: 168,
      noiseProfile: 'Low-RPM Winch Drum & Jig Line Strumming (AIS Transponder Silent)',
    },
    wildlifeProximity: [
      { species: 'Scalloped Hammerhead Shark (Sphyrna lewini)', distanceMeters: 18, status: 'CRITICAL ENTANGLEMENT RISK' },
      { species: 'Humboldt Giant Squid Shoal', distanceMeters: 12, status: 'Active Harvest Target' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V001-1',
        title: 'Illegal Fine-Mesh Squid Jigging Curtain (45m–120m)',
        depthRange: '45m – 120m',
        category: 'ILLEGAL_GEAR',
        severity: 'CRITICAL',
        description: 'Unmarked 18mm monofilament jigging array deployed inside Galápagos Sanctuary Polygon #4.',
        sdgTarget: 'SDG 14.4 & 14.5',
        relativePos: [0, -14, -6],
      },
      {
        id: 'ANOM-V001-2',
        title: 'Overloaded Plimsoll Waterline Draft (+1.4m Heavier)',
        depthRange: '5.2m Hull Keel',
        category: 'HULL_DRAFT',
        severity: 'CRITICAL',
        description: 'Laser profiler confirms hull sits at 5.2m draft vs. 3.8m declared ballast (~310 tons unreported squid catch).',
        sdgTarget: 'SDG 14.4',
        relativePos: [4, -4.5, 0],
      },
      {
        id: 'ANOM-V001-3',
        title: 'Scalloped Hammerhead Entanglement Hazard',
        depthRange: '38m – 62m',
        category: 'WILDLIFE_RISK',
        severity: 'CRITICAL',
        description: 'Three Endangered Scalloped Hammerhead sharks circling baited jig hooks within 18m of stern.',
        sdgTarget: 'SDG 14.2',
        relativePos: [-10, -11, 5],
      },
    ],
  },
  {
    id: 'V-002',
    vesselNum: 2,
    codename: 'SHADOW REEFER',
    vesselName: 'HAI QING 12',
    mmsi: '413890211',
    imo: '9348123',
    callsign: 'BH4N',
    flagCode: 'CN',
    flagName: 'China',
    vesselType: 'Cargo Reefer Transshipment Ship',
    gearCategory: 'Freezer Ships',
    lengthMeters: 89.5,
    grossTonnage: 3200,
    riskScore: 92,
    status: 'CRITICAL',
    isOnline: false,
    signalTurnedOff: true,
    aisStatusText: '4h 45m ago - Telemetry Gap',
    sanctuaryTrespass: false,
    baseCoordinates: '02°11\'05"S 085°18\'33"W',
    baseLatDeg: -2.1847,
    baseLngDeg: -85.3092,
    baseSogKts: 0.2,
    baseHeadingDeg: 210,
    headingCardinal: 'SW',
    baseDraftMeters: 6.8,
    manifestDraftMeters: 4.7,
    draftDeltaMeters: 2.1,
    draftDisplayNote: '6.8m deep (+2.1m heavier — draft increased mid-sea)',
    leafletPos: [-19.6, -130.4],
    radarPos: { xPct: 71, yPct: 40 },
    voyageRoute: {
      originPort: 'Fuzhou, China',
      originSvg: [100, 110],
      destPort: 'Manta, Ecuador',
      destSvg: [900, 260],
      currentSvg: [850, 250],
      protectedZone: 'HIGH SEAS TRANSSHIPMENT BUFFER',
    },
    waypoints: [
      {
        id: 'V002-W1',
        label: 'STOP #1',
        coords: '02°11\'05"S, 085°18\'33"W',
        svgPos: [530, 280],
        summary: '4.8h Dark Gap at 0.2 kts, hull-to-hull refrigerated squid transfer',
      },
      {
        id: 'V002-W2',
        label: 'STOP #2',
        coords: '03°02\'19"S, 086°40\'11"W',
        svgPos: [700, 225],
        summary: '6.2h Dual Rafting alongside 2 unlicensed catcher boats at 0.3 kts',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '08:00', coords: [-1.9, -85.5], speedKts: 12.0, note: 'Transit Speed' },
      { id: 'T2', time: '11:00', coords: [-2.05, -85.3], speedKts: 3.5, note: 'Deceleration' },
      { id: 'T3', time: '11:15', coords: [-2.18, -85.3], speedKts: 0.2, note: 'Dark Gap' },
    ],
    underwaterReconTarget:
      'Hull-to-hull rubber fenders, submerged bilge discharge plume, Plimsoll draft mark submerged +2.1m deeper than manifest (6.8m), dual anchor chains hanging in deep water.',
    dsaAlgorithm: 'Doubly Linked List (DLL) Gap Traversal & Temporal Delta Analysis',
    dsaComplexity: 'O(N)',
    hullColorHex: 0x3b1d5e,
    acousticSignature: {
      propellerRpm: 35,
      cavitationHz: 88,
      sonarPingDb: 174,
      noiseProfile: 'Heavy Ammonia Reefer Compressors & Crane Hoist Winches',
    },
    wildlifeProximity: [
      { species: 'Bryde\'s Whale (Balaenoptera edeni)', distanceMeters: 95, status: 'Acoustic Masking Zone' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V002-1',
        title: 'Plimsoll Mark Submerged +2.1m (6.8m Deep Draft)',
        depthRange: '6.8m Hull Keel',
        category: 'HULL_DRAFT',
        severity: 'CRITICAL',
        description: 'Unreported mid-ocean cargo intake increased draft by +2.1m during 4h 45m AIS blackout.',
        sdgTarget: 'SDG 14.4',
        relativePos: [0, -6.2, 2],
      },
      {
        id: 'ANOM-V002-2',
        title: 'Hull-to-Hull Rafting Fenders & Bilge Plume',
        depthRange: '2m – 18m',
        category: 'DISCHARGE',
        severity: 'CRITICAL',
        description: 'Pneumatic Yokohama fenders compressed against catcher boat hull; oily bilge condensate plume at 12m.',
        sdgTarget: 'SDG 14.1 & 14.4',
        relativePos: [8, -5, -4],
      },
    ],
  },
  {
    id: 'V-003',
    vesselNum: 3,
    codename: 'DARK DRIFTER',
    vesselName: 'FV SOUTHERN STAR',
    mmsi: '354921008',
    imo: '8872019',
    callsign: 'HP29',
    flagCode: 'LR',
    flagName: 'Liberia',
    vesselType: 'Pelagic Longline Fishing Boat',
    gearCategory: 'Longline Boats',
    lengthMeters: 58.0,
    grossTonnage: 1250,
    riskScore: 89,
    status: 'CRITICAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '14 mins ago',
    sanctuaryTrespass: false,
    baseCoordinates: '01°55\'40"S 091°12\'04"W',
    baseLatDeg: -1.9278,
    baseLngDeg: -91.2011,
    baseSogKts: 0.8,
    baseHeadingDeg: 45,
    headingCardinal: 'NE',
    baseDraftMeters: 4.1,
    manifestDraftMeters: 3.6,
    draftDeltaMeters: 0.5,
    draftDisplayNote: '4.1m deep (+0.5m active longline haul)',
    leafletPos: [1.6, -161.6],
    radarPos: { xPct: 45, yPct: 68 },
    voyageRoute: {
      originPort: 'Montevideo, Uruguay',
      originSvg: [880, 330],
      destPort: 'Papeete, French Polynesia',
      destSvg: [120, 180],
      currentSvg: [160, 170],
      protectedZone: 'NAZCA RIDGE SEAMOUNT BIOSPHERE',
    },
    waypoints: [
      {
        id: 'V003-W1',
        label: 'STOP #1',
        coords: '01°55\'40"S, 091°12\'04"W',
        svgPos: [470, 210],
        summary: '19.2h Longline Drift at 0.8 kts; 80 miles of pelagic longlines deployed',
      },
      {
        id: 'V003-W2',
        label: 'STOP #2',
        coords: '02°28\'15"S, 090°44\'30"W',
        svgPos: [330, 220],
        summary: '14.5h Saw-tooth Netting over shark migration corridor',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-1.7, -91.5], speedKts: 11.5, note: 'Ridge Approach' },
      { id: 'T2', time: '14:30', coords: [-1.85, -91.3], speedKts: 4.2, note: 'Setting Gear' },
      { id: 'T3', time: '16:00', coords: [-1.92, -91.2], speedKts: 0.8, note: 'Longline Drift' },
    ],
    underwaterReconTarget:
      '80-mile baited pelagic monofilament longline curtain with thousands of steel J-hooks suspended at 35m–90m depth; live acoustic detection of Leatherback Sea Turtles and Whale Sharks near hooks.',
    dsaAlgorithm: 'Sliding Window Kinematic Velocity Scan & Pattern Clustering',
    dsaComplexity: 'O(W)',
    hullColorHex: 0x7c2d12,
    acousticSignature: {
      propellerRpm: 72,
      cavitationHz: 115,
      sonarPingDb: 162,
      noiseProfile: 'Hydraulic Line-Shooter & Monofilament Spool Tension',
    },
    wildlifeProximity: [
      { species: 'Leatherback Sea Turtle (Dermochelys coriacea)', distanceMeters: 14, status: 'CRITICAL BYCATCH DANGER' },
      { species: 'Whale Shark (Rhincodon typus)', distanceMeters: 32, status: 'Migratory Corridor Overlap' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V003-1',
        title: '80-Mile Baited Pelagic J-Hook Curtain (35m–90m)',
        depthRange: '35m – 90m',
        category: 'ILLEGAL_GEAR',
        severity: 'CRITICAL',
        description: 'Unlicensed wire-trace steel J-hooks lacking circle-hook turtle excluder geometry.',
        sdgTarget: 'SDG 14.4 & 14.2',
        relativePos: [-6, -13, 0],
      },
      {
        id: 'ANOM-V003-2',
        title: 'Leatherback Turtle & Whale Shark Proximity Alert',
        depthRange: '28m – 55m',
        category: 'WILDLIFE_RISK',
        severity: 'CRITICAL',
        description: 'Critically endangered Leatherback turtle detected 14m from active baited branchlines.',
        sdgTarget: 'SDG 14.2',
        relativePos: [10, -10, 6],
      },
    ],
  },
  {
    id: 'V-004',
    vesselNum: 4,
    codename: 'PHANTOM RUNNER',
    vesselName: 'FV POSEIDON VI',
    mmsi: '224098410',
    imo: '9012845',
    callsign: 'EBD9',
    flagCode: 'VU',
    flagName: 'Vanuatu',
    vesselType: 'Deep Sea Industrial Trawler',
    gearCategory: 'Net Trawlers',
    lengthMeters: 67.4,
    grossTonnage: 2100,
    riskScore: 95,
    status: 'CRITICAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '2 mins ago - Fabricated Coordinates (142 NM SAR mismatch)',
    sanctuaryTrespass: false,
    baseCoordinates: '03°42\'18"S 089°22\'50"W',
    baseLatDeg: -3.705,
    baseLngDeg: -89.3806,
    baseSogKts: 5.2,
    baseHeadingDeg: 320,
    headingCardinal: 'NW',
    baseDraftMeters: 5.9,
    manifestDraftMeters: 4.1,
    draftDeltaMeters: 1.8,
    draftDisplayNote: '5.9m deep (+1.8m heavier)',
    leafletPos: [43.8, -38.8],
    radarPos: { xPct: 28, yPct: 80 },
    voyageRoute: {
      originPort: 'Callao, Peru',
      originSvg: [860, 270],
      destPort: 'Kaohsiung, Taiwan',
      destSvg: [150, 100],
      currentSvg: [190, 135],
      protectedZone: 'PERU-CHILE TRENCH BENTHIC CORRIDOR',
    },
    waypoints: [
      {
        id: 'V004-W1',
        label: 'STOP #1',
        coords: '03°42\'18"S, 089°22\'50"W',
        svgPos: [590, 315],
        summary: '38h AIS Spoofed 142 NM, deep trench bottom-trawling at 5.2 kts',
      },
      {
        id: 'V004-W2',
        label: 'STOP #2',
        coords: '04°15\'35"S, 088°50\'12"W',
        svgPos: [430, 225],
        summary: '54h Heavy Net Drag across deep seamounts',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '10:00', coords: [-3.1, -89.8], speedKts: 5.0, note: 'Trawl Vector A' },
      { id: 'T2', time: '12:00', coords: [-3.4, -89.5], speedKts: 5.1, note: 'Seamount Drag' },
      { id: 'T3', time: '14:00', coords: [-3.7, -89.37], speedKts: 5.2, note: 'Spoofed (142 NM off)' },
    ],
    underwaterReconTarget:
      'Heavy steel otter boards and benthic bottom-trawl dredge scraping cold-water coral seamounts at 280m depth, massive sediment turbidity plume, hydraulic winch cable tension telemetry.',
    dsaAlgorithm: 'Spatial Hash Mapping & SAR Discrepancy Cross-Check',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x881337,
    acousticSignature: {
      propellerRpm: 245,
      cavitationHz: 310,
      sonarPingDb: 192,
      noiseProfile: 'Benthic Rockhopper Dredge Grinding & High-Torque Warp Cables',
    },
    wildlifeProximity: [
      { species: 'Cold-Water Lophelia Coral Reef', distanceMeters: 2, status: 'SEVERE BENTHIC SCAR DAMAGE' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V004-1',
        title: 'Benthic Steel Otter Boards & Rockhopper Dredge (280m)',
        depthRange: '180m – 280m',
        category: 'ILLEGAL_GEAR',
        severity: 'CRITICAL',
        description: '4.2-ton steel trawl doors pulverizing deep-sea coral seamount; 48 NTU sediment plume.',
        sdgTarget: 'SDG 14.2 & 14.4',
        relativePos: [-12, -16, 0],
      },
      {
        id: 'ANOM-V004-2',
        title: 'GNSS/AIS Spoofing Transponder Offset (142 NM)',
        depthRange: '5.9m Hull Keel',
        category: 'ACOUSTIC_SPOOF',
        severity: 'CRITICAL',
        description: 'Subsea acoustic beacon confirms physical hull is 142 NM southeast of broadcast AIS coordinates.',
        sdgTarget: 'SDG 14.4',
        relativePos: [2, -5.5, 0],
      },
    ],
  },

  // ================= B. ELEVATED RISK TARGETS (ALERTIVE — Risk Score 50-80) =================
  {
    id: 'V-005',
    vesselNum: 5,
    codename: 'BOUNDARY BREAKER',
    vesselName: 'PACIFIC RAIDER',
    mmsi: '518004912',
    imo: '9210488',
    callsign: 'E5U8',
    flagCode: 'CK',
    flagName: 'Cook Islands',
    vesselType: 'High-Speed Trawler',
    gearCategory: 'Net Trawlers',
    lengthMeters: 62.0,
    grossTonnage: 1680,
    riskScore: 74,
    status: 'ALERTIVE',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '4 mins ago - High Speed MPA Skim',
    sanctuaryTrespass: true,
    baseCoordinates: '01°12\'10"S 092°45\'00"W',
    baseLatDeg: -1.2028,
    baseLngDeg: -92.75,
    baseSogKts: 13.8,
    baseHeadingDeg: 120,
    headingCardinal: 'SE',
    baseDraftMeters: 4.8,
    manifestDraftMeters: 4.3,
    draftDeltaMeters: 0.5,
    draftDisplayNote: '4.8m deep (Approaching MPA boundary at 13.8 kts)',
    leafletPos: [-30.0, -20.0],
    radarPos: { xPct: 38, yPct: 34 },
    voyageRoute: {
      originPort: 'Suva, Fiji',
      originSvg: [110, 240],
      destPort: 'Balboa, Panama',
      destSvg: [890, 150],
      currentSvg: [830, 185],
      protectedZone: 'GALÁPAGOS / MALPELO SANCTUARY PERIMETER',
    },
    waypoints: [
      {
        id: 'V005-W1',
        label: 'ALERT #1',
        coords: '01°12\'10"S, 092°45\'00"W',
        svgPos: [620, 195],
        summary: 'Boundary Skim 0.8 NM from Galápagos Sanctuary at 13.8 kts',
      },
      {
        id: 'V005-W2',
        label: 'ALERT #2',
        coords: '00°58\'40"S, 091°10\'15"W',
        svgPos: [740, 190],
        summary: 'Radar Evasion sprint vector along reserve buffer',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '15:00', coords: [-1.05, -93.1], speedKts: 14.1, note: 'Sprint Approach' },
      { id: 'T2', time: '16:00', coords: [-1.14, -92.9], speedKts: 13.9, note: '0.8 NM Boundary Skim' },
      { id: 'T3', time: '17:00', coords: [-1.2, -92.75], speedKts: 13.8, note: 'Sanctuary Vector' },
    ],
    underwaterReconTarget:
      'High-RPM twin-screw propeller cavitation signature (13.8 kts), retracted mid-water trawl doors ready for rapid deployment, Quadtree boundary raycast vector line.',
    dsaAlgorithm: 'Quadtree Spatial Boundary Raycasting',
    dsaComplexity: 'O(log N)',
    hullColorHex: 0x9a3412,
    acousticSignature: {
      propellerRpm: 380,
      cavitationHz: 465,
      sonarPingDb: 184,
      noiseProfile: 'High-Speed Twin-Screw Blade Tip Cavitation (13.8 kts)',
    },
    wildlifeProximity: [
      { species: 'Spotted Eagle Ray School', distanceMeters: 42, status: 'Acoustic Avoidance Response' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V005-1',
        title: 'Twin-Screw High-RPM Cavitation & Cocked Trawl Doors',
        depthRange: '4.8m – 18m',
        category: 'ILLEGAL_GEAR',
        severity: 'WARNING',
        description: 'Mid-water trawl doors suspended on slip-hooks for rapid nocturnal drop inside sanctuary.',
        sdgTarget: 'SDG 14.4 & 14.5',
        relativePos: [-8, -6, 0],
      },
    ],
  },
  {
    id: 'V-006',
    vesselNum: 6,
    codename: 'SILENT SQUID',
    vesselName: 'ALBACORA I',
    mmsi: '312654000',
    imo: '8944120',
    callsign: 'V3XK',
    flagCode: 'BZ',
    flagName: 'Belize',
    vesselType: 'Jigging Vessel',
    gearCategory: 'Net Trawlers',
    lengthMeters: 55.4,
    grossTonnage: 1190,
    riskScore: 68,
    status: 'ALERTIVE',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '9 mins ago - Dead Drift Stoppage',
    sanctuaryTrespass: false,
    baseCoordinates: '02°55\'14"S 087°33\'12"W',
    baseLatDeg: -2.9206,
    baseLngDeg: -87.5533,
    baseSogKts: 0.1,
    baseHeadingDeg: 0,
    headingCardinal: 'Drift',
    baseDraftMeters: 4.2,
    manifestDraftMeters: 3.9,
    draftDeltaMeters: 0.3,
    draftDisplayNote: '4.2m deep (0.1 kts Dead-Drift Stoppage)',
    leafletPos: [-23.8, 73.8],
    radarPos: { xPct: 64, yPct: 58 },
    voyageRoute: {
      originPort: 'Puntarenas, Costa Rica',
      originSvg: [130, 150],
      destPort: 'Guayaquil, Ecuador',
      destSvg: [880, 310],
      currentSvg: [780, 290],
      protectedZone: 'COCOS-GALÁPAGOS SWIMWAY BUFFER',
    },
    waypoints: [
      {
        id: 'V006-W1',
        label: 'ALERT #1',
        coords: '05°30\'00"N, 087°04\'00"W',
        svgPos: [480, 230],
        summary: 'Nocturnal Squid Lights (800 kW halogen array penetrating 60m)',
      },
      {
        id: 'V006-W2',
        label: 'ALERT #2',
        coords: '05°12\'18"N, 086°42\'30"W',
        svgPos: [640, 265],
        summary: 'Buffer Zone Drift at 0.1 kts claiming coolant pump repair',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '19:00', coords: [-2.85, -87.6], speedKts: 9.2, note: 'Evening Approach' },
      { id: 'T2', time: '21:00', coords: [-2.91, -87.56], speedKts: 0.4, note: 'Stoppage Claimed' },
      { id: 'T3', time: '21:45', coords: [-2.92, -87.55], speedKts: 0.1, note: '800kW Light Cone' },
    ],
    underwaterReconTarget:
      '45-minute dead-drift engine cooling intake inspection (verifying Captain\'s Two-Way Stoppage Report: auxiliary coolant pump repair vs. nocturnal 800 kW halogen squid-attracting light cone penetrating 60m underwater).',
    dsaAlgorithm: 'Two-Way Stoppage Thermal & Optical Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x854d0e,
    acousticSignature: {
      propellerRpm: 0,
      cavitationHz: 60,
      sonarPingDb: 158,
      noiseProfile: 'Auxiliary Diesel Generators at 100% Load Driving 800 kW Halogen Banks',
    },
    wildlifeProximity: [
      { species: 'Pelagic Thresher Shark', distanceMeters: 26, status: 'Phototactic Prey Aggregation' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V006-1',
        title: '800 kW Nocturnal Halogen Squid-Attracting Light Cone (60m)',
        depthRange: '0m – 60m',
        category: 'DISCHARGE',
        severity: 'WARNING',
        description: 'Thermal & optical sensors confirm main generators powering illegal luring lights despite claimed engine breakdown.',
        sdgTarget: 'SDG 14.4',
        relativePos: [0, -10, 0],
      },
    ],
  },
  {
    id: 'V-007',
    vesselNum: 7,
    codename: 'ROUTE DRIFTER',
    vesselName: 'GOLDEN WAVE',
    mmsi: '440129880',
    imo: '9188240',
    callsign: 'D7AC',
    flagCode: 'KR',
    flagName: 'South Korea',
    vesselType: 'Longline Tuna Boat',
    gearCategory: 'Longline Boats',
    lengthMeters: 51.2,
    grossTonnage: 980,
    riskScore: 65,
    status: 'ALERTIVE',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '6 mins ago - 68 NM Corridor Detour',
    sanctuaryTrespass: false,
    baseCoordinates: '04°50\'18"S 090°15\'42"W',
    baseLatDeg: -4.8383,
    baseLngDeg: -90.2617,
    baseSogKts: 7.2,
    baseHeadingDeg: 285,
    headingCardinal: 'WNW',
    baseDraftMeters: 3.9,
    manifestDraftMeters: 3.5,
    draftDeltaMeters: 0.4,
    draftDisplayNote: '3.9m deep (68 NM off-track seamount detour)',
    leafletPos: [13.4, 66.6],
    radarPos: { xPct: 33, yPct: 62 },
    voyageRoute: {
      originPort: 'Chimbote, Peru',
      originSvg: [870, 240],
      destPort: 'Busan, South Korea',
      destSvg: [130, 90],
      currentSvg: [210, 120],
      protectedZone: 'SEAMOUNT UPWELLING BUFFER ZONE',
    },
    waypoints: [
      {
        id: 'V007-W1',
        label: 'ALERT #1',
        coords: '04°50\'18"S, 090°15\'42"W',
        svgPos: [520, 175],
        summary: '68 NM Detour from great-circle lane over shallow seamount',
      },
      {
        id: 'V007-W2',
        label: 'ALERT #2',
        coords: '04°18\'55"S, 089°32\'10"W',
        svgPos: [370, 150],
        summary: 'Unreported Longline Set along thermal front',
      },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '09:00', coords: [-5.1, -89.6], speedKts: 11.4, note: 'Standard Lane' },
      { id: 'T2', time: '12:00', coords: [-4.95, -90.0], speedKts: 7.4, note: '68 NM Deviation' },
      { id: 'T3', time: '15:00', coords: [-4.83, -90.26], speedKts: 7.2, note: 'Stern Chute Open' },
    ],
    underwaterReconTarget:
      '68 NM off-track seamount detour inspection, secondary stern line-shooter housing, Dijkstra shortest-path deviation corridor overlay.',
    dsaAlgorithm: 'Dijkstra Shortest-Path Corridor Deviation',
    dsaComplexity: 'O((V + E) log V)',
    hullColorHex: 0x92400e,
    acousticSignature: {
      propellerRpm: 190,
      cavitationHz: 220,
      sonarPingDb: 166,
      noiseProfile: 'Medium-Speed Single Screw & Stern Bait Chute Hydraulics',
    },
    wildlifeProximity: [
      { species: 'Pacific Bluefin Tuna School', distanceMeters: 35, status: 'Active Feeding Front' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V007-1',
        title: 'Secondary Stern Line-Shooter & 68 NM Detour Vector',
        depthRange: '3.9m – 25m',
        category: 'ILLEGAL_GEAR',
        severity: 'WARNING',
        description: 'Subsea stern chute open with baited branchlines ready over uncharted seamount.',
        sdgTarget: 'SDG 14.4',
        relativePos: [-9, -5, 0],
      },
    ],
  },

  // ================= C. NORMAL COMMERCIAL & RESEARCH TRAFFIC (NORMAL — Risk Score < 50) =================
  {
    id: 'V-008',
    vesselNum: 8,
    codename: 'MERIDIAN STAR',
    vesselName: 'MV MERIDIAN STAR',
    mmsi: '211489000',
    imo: '9451020',
    callsign: 'DDLK',
    flagCode: 'DE',
    flagName: 'Germany',
    vesselType: 'Container Ship',
    gearCategory: 'Commercial/Research',
    lengthMeters: 282.0,
    grossTonnage: 74500,
    riskScore: 12,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '00°45\'10"N 086°12\'00"W',
    baseLatDeg: 0.7528,
    baseLngDeg: -86.2,
    baseSogKts: 18.5,
    baseHeadingDeg: 245,
    headingCardinal: 'WSW',
    baseDraftMeters: 12.4,
    manifestDraftMeters: 12.4,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '12.4m deep (Matches declared manifest)',
    leafletPos: [11.6, 88.4],
    radarPos: { xPct: 18, yPct: 24 },
    voyageRoute: {
      originPort: 'San Antonio, Chile',
      originSvg: [850, 340],
      destPort: 'Yokohama, Japan',
      destSvg: [90, 70],
      currentSvg: [450, 190],
      protectedZone: 'INTERNATIONAL TRANSIT CORRIDOR ALPHA',
    },
    waypoints: [
      { id: 'V008-W1', label: 'LANE #1', coords: '00°45\'10"N, 086°12\'00"W', svgPos: [450, 190], summary: 'Steady 18.5 kts commercial container transit' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [0.9, -85.8], speedKts: 18.4 },
      { id: 'T2', time: '14:00', coords: [0.82, -86.0], speedKts: 18.5 },
      { id: 'T3', time: '16:00', coords: [0.75, -86.2], speedKts: 18.5 },
    ],
    underwaterReconTarget: 'Baseline bulbous bow & 12.4m deep container keel acoustic calibration.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x0f766e,
    acousticSignature: {
      propellerRpm: 94,
      cavitationHz: 185,
      sonarPingDb: 152,
      noiseProfile: 'Compliant Slow-Speed Two-Stroke Diesel & Clean Anti-Fouling Hull',
    },
    wildlifeProximity: [
      { species: 'Pantropical Spotted Dolphin Pod', distanceMeters: 110, status: 'Bow-Wave Riding (Safe)' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V008-1',
        title: 'Compliant 12.4m Plimsoll Waterline & Clean Bulbous Bow',
        depthRange: '12.4m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Laser draft profiler matches manifest within ±0.02m; zero illegal gear.',
        sdgTarget: 'SDG 14.a',
        relativePos: [0, -11, 0],
      },
    ],
  },
  {
    id: 'V-009',
    vesselNum: 9,
    codename: 'ATLANTIC TRADER',
    vesselName: 'MV ATLANTIC TRADER',
    mmsi: '235091400',
    imo: '9512880',
    callsign: 'MVRP',
    flagCode: 'GB',
    flagName: 'UK',
    vesselType: 'Bulk Ore Carrier',
    gearCategory: 'Commercial/Research',
    lengthMeters: 225.0,
    grossTonnage: 43800,
    riskScore: 15,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '01°15\'00"S 083°10\'00"W',
    baseLatDeg: -1.25,
    baseLngDeg: -83.1667,
    baseSogKts: 14.2,
    baseHeadingDeg: 190,
    headingCardinal: 'S',
    baseDraftMeters: 11.0,
    manifestDraftMeters: 11.0,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '11.0m deep (Compliant bulk ore draft)',
    leafletPos: [15.8, 134.2],
    radarPos: { xPct: 82, yPct: 28 },
    voyageRoute: {
      originPort: 'Punta Arenas, Chile',
      originSvg: [820, 360],
      destPort: 'Callao, Peru',
      destSvg: [760, 220],
      currentSvg: [790, 290],
      protectedZone: 'HUMBOLDT CURRENT SHIPPING LANE',
    },
    waypoints: [
      { id: 'V009-W1', label: 'LANE #1', coords: '01°15\'00"S, 083°10\'00"W', svgPos: [790, 290], summary: '14.2 kts coastal freight corridor' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-0.9, -83.1], speedKts: 14.1 },
      { id: 'T2', time: '14:00', coords: [-1.1, -83.14], speedKts: 14.2 },
      { id: 'T3', time: '16:00', coords: [-1.25, -83.16], speedKts: 14.2 },
    ],
    underwaterReconTarget: '11.0m Panamax bulk carrier keel & ballast water UV treatment discharge check.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x1e3a8a,
    acousticSignature: {
      propellerRpm: 88,
      cavitationHz: 162,
      sonarPingDb: 148,
      noiseProfile: 'Steady Panamax Bulk Carrier Propulsion',
    },
    wildlifeProximity: [{ species: 'South American Sea Lion', distanceMeters: 140, status: 'Safe Transit' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V009-1',
        title: 'IMO Ballast Water Treatment Verified (11.0m Draft)',
        depthRange: '11.0m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Zero invasive species discharge; hull draft verified at 11.0m.',
        sdgTarget: 'SDG 14.1 & 14.2',
        relativePos: [0, -10, 0],
      },
    ],
  },
  {
    id: 'V-010',
    vesselNum: 10,
    codename: 'PACIFIC VOYAGER',
    vesselName: 'MV PACIFIC VOYAGER',
    mmsi: '431882000',
    imo: '9601140',
    callsign: '7JKA',
    flagCode: 'JP',
    flagName: 'Japan',
    vesselType: 'General Cargo',
    gearCategory: 'Commercial/Research',
    lengthMeters: 195.0,
    grossTonnage: 28400,
    riskScore: 18,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '2 mins ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '02°00\'00"S 093°50\'00"W',
    baseLatDeg: -2.0,
    baseLngDeg: -93.8333,
    baseSogKts: 15.6,
    baseHeadingDeg: 270,
    headingCardinal: 'W',
    baseDraftMeters: 9.8,
    manifestDraftMeters: 9.8,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '9.8m deep (Compliant cargo draft)',
    leafletPos: [-42.0, 158.0],
    radarPos: { xPct: 14, yPct: 54 },
    voyageRoute: {
      originPort: 'Manta, Ecuador',
      originSvg: [860, 230],
      destPort: 'Balboa, Panama',
      destSvg: [780, 120],
      currentSvg: [815, 175],
      protectedZone: 'EQUATORIAL COMMERCIAL ROUTE',
    },
    waypoints: [
      { id: 'V010-W1', label: 'LANE #1', coords: '02°00\'00"S, 093°50\'00"W', svgPos: [815, 175], summary: '15.6 kts general cargo transit' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-2.0, -93.3], speedKts: 15.5 },
      { id: 'T2', time: '14:00', coords: [-2.0, -93.6], speedKts: 15.6 },
      { id: 'T3', time: '16:00', coords: [-2.0, -93.83], speedKts: 15.6 },
    ],
    underwaterReconTarget: '9.8m general cargo hull & rudder anode corrosion inspection.',
    dsaAlgorithm: 'Merge Sort Multi-Sensor Confidence Ranking',
    dsaComplexity: 'O(N log N)',
    hullColorHex: 0x0369a1,
    acousticSignature: {
      propellerRpm: 102,
      cavitationHz: 170,
      sonarPingDb: 150,
      noiseProfile: 'Nominal General Cargo Acoustic Profile',
    },
    wildlifeProximity: [{ species: 'Green Sea Turtle', distanceMeters: 85, status: 'Clear of Lane' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V010-1',
        title: 'Clean Hull & Sacrificial Zinc Anode Array (9.8m)',
        depthRange: '9.8m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Standard commercial hull signature verified.',
        sdgTarget: 'SDG 14.a',
        relativePos: [0, -9, 0],
      },
    ],
  },
  {
    id: 'V-011',
    vesselNum: 11,
    codename: 'NORDIC HORIZON',
    vesselName: 'LNG NORDIC HORIZON',
    mmsi: '257910000',
    imo: '9723910',
    callsign: 'LAXP',
    flagCode: 'NO',
    flagName: 'Norway',
    vesselType: 'LNG Tanker',
    gearCategory: 'Commercial/Research',
    lengthMeters: 299.0,
    grossTonnage: 112000,
    riskScore: 8,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '30 secs ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '03°10\'00"S 081°40\'00"W',
    baseLatDeg: -3.1667,
    baseLngDeg: -81.6667,
    baseSogKts: 19.1,
    baseHeadingDeg: 160,
    headingCardinal: 'SSE',
    baseDraftMeters: 11.8,
    manifestDraftMeters: 11.8,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '11.8m deep (Compliant LNG cryogenic draft)',
    leafletPos: [-50.8, 20.8],
    radarPos: { xPct: 88, yPct: 64 },
    voyageRoute: {
      originPort: 'Panama Canal',
      originSvg: [790, 110],
      destPort: 'Tokyo Bay, Japan',
      destSvg: [95, 85],
      currentSvg: [490, 100],
      protectedZone: 'TRANS-PACIFIC DEEPWATER LANE',
    },
    waypoints: [
      { id: 'V011-W1', label: 'LANE #1', coords: '03°10\'00"S, 081°40\'00"W', svgPos: [490, 100], summary: '19.1 kts clean LNG dual-fuel transit' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-2.8, -81.8], speedKts: 19.0 },
      { id: 'T2', time: '14:00', coords: [-3.0, -81.7], speedKts: 19.1 },
      { id: 'T3', time: '16:00', coords: [-3.16, -81.66], speedKts: 19.1 },
    ],
    underwaterReconTarget: '299m LNG carrier dual-hull cryogenic keel & low-vibration propulsion profile.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x0284c7,
    acousticSignature: {
      propellerRpm: 90,
      cavitationHz: 155,
      sonarPingDb: 146,
      noiseProfile: 'Ultra-Clean Dual-Fuel LNG Turbine Signature',
    },
    wildlifeProximity: [{ species: 'Blue Whale (Balaenoptera musculus)', distanceMeters: 220, status: 'Voluntary Speed Reduction Ready' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V011-1',
        title: 'Dual-Hull Cryogenic Integrity Verified (11.8m)',
        depthRange: '11.8m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Thermal FLIR shows zero hull temperature anomalies.',
        sdgTarget: 'SDG 14.1',
        relativePos: [0, -10.5, 0],
      },
    ],
  },
  {
    id: 'V-012',
    vesselNum: 12,
    codename: 'CORAL NAVIGATOR',
    vesselName: 'MV CORAL NAVIGATOR',
    mmsi: '244810990',
    imo: '9399102',
    callsign: 'PBCQ',
    flagCode: 'NL',
    flagName: 'Netherlands',
    vesselType: 'Refrigerated Cargo',
    gearCategory: 'Freezer Ships',
    lengthMeters: 152.0,
    grossTonnage: 14200,
    riskScore: 22,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Authorized Weather Bypass',
    sanctuaryTrespass: false,
    baseCoordinates: '00°20\'00"S 089°00\'00"W',
    baseLatDeg: -0.3333,
    baseLngDeg: -89.0,
    baseSogKts: 16.4,
    baseHeadingDeg: 225,
    headingCardinal: 'SW',
    baseDraftMeters: 7.5,
    manifestDraftMeters: 7.5,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '7.5m deep (8 NM weather swell bypass authorized)',
    leafletPos: [0.4, -0.4],
    radarPos: { xPct: 56, yPct: 22 },
    voyageRoute: {
      originPort: 'Antofagasta, Chile',
      originSvg: [830, 315],
      destPort: 'Valparaíso, Chile',
      destSvg: [810, 350],
      currentSvg: [820, 330],
      protectedZone: 'CHILEAN COASTAL WEATHER CORRIDOR',
    },
    waypoints: [
      { id: 'V012-W1', label: 'BYPASS #1', coords: '28°15\'00"S, 072°10\'00"W', svgPos: [820, 330], summary: '8 NM weather swell bypass logged with Coast Guard' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-0.15, -88.8], speedKts: 16.3 },
      { id: 'T2', time: '14:00', coords: [-0.25, -88.9], speedKts: 16.4 },
      { id: 'T3', time: '16:00', coords: [-0.33, -89.0], speedKts: 16.4 },
    ],
    underwaterReconTarget: '7.5m licensed refrigerated fruit carrier hull & closed bilge valve verification.',
    dsaAlgorithm: 'Dijkstra Weather-Adjusted Corridor Check',
    dsaComplexity: 'O((V + E) log V)',
    hullColorHex: 0x0d9488,
    acousticSignature: {
      propellerRpm: 112,
      cavitationHz: 175,
      sonarPingDb: 151,
      noiseProfile: 'Compliant Reefer Transit (Licensed Manifest)',
    },
    wildlifeProximity: [{ species: 'Manta Ray (Mobula birostris)', distanceMeters: 90, status: 'Safe Depth Separation' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V012-1',
        title: 'Authorized 8 NM Swell Bypass & Sealed Bilge Valves',
        depthRange: '7.5m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'No hull-to-hull fenders or transshipment gear present.',
        sdgTarget: 'SDG 14.4',
        relativePos: [0, -7, 0],
      },
    ],
  },
  {
    id: 'V-013',
    vesselNum: 13,
    codename: 'EQUATORIAL DRIFT',
    vesselName: 'MT EQUATORIAL DRIFT',
    mmsi: '563098100',
    imo: '9588410',
    callsign: '9V29',
    flagCode: 'SG',
    flagName: 'Singapore',
    vesselType: 'Chemical Tanker',
    gearCategory: 'Commercial/Research',
    lengthMeters: 145.0,
    grossTonnage: 16900,
    riskScore: 14,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '01°40\'00"S 086°50\'00"W',
    baseLatDeg: -1.6667,
    baseLngDeg: -86.8333,
    baseSogKts: 13.0,
    baseHeadingDeg: 310,
    headingCardinal: 'NW',
    baseDraftMeters: 8.4,
    manifestDraftMeters: 8.4,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '8.4m deep (MARPOL Annex II compliant)',
    leafletPos: [-13.4, 153.4],
    radarPos: { xPct: 60, yPct: 45 },
    voyageRoute: {
      originPort: 'Balboa, Panama',
      originSvg: [790, 130],
      destPort: 'Buenaventura, Colombia',
      destSvg: [835, 165],
      currentSvg: [812, 148],
      protectedZone: 'PANAMA BIGHT SHIPPING LANE',
    },
    waypoints: [
      { id: 'V013-W1', label: 'LANE #1', coords: '01°40\'00"S, 086°50\'00"W', svgPos: [812, 148], summary: '13.0 kts MARPOL-compliant chemical tanker' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-1.8, -86.6], speedKts: 13.0 },
      { id: 'T2', time: '14:00', coords: [-1.73, -86.72], speedKts: 13.0 },
      { id: 'T3', time: '16:00', coords: [-1.66, -86.83], speedKts: 13.0 },
    ],
    underwaterReconTarget: 'Double-hull chemical tanker sea-chest & zero-discharge thermal FLIR verification.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x1d4ed8,
    acousticSignature: {
      propellerRpm: 96,
      cavitationHz: 158,
      sonarPingDb: 149,
      noiseProfile: 'Steady Medium-Speed Tanker Propulsion',
    },
    wildlifeProximity: [{ species: 'Bottlenose Dolphin Pod', distanceMeters: 130, status: 'Nominal' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V013-1',
        title: 'MARPOL Annex II Double-Hull Sea-Chest Sealed (8.4m)',
        depthRange: '8.4m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Water pH 8.12 and turbidity 2.1 NTU confirm zero chemical seepage.',
        sdgTarget: 'SDG 14.1',
        relativePos: [0, -8, 0],
      },
    ],
  },
  {
    id: 'V-014',
    vesselNum: 14,
    codename: 'CAPE TRANSIT',
    vesselName: 'MV CAPE TRANSIT',
    mmsi: '248991000',
    imo: '9642010',
    callsign: '9H4K',
    flagCode: 'MT',
    flagName: 'Malta',
    vesselType: 'Pure Car & Truck Carrier',
    gearCategory: 'Commercial/Research',
    lengthMeters: 200.0,
    grossTonnage: 58900,
    riskScore: 10,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '04°00\'00"S 085°00\'00"W',
    baseLatDeg: -4.0,
    baseLngDeg: -85.0,
    baseSogKts: 17.8,
    baseHeadingDeg: 135,
    headingCardinal: 'SE',
    baseDraftMeters: 9.0,
    manifestDraftMeters: 9.0,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '9.0m deep (Compliant Ro-Ro carrier)',
    leafletPos: [56.8, -173.8],
    radarPos: { xPct: 74, yPct: 76 },
    voyageRoute: {
      originPort: 'Valparaíso, Chile',
      originSvg: [810, 345],
      destPort: 'Auckland, New Zealand',
      destSvg: [140, 355],
      currentSvg: [475, 350],
      protectedZone: 'SOUTH PACIFIC GREAT CIRCLE ROUTE',
    },
    waypoints: [
      { id: 'V014-W1', label: 'LANE #1', coords: '04°00\'00"S, 085°00\'00"W', svgPos: [475, 350], summary: '17.8 kts Ro-Ro vehicle carrier transit' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-3.7, -85.3], speedKts: 17.8 },
      { id: 'T2', time: '14:00', coords: [-3.85, -85.15], speedKts: 17.8 },
      { id: 'T3', time: '16:00', coords: [-4.0, -85.0], speedKts: 17.8 },
    ],
    underwaterReconTarget: '9.0m Ro-Ro carrier bilge keel stability fins & propeller boss cap fins.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x0e7490,
    acousticSignature: {
      propellerRpm: 105,
      cavitationHz: 164,
      sonarPingDb: 147,
      noiseProfile: 'Boss Cap Fin Cavitation-Reduced Screw Signature',
    },
    wildlifeProximity: [{ species: 'Humpback Whale (Megaptera novaeangliae)', distanceMeters: 180, status: 'Safe Corridor' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V014-1',
        title: 'Low-Noise Boss Cap Fin Propeller Verified (9.0m)',
        depthRange: '9.0m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Reduced underwater radiated noise protecting cetacean communication.',
        sdgTarget: 'SDG 14.2',
        relativePos: [0, -8.5, 0],
      },
    ],
  },
  {
    id: 'V-015',
    vesselNum: 15,
    codename: 'ISLAND EXPRESS',
    vesselName: 'MV ISLAND EXPRESS',
    mmsi: '735059120',
    imo: '9811045',
    callsign: 'HC4E',
    flagCode: 'EC',
    flagName: 'Ecuador',
    vesselType: 'Inter-Island Ferry',
    gearCategory: 'Commercial/Research',
    lengthMeters: 88.0,
    grossTonnage: 3400,
    riskScore: 5,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '20 secs ago - Electric-Hybrid Green Pass',
    sanctuaryTrespass: false,
    baseCoordinates: '00°50\'00"S 090°30\'00"W',
    baseLatDeg: -0.8333,
    baseLngDeg: -90.5,
    baseSogKts: 12.5,
    baseHeadingDeg: 80,
    headingCardinal: 'ENE',
    baseDraftMeters: 4.2,
    manifestDraftMeters: 4.2,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '4.2m deep (Electric-hybrid quiet acoustic signature)',
    leafletPos: [28.0, -60.0],
    radarPos: { xPct: 48, yPct: 30 },
    voyageRoute: {
      originPort: 'Santa Cruz, Galápagos',
      originSvg: [510, 210],
      destPort: 'San Cristóbal, Galápagos',
      destSvg: [570, 215],
      currentSvg: [540, 212],
      protectedZone: 'AUTHORIZED INTER-ISLAND ECO-CHANNEL',
    },
    waypoints: [
      { id: 'V015-W1', label: 'ECO #1', coords: '00°50\'00"S, 090°30\'00"W', svgPos: [540, 212], summary: '12.5 kts electric-hybrid inter-island ferry' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '14:00', coords: [-0.85, -90.6], speedKts: 12.4 },
      { id: 'T2', time: '15:00', coords: [-0.84, -90.55], speedKts: 12.5 },
      { id: 'T3', time: '16:00', coords: [-0.83, -90.5], speedKts: 12.5 },
    ],
    underwaterReconTarget: 'Electric-hybrid azimuth podded propulsors & ultra-quiet 128 dB acoustic signature.',
    dsaAlgorithm: 'Acoustic Harmonics Fast Band-Pass Filter',
    dsaComplexity: 'O(N)',
    hullColorHex: 0x059669,
    acousticSignature: {
      propellerRpm: 140,
      cavitationHz: 95,
      sonarPingDb: 128,
      noiseProfile: 'Ultra-Quiet Rim-Driven Electric Pod Propulsion (128 dB)',
    },
    wildlifeProximity: [
      { species: 'Galápagos Marine Iguana & Sea Turtle Colony', distanceMeters: 65, status: 'Zero Acoustic Disturbance' },
    ],
    subseaAnomalies: [
      {
        id: 'ANOM-V015-1',
        title: 'Rim-Driven Electric-Hybrid Quiet Propulsion (128 dB)',
        depthRange: '4.2m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Benchmark SDG 14 eco-vessel with zero bilge discharge and whisper-quiet pods.',
        sdgTarget: 'SDG 14.2 & 14.5',
        relativePos: [0, -4, 0],
      },
    ],
  },
  {
    id: 'V-016',
    vesselNum: 16,
    codename: 'OCEAN PIONEER',
    vesselName: 'RV OCEAN PIONEER',
    mmsi: '367812000',
    imo: '9784510',
    callsign: 'WDC9',
    flagCode: 'US',
    flagName: 'USA',
    vesselType: 'Scientific Research',
    gearCategory: 'Commercial/Research',
    lengthMeters: 84.0,
    grossTonnage: 3150,
    riskScore: 11,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '15 secs ago - UNESCO Bathymetric Survey',
    sanctuaryTrespass: false,
    baseCoordinates: '02°30\'00"S 092°00\'00"W',
    baseLatDeg: -2.5,
    baseLngDeg: -92.0,
    baseSogKts: 4.5,
    baseHeadingDeg: 180,
    headingCardinal: 'S',
    baseDraftMeters: 5.1,
    manifestDraftMeters: 5.1,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '5.1m deep (UNESCO multibeam bathymetric sonar array active)',
    leafletPos: [13.2, 112.8],
    radarPos: { xPct: 36, yPct: 48 },
    voyageRoute: {
      originPort: 'Callao, Peru',
      originSvg: [850, 275],
      destPort: 'Guayaquil, Ecuador',
      destSvg: [870, 215],
      currentSvg: [580, 245],
      protectedZone: 'GALÁPAGOS SEAMOUNT RESEARCH TRANSECT',
    },
    waypoints: [
      { id: 'V016-W1', label: 'SURVEY #1', coords: '02°30\'00"S, 092°00\'00"W', svgPos: [580, 245], summary: '4.5 kts UNESCO multibeam bathymetric seabed mapping' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-2.35, -92.0], speedKts: 4.5 },
      { id: 'T2', time: '14:00', coords: [-2.42, -92.0], speedKts: 4.5 },
      { id: 'T3', time: '16:00', coords: [-2.5, -92.0], speedKts: 4.5 },
    ],
    underwaterReconTarget: 'UNESCO multibeam bathymetric gondola array & CTD rosette sampler at 5.1m keel.',
    dsaAlgorithm: 'Bathymetric Point-Cloud Spatial Indexing',
    dsaComplexity: 'O(N log N)',
    hullColorHex: 0x0284c7,
    acousticSignature: {
      propellerRpm: 65,
      cavitationHz: 110,
      sonarPingDb: 160,
      noiseProfile: 'Calibrated 30 kHz Scientific Multibeam Swath Echosounder',
    },
    wildlifeProximity: [{ species: 'Deep-Sea Dumbo Octopus (Grimpoteuthis)', distanceMeters: 48, status: 'Observed via CTD Cam' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V016-1',
        title: 'UNESCO Multibeam Bathymetric Gondola & CTD Rosette',
        depthRange: '5.1m – 45m',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Authorized SDG 14.a marine scientific research mission.',
        sdgTarget: 'SDG 14.a',
        relativePos: [0, -8, 0],
      },
    ],
  },
  {
    id: 'V-017',
    vesselNum: 17,
    codename: 'BLUE CURRENT',
    vesselName: 'MT BLUE CURRENT',
    mmsi: '351908220',
    imo: '9488120',
    callsign: '3FQM',
    flagCode: 'PA',
    flagName: 'Panama',
    vesselType: 'Aframax Crude Tanker',
    gearCategory: 'Commercial/Research',
    lengthMeters: 245.0,
    grossTonnage: 62000,
    riskScore: 16,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '03°30\'00"S 084°00\'00"W',
    baseLatDeg: -3.5,
    baseLngDeg: -84.0,
    baseSogKts: 13.5,
    baseHeadingDeg: 290,
    headingCardinal: 'WNW',
    baseDraftMeters: 13.5,
    manifestDraftMeters: 13.5,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '13.5m deep (Compliant Aframax double-hull draft)',
    leafletPos: [33.4, 151.6],
    radarPos: { xPct: 79, yPct: 54 },
    voyageRoute: {
      originPort: 'Chimbote, Peru',
      originSvg: [865, 255],
      destPort: 'Callao, Peru',
      destSvg: [855, 285],
      currentSvg: [860, 270],
      protectedZone: 'OFFSHORE TANKER SEPARATION SCHEME',
    },
    waypoints: [
      { id: 'V017-W1', label: 'LANE #1', coords: '03°30\'00"S, 084°00\'00"W', svgPos: [860, 270], summary: '13.5 kts Aframax tanker in designated offshore lane' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-3.6, -83.8], speedKts: 13.5 },
      { id: 'T2', time: '14:00', coords: [-3.55, -83.9], speedKts: 13.5 },
      { id: 'T3', time: '16:00', coords: [-3.5, -84.0], speedKts: 13.5 },
    ],
    underwaterReconTarget: '13.5m deep Aframax crude tanker double-hull bottom plating & zero-leakage FLIR sweep.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x1e293b,
    acousticSignature: {
      propellerRpm: 82,
      cavitationHz: 148,
      sonarPingDb: 150,
      noiseProfile: 'Deep-Draft Aframax Slow-Speed Diesel',
    },
    wildlifeProximity: [{ species: 'Peruvian Booby & Anchoveta School', distanceMeters: 160, status: 'Nominal' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V017-1',
        title: '13.5m Deep-Draft Aframax Double-Hull Verified Clean',
        depthRange: '13.5m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Zero hydrocarbon fluorescence detected in wake column.',
        sdgTarget: 'SDG 14.1',
        relativePos: [0, -12, 0],
      },
    ],
  },
  {
    id: 'V-018',
    vesselNum: 18,
    codename: 'AURORA BOREALIS',
    vesselName: 'CS AURORA BOREALIS',
    mmsi: '228419000',
    imo: '9677120',
    callsign: 'FNRQ',
    flagCode: 'FR',
    flagName: 'France',
    vesselType: 'Subsea Cable Repair',
    gearCategory: 'Commercial/Research',
    lengthMeters: 112.0,
    grossTonnage: 8900,
    riskScore: 7,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '10 secs ago - Dynamic Positioning Active',
    sanctuaryTrespass: false,
    baseCoordinates: '01°05\'00"S 088°20\'00"W',
    baseLatDeg: -1.0833,
    baseLngDeg: -88.3333,
    baseSogKts: 2.1,
    baseHeadingDeg: 15,
    headingCardinal: 'NNE',
    baseDraftMeters: 6.2,
    manifestDraftMeters: 6.2,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '6.2m deep (Friendly maintenance ROV deployed on subsea fiber optic line)',
    leafletPos: [-25.4, 110.4],
    radarPos: { xPct: 58, yPct: 33 },
    voyageRoute: {
      originPort: 'Valparaíso, Chile',
      originSvg: [810, 345],
      destPort: 'Arica, Chile',
      destSvg: [845, 290],
      currentSvg: [640, 215],
      protectedZone: 'PAN-AMERICAN SUBSEA FIBER TRUNK',
    },
    waypoints: [
      { id: 'V018-W1', label: 'SPLICE #1', coords: '01°05\'00"S, 088°20\'00"W', svgPos: [640, 215], summary: '2.1 kts DP2 cable-lay with friendly maintenance ROV on seabed' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-1.12, -88.35], speedKts: 2.0 },
      { id: 'T2', time: '14:00', coords: [-1.1, -88.34], speedKts: 2.1 },
      { id: 'T3', time: '16:00', coords: [-1.08, -88.33], speedKts: 2.1 },
    ],
    underwaterReconTarget: 'Subsea fiber-optic trunk cable on seabed & friendly maintenance ROV performing optical repeater splice.',
    dsaAlgorithm: 'Minimum Spanning Tree Subsea Cable Topology',
    dsaComplexity: 'O(E log V)',
    hullColorHex: 0x0369a1,
    acousticSignature: {
      propellerRpm: 110,
      cavitationHz: 135,
      sonarPingDb: 154,
      noiseProfile: 'DP2 Bow Thruster Station-Keeping & USBL Acoustic Transponder',
    },
    wildlifeProximity: [{ species: 'Benthic Squat Lobster Colony', distanceMeters: 15, status: 'Undisturbed' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V018-1',
        title: 'Friendly Maintenance ROV & Subsea Fiber-Optic Trunk Cable',
        depthRange: '6.2m – 160m',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Authorized telecom repair ROV operating on armored seabed fiber line.',
        sdgTarget: 'SDG 14.a',
        relativePos: [5, -14, 4],
      },
    ],
  },
  {
    id: 'V-019',
    vesselNum: 19,
    codename: 'HORIZON LEADER',
    vesselName: 'MT HORIZON LEADER',
    mmsi: '636019440',
    imo: '9541090',
    callsign: 'A8VP',
    flagCode: 'LR',
    flagName: 'Liberia',
    vesselType: 'LPG Gas Carrier',
    gearCategory: 'Commercial/Research',
    lengthMeters: 180.0,
    grossTonnage: 29800,
    riskScore: 13,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '04°30\'00"S 087°00\'00"W',
    baseLatDeg: -4.5,
    baseLngDeg: -87.0,
    baseSogKts: 16.0,
    baseHeadingDeg: 260,
    headingCardinal: 'W',
    baseDraftMeters: 8.9,
    manifestDraftMeters: 8.9,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '8.9m deep (Compliant LPG carrier draft)',
    leafletPos: [-34.2, 49.2],
    radarPos: { xPct: 62, yPct: 72 },
    voyageRoute: {
      originPort: 'Balboa, Panama',
      originSvg: [790, 125],
      destPort: 'San Antonio, Chile',
      destSvg: [830, 340],
      currentSvg: [810, 260],
      protectedZone: 'SOUTHBOUND ENERGY TRANSIT LANE',
    },
    waypoints: [
      { id: 'V019-W1', label: 'LANE #1', coords: '04°30\'00"S, 087°00\'00"W', svgPos: [810, 260], summary: '16.0 kts pressurized LPG carrier' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-4.45, -86.7], speedKts: 16.0 },
      { id: 'T2', time: '14:00', coords: [-4.48, -86.85], speedKts: 16.0 },
      { id: 'T3', time: '16:00', coords: [-4.5, -87.0], speedKts: 16.0 },
    ],
    underwaterReconTarget: '8.9m LPG carrier hull & cathodic protection potential verification.',
    dsaAlgorithm: 'FNV-1a Hash Table O(1) MMSI Registry Verification',
    dsaComplexity: 'O(1)',
    hullColorHex: 0x0f766e,
    acousticSignature: {
      propellerRpm: 100,
      cavitationHz: 160,
      sonarPingDb: 148,
      noiseProfile: 'Nominal Pressurized Gas Carrier Propulsion',
    },
    wildlifeProximity: [{ species: 'Short-Finned Pilot Whale Pod', distanceMeters: 175, status: 'Clear Transit' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V019-1',
        title: 'Compliant 8.9m Draft & ICCP Cathodic Shield',
        depthRange: '8.9m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Hull draft and acoustic profile match IMO registry.',
        sdgTarget: 'SDG 14.1',
        relativePos: [0, -8.5, 0],
      },
    ],
  },
  {
    id: 'V-020',
    vesselNum: 20,
    codename: 'ZEPHYR TRADE',
    vesselName: 'MV ZEPHYR TRADE',
    mmsi: '477192800',
    imo: '9688401',
    callsign: 'VRKL',
    flagCode: 'HK',
    flagName: 'Hong Kong',
    vesselType: 'Multi-Purpose Cargo',
    gearCategory: 'Commercial/Research',
    lengthMeters: 168.0,
    grossTonnage: 21500,
    riskScore: 17,
    status: 'NORMAL',
    isOnline: true,
    signalTurnedOff: false,
    aisStatusText: '1 min ago - Compliant AIS',
    sanctuaryTrespass: false,
    baseCoordinates: '02°50\'00"S 090°00\'00"W',
    baseLatDeg: -2.8333,
    baseLngDeg: -90.0,
    baseSogKts: 14.8,
    baseHeadingDeg: 330,
    headingCardinal: 'NNW',
    baseDraftMeters: 8.2,
    manifestDraftMeters: 8.2,
    draftDeltaMeters: 0.0,
    draftDisplayNote: '8.2m deep (Compliant multi-purpose cargo draft)',
    leafletPos: [-4.0, -97.0],
    radarPos: { xPct: 44, yPct: 52 },
    voyageRoute: {
      originPort: 'Antofagasta, Chile',
      originSvg: [835, 315],
      destPort: 'Kaohsiung, Taiwan',
      destSvg: [145, 95],
      currentSvg: [490, 205],
      protectedZone: 'TRANS-PACIFIC COMMERCIAL CORRIDOR',
    },
    waypoints: [
      { id: 'V020-W1', label: 'LANE #1', coords: '02°50\'00"S, 090°00\'00"W', svgPos: [490, 205], summary: '14.8 kts multi-purpose cargo transit' },
    ],
    dllTrajectoryNodes: [
      { id: 'T1', time: '12:00', coords: [-3.0, -89.85], speedKts: 14.7 },
      { id: 'T2', time: '14:00', coords: [-2.92, -89.92], speedKts: 14.8 },
      { id: 'T3', time: '16:00', coords: [-2.83, -90.0], speedKts: 14.8 },
    ],
    underwaterReconTarget: '8.2m multi-purpose cargo hull & sea-valve inspection.',
    dsaAlgorithm: 'Quick Sort Priority Track Partitioning',
    dsaComplexity: 'O(N log N)',
    hullColorHex: 0x1e40af,
    acousticSignature: {
      propellerRpm: 98,
      cavitationHz: 165,
      sonarPingDb: 149,
      noiseProfile: 'Compliant Geared Cargo Vessel Signature',
    },
    wildlifeProximity: [{ species: 'Pelagic Stingray', distanceMeters: 95, status: 'Safe Separation' }],
    subseaAnomalies: [
      {
        id: 'ANOM-V020-1',
        title: 'Compliant 8.2m Waterline & Clean Sea Chest',
        depthRange: '8.2m Hull Keel',
        category: 'COMPLIANT_SYSTEM',
        severity: 'NOMINAL',
        description: 'Laser profiler confirms declared 8.2m draft with zero net attachments.',
        sdgTarget: 'SDG 14.4',
        relativePos: [0, -8, 0],
      },
    ],
  },
];

/**
 * Formats decimal degrees into DMS string with +/- arc-second oscillation
 */
function formatDmsCoord(latDeg: number, lngDeg: number, deltaArcSec: number): string {
  const formatSingle = (val: number, posHemi: string, negHemi: string) => {
    const hemi = val >= 0 ? posHemi : negHemi;
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    let sec = Math.round((minFloat - min) * 60 + deltaArcSec);
    if (sec < 0) sec = 0;
    if (sec > 59) sec = 59;
    return `${deg.toString().padStart(2, '0')}°${min
      .toString()
      .padStart(2, '0')}'${sec.toString().padStart(2, '0')}"${hemi}`;
  };
  const latHemi = latDeg >= 0 ? 'N' : 'S';
  const lngHemi = lngDeg >= 0 ? 'E' : 'W';
  return `${formatSingle(latDeg, latHemi, latHemi)} ${formatSingle(lngDeg, lngHemi, lngHemi)}`;
}

/**
 * Live 2.5-Second Telemetry Ticker Oscillator:
 * phase = tick * 0.4 + vesselNum * 0.8
 * Oscillates coordinates (±3" Lat/Lng), SOG (±0.18 kts), Heading (±2°), and Draft (±0.03m)
 */
export function computeOscillatedFleet(
  vessels: AegisVesselRecord[],
  tick: number
): LiveOscillatedVessel[] {
  return vessels.map((v) => {
    const phase = tick * 0.4 + v.vesselNum * 0.8;
    const sinP = Math.sin(phase);
    const cosP = Math.cos(phase);

    const deltaArcSec = Math.round(sinP * 3); // ±3"
    const liveCoordinates =
      tick === 0
        ? v.baseCoordinates
        : formatDmsCoord(v.baseLatDeg, v.baseLngDeg, deltaArcSec);

    const rawSog = Math.max(0.05, v.baseSogKts + sinP * 0.18);
    const liveSogKts = Number(rawSog.toFixed(2));

    const rawHdg = (Math.round(v.baseHeadingDeg + cosP * 2) + 360) % 360;
    const liveHeadingDeg = tick === 0 ? v.baseHeadingDeg : rawHdg;
    const liveHeadingDisplay =
      v.headingCardinal === 'Drift'
        ? `${liveHeadingDeg.toString().padStart(3, '0')}° Drift`
        : `${liveHeadingDeg.toString().padStart(3, '0')}° ${v.headingCardinal}`;

    const liveDraftMeters = Number((v.baseDraftMeters + sinP * 0.03).toFixed(2));
    const liveCavitationHz = Math.max(
      20,
      Math.round(v.acousticSignature.cavitationHz + sinP * 4)
    );
    const liveSonarPingDb = Math.round(
      v.acousticSignature.sonarPingDb + cosP * 2
    );

    return {
      ...v,
      liveCoordinates,
      liveSogKts,
      liveHeadingDeg,
      liveHeadingDisplay,
      liveDraftMeters,
      liveCavitationHz,
      liveSonarPingDb,
    };
  });
}

/**
 * Synchronized Vessel Filter Logic (Exact match with AEGIS Radar specification)
 */
export interface FleetFilterCriteria {
  threatFocus: ThreatFocusFilter;
  riskTier: RiskTierFilter;
  matrixStatus: MatrixStatusFilter;
  flagName: string; // 'ALL' or exact flagName
  gearType: GearTypeFilter;
  searchQuery?: string;
}

export function filterAegisVessels<T extends AegisVesselRecord>(
  vessels: T[],
  criteria: FleetFilterCriteria
): T[] {
  return vessels.filter((v) => {
    // 1. Threat Focus (Synced)
    if (criteria.threatFocus === 'HIGH_RISK') {
      const isHighRisk =
        v.riskScore >= 80 || v.sanctuaryTrespass || v.signalTurnedOff;
      if (!isHighRisk) return false;
    } else if (criteria.threatFocus === 'SANCTUARY') {
      if (!v.sanctuaryTrespass) return false;
    } else if (criteria.threatFocus === 'SIGNAL_OFF') {
      if (!v.signalTurnedOff) return false;
    } else {
      // 'ALL' defers to Suspicion Level (riskTier)
      if (criteria.riskTier === 'HIGH') {
        if (v.riskScore <= 80) return false;
      } else if (criteria.riskTier === 'MEDIUM') {
        if (v.riskScore < 50 || v.riskScore > 80) return false;
      }
    }

    // 2. Matrix Status Filter
    if (criteria.matrixStatus !== 'ALL' && v.status !== criteria.matrixStatus) {
      return false;
    }

    // 3. Country Flag Filter
    if (criteria.flagName !== 'ALL' && v.flagName !== criteria.flagName) {
      return false;
    }

    // 4. Gear Type Filter
    if (criteria.gearType !== 'ALL' && v.gearCategory !== criteria.gearType) {
      return false;
    }

    // 5. Optional search query
    if (criteria.searchQuery && criteria.searchQuery.trim().length > 0) {
      const q = criteria.searchQuery.toLowerCase().trim();
      const match =
        v.id.toLowerCase().includes(q) ||
        v.codename.toLowerCase().includes(q) ||
        v.vesselName.toLowerCase().includes(q) ||
        v.mmsi.toLowerCase().includes(q) ||
        v.imo.toLowerCase().includes(q) ||
        v.flagName.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });
}

/**
 * 16-Slot Circular Queue (Ring Buffer) for Offline Hydrophone Telemetry (O(1) Enqueue/Dequeue)
 */
export class HydrophoneCircularQueue16 {
  private readonly capacity = 16;
  private slots: (HydrophoneRingPacket | null)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private overwrittenCount = 0;

  constructor() {
    this.slots = new Array(16).fill(null);
  }

  public enqueue(
    packet: Omit<HydrophoneRingPacket, 'slotIndex'>
  ): HydrophoneRingPacket {
    const slotIndex = this.tail;
    const fullPacket: HydrophoneRingPacket = { ...packet, slotIndex };
    this.slots[slotIndex] = fullPacket;

    if (this.count === this.capacity) {
      this.head = (this.head + 1) % this.capacity;
      this.overwrittenCount++;
    } else {
      this.count++;
    }
    this.tail = (this.tail + 1) % this.capacity;
    return fullPacket;
  }

  public dequeue(): HydrophoneRingPacket | null {
    if (this.count === 0) return null;
    const pkt = this.slots[this.head];
    this.slots[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return pkt;
  }

  public flushToCutterArgus(): HydrophoneRingPacket[] {
    const flushed: HydrophoneRingPacket[] = [];
    while (this.count > 0) {
      const p = this.dequeue();
      if (p) flushed.push(p);
    }
    return flushed;
  }

  public getSnapshot() {
    return {
      slots: [...this.slots],
      head: this.head,
      tail: this.tail,
      count: this.count,
      capacity: this.capacity,
      overwrittenCount: this.overwrittenCount,
      utilizationPct: Math.round((this.count / this.capacity) * 100),
    };
  }
}

/**
 * LIFO Breadcrumb Stack for AUV-09 Emergency Retreat (O(1) Push/Pop)
 */
export class AuvBreadcrumbStack {
  private stack: BreadcrumbNode[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 32) {
    this.maxCapacity = maxCapacity;
  }

  public push(node: Omit<BreadcrumbNode, 'id' | 'index'>): BreadcrumbNode {
    const index = this.stack.length;
    const fullNode: BreadcrumbNode = {
      ...node,
      id: `BC-${index + 1}-${Date.now().toString().slice(-4)}`,
      index,
    };
    if (this.stack.length >= this.maxCapacity) {
      this.stack.shift();
    }
    this.stack.push(fullNode);
    return fullNode;
  }

  public pop(): BreadcrumbNode | undefined {
    return this.stack.pop();
  }

  public peek(): BreadcrumbNode | undefined {
    return this.stack[this.stack.length - 1];
  }

  public size(): number {
    return this.stack.length;
  }

  public getNodes(): BreadcrumbNode[] {
    return [...this.stack];
  }
}
